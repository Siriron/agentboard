// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// AgentBoard V2 for Arc mainnet. Single file for Remix: AgentKernel, EvaluatorRouter, JobBoard.
// Compiler 0.8.28, EVM version cancun, optimizer on (200 runs).

import {IERC20} from "@openzeppelin/contracts@5.1.0/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts@5.1.0/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts@5.1.0/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts@5.1.0/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts@5.1.0/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts@5.1.0/utils/Pausable.sol";

// ───────── interfaces ─────────
/// @notice ERC-8183 hook interface. VERIFY selector/data encodings against the EIP
///         text and Arc's testnet reference (0x0747…4583) before mainnet.
interface IACPHook {
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
    function afterAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
}

interface IAgentKernel {
    enum Status { None, Open, Funded, Submitted, Completed, Rejected, Expired, Split }

    struct Job {
        address client;
        address provider;
        address evaluator;
        address hook;
        uint128 budget;
        uint64 expiredAt;
        uint64 submittedAt;
        uint64 number;
        uint16 feeBps;
        Status status;
        bytes32 deliverable;
    }

    function getJob(uint256 jobId) external view returns (Job memory);
    function complete(uint256 jobId, bytes32 reason, bytes calldata optParams) external;
    function reject(uint256 jobId, bytes32 reason, bytes calldata optParams) external;
    function resolveSplit(uint256 jobId, uint16 providerBps, bytes32 reason) external;
    function fund(uint256 jobId, uint256 expectedBudget, bytes calldata optParams) external;
}

// ───────── 1. AgentKernel ─────────

/// @title AgentKernel
/// @notice ERC-8183-style job escrow for Arc. Holds all funds (ERC-20 USDC, 6 decimals).
///
/// Lifecycle: Open -> Funded -> Submitted -> Completed | Rejected | Expired | Split.
/// Only the evaluator can complete or reject funded work. The client can reject only while
/// Open. `claimRefund` after expiry is permissionless and never hooked.
///
/// Extensions beyond the base standard (documented, additive):
///  - deterministic job ids so a client can batch createJob + config + fund in one tx
///  - `resolveSplit` (evaluator-only) for partial settlement
///  - `SUBMIT_GRACE`: submitting pushes expiry to at least now + 30 days so an evaluator
///    always has time to act before the client can refund
///  - `extendDeadline` (client-only, while Funded)
///  - blocklist-safe payouts: a failed USDC transfer is credited to `claimable` instead
///    of reverting the whole settlement
///
/// Funds are never invested, lent or swept. The owner cannot move escrowed funds.
contract AgentKernel is IAgentKernel, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ───────────── constants ─────────────
    uint16 public constant MAX_FEE_BPS = 500; // 5% hard cap
    uint64 public constant MIN_FUND_TTL = 1 hours;
    uint64 public constant MAX_DURATION = 365 days;
    uint64 public constant SUBMIT_GRACE = 30 days;
    uint256 public constant HOOK_GAS = 300_000;

    // ───────────── state ─────────────
    IERC20 public immutable usdc;
    address public treasury;
    uint16 public feeBps;
    uint128 public minBudget;
    uint128 public maxBudget;
    uint64 public jobCount;

    mapping(uint256 => Job) private _jobs;
    mapping(address => uint64) public clientNonce;
    mapping(address => bool) public allowedHook;
    mapping(address => uint256) public claimable;

    // ───────────── events ─────────────
    event JobCreated(
        uint256 indexed jobId,
        uint64 indexed number,
        address indexed client,
        address provider,
        address evaluator,
        address hook,
        uint64 expiredAt,
        string description
    );
    event ProviderSet(uint256 indexed jobId, address indexed provider);
    event BudgetSet(uint256 indexed jobId, address indexed by, uint256 amount);
    event JobFunded(uint256 indexed jobId, address indexed client, uint256 amount, uint16 feeBps);
    event JobSubmitted(uint256 indexed jobId, address indexed provider, bytes32 deliverable, bytes optParams, uint64 newExpiredAt);
    event JobCompleted(uint256 indexed jobId, bytes32 reason, uint256 toProvider, uint256 fee);
    event JobRejected(uint256 indexed jobId, address indexed by, bytes32 reason, uint256 refunded);
    event JobSplit(uint256 indexed jobId, uint16 providerBps, bytes32 reason, uint256 toProvider, uint256 fee, uint256 refunded);
    event JobExpired(uint256 indexed jobId, uint256 refunded);
    event DeadlineExtended(uint256 indexed jobId, uint64 newExpiredAt);
    event PayoutDeferred(address indexed to, uint256 amount);
    event ClaimableWithdrawn(address indexed from, address indexed to, uint256 amount);
    event FeeUpdated(uint16 feeBps);
    event TreasuryUpdated(address treasury);
    event BudgetLimitsUpdated(uint128 minBudget, uint128 maxBudget);
    event HookAllowed(address indexed hook, bool allowed);

    // ───────────── errors ─────────────
    error ZeroAddress();
    error BadStatus(Status have);
    error NotClient();
    error NotProvider();
    error NotEvaluator();
    error NotClientOrProvider();
    error InvalidParty();
    error HookNotAllowed();
    error BadExpiry();
    error BadBudget();
    error BudgetMismatch();
    error ProviderNotSet();
    error ProviderAlreadySet();
    error NotExpired();
    error AlreadyExpired();
    error EmptyDeliverable();
    error BadBps();
    error NothingToClaim();
    error FeeTooHigh();
    error BadLimits();

    constructor(IERC20 usdc_, address treasury_, address owner_, uint128 minBudget_, uint128 maxBudget_)
        Ownable(owner_)
    {
        if (address(usdc_) == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (minBudget_ == 0 || minBudget_ > maxBudget_) revert BadLimits();
        usdc = usdc_;
        treasury = treasury_;
        feeBps = 100; // 1%
        minBudget = minBudget_;
        maxBudget = maxBudget_;
    }

    // ───────────── views ─────────────
    function getJob(uint256 jobId) external view returns (Job memory) {
        return _jobs[jobId];
    }

    /// @notice The id the client's next `createJob` will receive. Lets a wallet batch
    ///         createJob + later calls in one transaction.
    function predictJobId(address client) public view returns (uint256) {
        return _jobId(client, clientNonce[client]);
    }

    function _jobId(address client, uint64 nonce) internal view returns (uint256) {
        return uint256(keccak256(abi.encode(block.chainid, address(this), client, nonce)));
    }

    // ───────────── job lifecycle ─────────────

    function createJob(address provider, address evaluator, uint256 expiredAt, string calldata description, address hook)
        external
        whenNotPaused
        returns (uint256 jobId)
    {
        if (evaluator == address(0)) revert ZeroAddress();
        if (provider != address(0) && (provider == msg.sender || provider == evaluator)) revert InvalidParty();
        if (hook != address(0) && !allowedHook[hook]) revert HookNotAllowed();
        if (expiredAt <= block.timestamp || expiredAt > block.timestamp + MAX_DURATION) revert BadExpiry();

        jobId = _jobId(msg.sender, clientNonce[msg.sender]++);
        uint64 number = ++jobCount;

        Job storage j = _jobs[jobId];
        j.client = msg.sender;
        j.provider = provider;
        j.evaluator = evaluator;
        j.hook = hook;
        j.expiredAt = uint64(expiredAt);
        j.number = number;
        j.status = Status.Open;

        emit JobCreated(jobId, number, msg.sender, provider, evaluator, hook, uint64(expiredAt), description);
    }

    function setProvider(uint256 jobId, address provider, bytes calldata optParams) external nonReentrant {
        Job storage j = _jobs[jobId];
        if (j.status != Status.Open) revert BadStatus(j.status);
        if (msg.sender != j.client) revert NotClient();
        if (j.provider != address(0)) revert ProviderAlreadySet();
        if (provider == address(0)) revert ZeroAddress();
        if (provider == j.client || provider == j.evaluator) revert InvalidParty();

        bytes memory data = abi.encode(provider, optParams);
        _before(j, jobId, this.setProvider.selector, data, true);
        j.provider = provider;
        emit ProviderSet(jobId, provider);
        _after(j, jobId, this.setProvider.selector, data, true);
    }

    function setBudget(uint256 jobId, uint256 amount, bytes calldata optParams) external nonReentrant {
        Job storage j = _jobs[jobId];
        if (j.status != Status.Open) revert BadStatus(j.status);
        if (msg.sender != j.client && !(j.provider != address(0) && msg.sender == j.provider)) {
            revert NotClientOrProvider();
        }
        if (amount < minBudget || amount > maxBudget) revert BadBudget();

        bytes memory data = abi.encode(amount, optParams);
        _before(j, jobId, this.setBudget.selector, data, true);
        j.budget = uint128(amount);
        emit BudgetSet(jobId, msg.sender, amount);
        _after(j, jobId, this.setBudget.selector, data, true);
    }

    /// @param expectedBudget must equal the current budget (guards against a last-second
    ///        price change by the provider).
    function fund(uint256 jobId, uint256 expectedBudget, bytes calldata optParams)
        external
        nonReentrant
        whenNotPaused
    {
        Job storage j = _jobs[jobId];
        if (j.status != Status.Open) revert BadStatus(j.status);
        if (msg.sender != j.client) revert NotClient();
        if (j.provider == address(0)) revert ProviderNotSet();
        if (j.budget == 0 || j.budget != expectedBudget) revert BudgetMismatch();
        if (j.budget < minBudget || j.budget > maxBudget) revert BadBudget();
        if (j.expiredAt < block.timestamp + MIN_FUND_TTL) revert BadExpiry();

        // Blocking hook: a hook may veto funding (e.g. JobBoard binds the provider's bid).
        _before(j, jobId, this.fund.selector, optParams, true);

        j.status = Status.Funded;
        j.feeBps = feeBps; // snapshot: later fee changes never affect funded jobs
        usdc.safeTransferFrom(msg.sender, address(this), j.budget);
        emit JobFunded(jobId, msg.sender, j.budget, j.feeBps);

        _after(j, jobId, this.fund.selector, optParams, false);
    }

    function submit(uint256 jobId, bytes32 deliverable, bytes calldata optParams) external nonReentrant {
        Job storage j = _jobs[jobId];
        if (j.status != Status.Funded) revert BadStatus(j.status);
        if (msg.sender != j.provider) revert NotProvider();
        if (block.timestamp >= j.expiredAt) revert AlreadyExpired();
        if (deliverable == bytes32(0)) revert EmptyDeliverable();

        bytes memory data = abi.encode(deliverable, optParams);
        _before(j, jobId, this.submit.selector, data, true);

        j.status = Status.Submitted;
        j.deliverable = deliverable;
        j.submittedAt = uint64(block.timestamp);
        uint64 minExpiry = uint64(block.timestamp) + SUBMIT_GRACE;
        if (j.expiredAt < minExpiry) j.expiredAt = minExpiry;
        emit JobSubmitted(jobId, msg.sender, deliverable, optParams, j.expiredAt);

        _after(j, jobId, this.submit.selector, data, false);
    }

    function complete(uint256 jobId, bytes32 reason, bytes calldata optParams) external nonReentrant {
        Job storage j = _jobs[jobId];
        if (j.status != Status.Submitted) revert BadStatus(j.status);
        if (msg.sender != j.evaluator) revert NotEvaluator();

        bytes memory data = abi.encode(reason, optParams);
        _before(j, jobId, this.complete.selector, data, false);

        j.status = Status.Completed;
        (uint256 toProvider, uint256 fee) = _splitFee(j.budget, j.feeBps);
        _pay(j.provider, toProvider);
        _pay(treasury, fee);
        emit JobCompleted(jobId, reason, toProvider, fee);

        _after(j, jobId, this.complete.selector, data, false);
    }

    /// @notice Client may reject while Open (no funds involved). The evaluator may reject
    ///         Funded or Submitted work, refunding the client in full.
    function reject(uint256 jobId, bytes32 reason, bytes calldata optParams) external nonReentrant {
        Job storage j = _jobs[jobId];
        Status s = j.status;
        if (s == Status.Open) {
            if (msg.sender != j.client) revert NotClient();
        } else if (s == Status.Funded || s == Status.Submitted) {
            if (msg.sender != j.evaluator) revert NotEvaluator();
        } else {
            revert BadStatus(s);
        }

        bytes memory data = abi.encode(reason, optParams);
        _before(j, jobId, this.reject.selector, data, false);

        j.status = Status.Rejected;
        uint256 refund = s == Status.Open ? 0 : j.budget;
        _pay(j.client, refund);
        emit JobRejected(jobId, msg.sender, reason, refund);

        _after(j, jobId, this.reject.selector, data, false);
    }

    /// @notice Evaluator-only partial settlement of Submitted work. The fee applies only to
    ///         the provider's share; the client's share is refunded in full.
    function resolveSplit(uint256 jobId, uint16 providerBps, bytes32 reason) external nonReentrant {
        Job storage j = _jobs[jobId];
        if (j.status != Status.Submitted) revert BadStatus(j.status);
        if (msg.sender != j.evaluator) revert NotEvaluator();
        if (providerBps == 0 || providerBps >= 10_000) revert BadBps(); // use complete()/reject()

        bytes memory data = abi.encode(providerBps, reason);
        _before(j, jobId, this.resolveSplit.selector, data, false);

        j.status = Status.Split;
        uint256 gross = (uint256(j.budget) * providerBps) / 10_000;
        (uint256 toProvider, uint256 fee) = _splitFee(gross, j.feeBps);
        uint256 refund = uint256(j.budget) - gross;
        _pay(j.provider, toProvider);
        _pay(treasury, fee);
        _pay(j.client, refund);
        emit JobSplit(jobId, providerBps, reason, toProvider, fee, refund);

        _after(j, jobId, this.resolveSplit.selector, data, false);
    }

    /// @notice Anyone may refund the client once a Funded/Submitted job has expired.
    ///         Never hooked, so no hook can block it.
    function claimRefund(uint256 jobId) external nonReentrant {
        Job storage j = _jobs[jobId];
        if (j.status != Status.Funded && j.status != Status.Submitted) revert BadStatus(j.status);
        if (block.timestamp < j.expiredAt) revert NotExpired();

        j.status = Status.Expired;
        _pay(j.client, j.budget);
        emit JobExpired(jobId, j.budget);
    }

    /// @notice Client may push the deadline out while work is in progress. Only delays
    ///         the client's own refund, so no provider consent is needed.
    function extendDeadline(uint256 jobId, uint64 newExpiredAt) external {
        Job storage j = _jobs[jobId];
        if (j.status != Status.Funded) revert BadStatus(j.status);
        if (msg.sender != j.client) revert NotClient();
        if (newExpiredAt <= j.expiredAt || newExpiredAt > block.timestamp + MAX_DURATION) revert BadExpiry();
        j.expiredAt = newExpiredAt;
        emit DeadlineExtended(jobId, newExpiredAt);
    }

    /// @notice Withdraw funds whose direct transfer failed (e.g. blocklisted recipient).
    ///         `to` lets a blocked address route funds to a different, unblocked one.
    function withdrawClaimable(address to) external nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();
        claimable[msg.sender] = 0;
        usdc.safeTransfer(to, amount);
        emit ClaimableWithdrawn(msg.sender, to, amount);
    }

    // ───────────── admin (cannot touch escrowed funds) ─────────────

    function setFeeBps(uint16 newFee) external onlyOwner {
        if (newFee > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = newFee;
        emit FeeUpdated(newFee);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    /// @notice Launch cap: limits new budgets only; existing jobs are unaffected.
    function setBudgetLimits(uint128 newMin, uint128 newMax) external onlyOwner {
        if (newMin == 0 || newMin > newMax) revert BadLimits();
        minBudget = newMin;
        maxBudget = newMax;
        emit BudgetLimitsUpdated(newMin, newMax);
    }

    function setHookAllowed(address hook, bool allowed) external onlyOwner {
        if (hook == address(0)) revert ZeroAddress();
        allowedHook[hook] = allowed;
        emit HookAllowed(hook, allowed);
    }

    /// @notice Pauses creating and funding new jobs only. Settlement, refunds and claims
    ///         always keep working.
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ───────────── internals ─────────────

    function _splitFee(uint256 amount, uint16 bps) internal pure returns (uint256 net, uint256 fee) {
        fee = (amount * bps) / 10_000;
        net = amount - fee;
    }

    /// @dev Direct transfer; on failure (blocklist revert, false return) credit `claimable`.
    function _pay(address to, uint256 amount) internal {
        if (amount == 0) return;
        try usdc.transfer(to, amount) returns (bool ok) {
            if (!ok) _defer(to, amount);
        } catch {
            _defer(to, amount);
        }
    }

    function _defer(address to, uint256 amount) internal {
        claimable[to] += amount;
        emit PayoutDeferred(to, amount);
    }

    /// @dev `blocking` hooks may veto the action. Non-blocking hooks run with a gas cap and
    ///      can never revert or lock a settlement.
    function _before(Job storage j, uint256 jobId, bytes4 sel, bytes memory data, bool blocking) internal {
        address h = j.hook;
        if (h == address(0)) return;
        if (blocking) {
            IACPHook(h).beforeAction(jobId, sel, data);
        } else {
            try IACPHook(h).beforeAction{gas: HOOK_GAS}(jobId, sel, data) {} catch {}
        }
    }

    function _after(Job storage j, uint256 jobId, bytes4 sel, bytes memory data, bool blocking) internal {
        address h = j.hook;
        if (h == address(0)) return;
        if (blocking) {
            IACPHook(h).afterAction(jobId, sel, data);
        } else {
            try IACPHook(h).afterAction{gas: HOOK_GAS}(jobId, sel, data) {} catch {}
        }
    }
}

// ───────── 2. EvaluatorRouter ─────────

/// @title EvaluatorRouter
/// @notice Set as the `evaluator` of AgentKernel jobs. Turns "who may complete or reject"
///         into explicit, bounded rules so neither side can act unilaterally:
///
///  - The client can APPROVE at any time after submission (pays the provider).
///  - If the client stays silent for `reviewWindow`, anyone can AUTO-RELEASE to the provider.
///  - The client can REJECT inside the review window. A rejection only opens a dispute.
///  - The provider can ACCEPT the rejection (refund), CONTEST it within `responseWindow`,
///    or stay silent (then anyone can finalize the refund).
///  - A contested dispute is decided by deciders: the arbitrator snapshot (Client mode), one
///    named validator (Validator mode) or a 3/5 panel (Panel mode). Panels settle on the
///    median vote. No decision by `decisionWindow` -> majority median if reached, otherwise
///    the pre-agreed `timeoutProviderBps`.
///
/// All terms are fixed before funding and hashed (`configHash`). A provider's bid commits to
/// that hash, and JobBoard enforces the match atomically at fund time.
///
/// Panel selection is by agreement: Arc has no onchain randomness (PREVRANDAO is always 0).
contract EvaluatorRouter is Ownable2Step, ReentrancyGuard {
    enum Mode { Client, Validator, Panel }
    enum State { None, Configured, Disputed, Settled }

    struct Config {
        Mode mode;
        uint32 reviewWindow;
        uint32 responseWindow;
        uint32 decisionWindow;
        uint16 timeoutProviderBps; // provider share if deciders time out (0..10000)
        address[] validators;      // empty (Client), 1 (Validator), 3 or 5 (Panel)
    }

    struct JobState {
        State state;
        Mode mode;
        bool contested;
        uint16 timeoutProviderBps;
        uint32 reviewWindow;
        uint32 responseWindow;
        uint32 decisionWindow;
        uint64 disputedAt;
        bytes32 configHash;
        address[] deciders;
        uint16[] votes;
    }

    uint32 public constant MIN_WINDOW = 1 days;
    uint32 public constant MAX_REVIEW = 7 days;
    uint32 public constant MAX_RESPONSE = 7 days;
    uint32 public constant MAX_DECISION = 14 days;

    IAgentKernel public immutable kernel;
    /// @notice Decides disputes in Client mode. Snapshotted into each job's config.
    address public arbitrator;

    mapping(uint256 => JobState) private _s;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ArbitratorUpdated(address arbitrator);
    event Configured(uint256 indexed jobId, bytes32 configHash, Mode mode, address arbitrator, address[] validators);
    event Approved(uint256 indexed jobId, address indexed client);
    event AutoReleased(uint256 indexed jobId, address indexed caller);
    event DisputeOpened(uint256 indexed jobId, bytes32 reasonHash, bytes32 evidenceHash);
    event RejectionAccepted(uint256 indexed jobId);
    event Contested(uint256 indexed jobId, bytes32 evidenceHash);
    event Voted(uint256 indexed jobId, address indexed decider, uint16 providerBps, bytes32 evidenceHash);
    event Settled(uint256 indexed jobId, uint16 providerBps, string how);

    error ZeroAddress();
    error NotClient();
    error NotProvider();
    error NotDecider();
    error BadState(State have);
    error BadKernelStatus(IAgentKernel.Status have);
    error NotThisEvaluator();
    error BadConfig();
    error WindowOpen();
    error WindowClosed();
    error AlreadyVoted();
    error ConflictOfInterest();
    error NotContested();
    error AlreadyContested();
    error BadBps();

    constructor(IAgentKernel kernel_, address arbitrator_, address owner_) Ownable(owner_) {
        if (address(kernel_) == address(0) || arbitrator_ == address(0)) revert ZeroAddress();
        kernel = kernel_;
        arbitrator = arbitrator_;
    }

    // ───────────── configuration ─────────────

    function setArbitrator(address a) external onlyOwner {
        if (a == address(0)) revert ZeroAddress();
        arbitrator = a;
        emit ArbitratorUpdated(a);
    }

    /// @notice Hash of every term a provider must accept. Offchain tools compute this to
    ///         build bids; JobBoard compares it at fund time.
    function computeConfigHash(Config calldata c, address arb) public pure returns (bytes32) {
        return keccak256(
            abi.encode(c.mode, c.reviewWindow, c.responseWindow, c.decisionWindow, c.timeoutProviderBps, c.validators, arb)
        );
    }

    function configHash(uint256 jobId) external view returns (bytes32) {
        return _s[jobId].configHash;
    }

    /// @notice Client sets the terms while the job is still Open. Immutable afterwards.
    function configure(uint256 jobId, Config calldata c) external {
        IAgentKernel.Job memory j = kernel.getJob(jobId);
        if (j.status != IAgentKernel.Status.Open) revert BadKernelStatus(j.status);
        if (j.evaluator != address(this)) revert NotThisEvaluator();
        if (msg.sender != j.client) revert NotClient();
        JobState storage s = _s[jobId];
        if (s.state != State.None) revert BadState(s.state);

        if (c.reviewWindow < MIN_WINDOW || c.reviewWindow > MAX_REVIEW) revert BadConfig();
        if (c.responseWindow < MIN_WINDOW || c.responseWindow > MAX_RESPONSE) revert BadConfig();
        if (c.decisionWindow < MIN_WINDOW || c.decisionWindow > MAX_DECISION) revert BadConfig();
        if (c.responseWindow > c.decisionWindow) revert BadConfig();
        if (c.timeoutProviderBps > 10_000) revert BadConfig();

        address arb = arbitrator;
        uint256 n = c.validators.length;
        if (c.mode == Mode.Client) {
            if (n != 0) revert BadConfig();
            s.deciders.push(arb);
        } else {
            if (c.mode == Mode.Validator ? n != 1 : (n != 3 && n != 5)) revert BadConfig();
            for (uint256 i = 0; i < n; i++) {
                address v = c.validators[i];
                if (v == address(0) || v == j.client || v == j.provider) revert BadConfig();
                for (uint256 k = 0; k < i; k++) {
                    if (c.validators[k] == v) revert BadConfig();
                }
                s.deciders.push(v);
            }
        }

        s.state = State.Configured;
        s.mode = c.mode;
        s.reviewWindow = c.reviewWindow;
        s.responseWindow = c.responseWindow;
        s.decisionWindow = c.decisionWindow;
        s.timeoutProviderBps = c.timeoutProviderBps;
        bytes32 h = computeConfigHash(c, arb);
        s.configHash = h;
        emit Configured(jobId, h, c.mode, arb, c.validators);
    }

    // ───────────── happy path ─────────────

    function approve(uint256 jobId) external nonReentrant {
        (IAgentKernel.Job memory j, JobState storage s) = _submitted(jobId);
        if (msg.sender != j.client) revert NotClient();
        if (s.state != State.Configured && s.state != State.Disputed) revert BadState(s.state);
        s.state = State.Settled;
        emit Approved(jobId, msg.sender);
        kernel.complete(jobId, keccak256("CLIENT_APPROVED"), "");
    }

    /// @notice Permissionless once the client's review window passes with no dispute.
    function autoRelease(uint256 jobId) external nonReentrant {
        (IAgentKernel.Job memory j, JobState storage s) = _submitted(jobId);
        if (s.state != State.Configured) revert BadState(s.state);
        if (block.timestamp < uint256(j.submittedAt) + s.reviewWindow) revert WindowOpen();
        s.state = State.Settled;
        emit AutoReleased(jobId, msg.sender);
        emit Settled(jobId, 10_000, "auto-release");
        kernel.complete(jobId, keccak256("AUTO_RELEASE"), "");
    }

    // ───────────── dispute path ─────────────

    /// @notice Client disputes inside the review window. This does NOT refund; it only
    ///         starts the response clock.
    function reject(uint256 jobId, bytes32 reasonHash, bytes32 evidenceHash) external nonReentrant {
        (IAgentKernel.Job memory j, JobState storage s) = _submitted(jobId);
        if (msg.sender != j.client) revert NotClient();
        if (s.state != State.Configured) revert BadState(s.state);
        if (block.timestamp >= uint256(j.submittedAt) + s.reviewWindow) revert WindowClosed();
        s.state = State.Disputed;
        s.disputedAt = uint64(block.timestamp);
        emit DisputeOpened(jobId, reasonHash, evidenceHash);
    }

    function acceptRejection(uint256 jobId) external nonReentrant {
        (IAgentKernel.Job memory j, JobState storage s) = _submitted(jobId);
        if (msg.sender != j.provider) revert NotProvider();
        if (s.state != State.Disputed) revert BadState(s.state);
        s.state = State.Settled;
        emit RejectionAccepted(jobId);
        emit Settled(jobId, 0, "provider-accepted");
        kernel.reject(jobId, keccak256("PROVIDER_ACCEPTED"), "");
    }

    function contest(uint256 jobId, bytes32 evidenceHash) external nonReentrant {
        (IAgentKernel.Job memory j, JobState storage s) = _submitted(jobId);
        if (msg.sender != j.provider) revert NotProvider();
        if (s.state != State.Disputed) revert BadState(s.state);
        if (s.contested) revert AlreadyContested();
        if (block.timestamp > uint256(s.disputedAt) + s.responseWindow) revert WindowClosed();
        s.contested = true;
        emit Contested(jobId, evidenceHash);
    }

    /// @notice Provider never contested: the rejection stands and the client is refunded.
    function finalizeUncontested(uint256 jobId) external nonReentrant {
        (, JobState storage s) = _submitted(jobId);
        if (s.state != State.Disputed) revert BadState(s.state);
        if (s.contested) revert AlreadyContested();
        if (block.timestamp <= uint256(s.disputedAt) + s.responseWindow) revert WindowOpen();
        s.state = State.Settled;
        emit Settled(jobId, 0, "uncontested");
        kernel.reject(jobId, keccak256("UNCONTESTED"), "");
    }

    /// @param providerBps share of the budget the provider should receive (0..10000).
    function vote(uint256 jobId, uint16 providerBps, bytes32 evidenceHash) external nonReentrant {
        (IAgentKernel.Job memory j, JobState storage s) = _submitted(jobId);
        if (s.state != State.Disputed) revert BadState(s.state);
        if (!s.contested) revert NotContested();
        if (block.timestamp > uint256(s.disputedAt) + s.decisionWindow) revert WindowClosed();
        if (providerBps > 10_000) revert BadBps();
        if (msg.sender == j.client || msg.sender == j.provider) revert ConflictOfInterest();
        if (!_isDecider(s, msg.sender)) revert NotDecider();
        if (hasVoted[jobId][msg.sender]) revert AlreadyVoted();

        hasVoted[jobId][msg.sender] = true;
        s.votes.push(providerBps);
        emit Voted(jobId, msg.sender, providerBps, evidenceHash);

        if (s.votes.length == s.deciders.length) {
            _settle(jobId, s, _median(s.votes), "decided");
        }
    }

    /// @notice After `decisionWindow`: majority median if enough votes, else the agreed default.
    function finalizeTimeout(uint256 jobId) external nonReentrant {
        (, JobState storage s) = _submitted(jobId);
        if (s.state != State.Disputed) revert BadState(s.state);
        if (!s.contested) revert NotContested();
        if (block.timestamp <= uint256(s.disputedAt) + s.decisionWindow) revert WindowOpen();
        if (s.votes.length * 2 > s.deciders.length) {
            _settle(jobId, s, _median(s.votes), "majority-timeout");
        } else {
            _settle(jobId, s, s.timeoutProviderBps, "default-timeout");
        }
    }

    // ───────────── views ─────────────

    function jobState(uint256 jobId)
        external
        view
        returns (State state, Mode mode, bool contested, uint64 disputedAt, address[] memory deciders, uint16[] memory votes)
    {
        JobState storage s = _s[jobId];
        return (s.state, s.mode, s.contested, s.disputedAt, s.deciders, s.votes);
    }

    // ───────────── internals ─────────────

    function _submitted(uint256 jobId) internal view returns (IAgentKernel.Job memory j, JobState storage s) {
        j = kernel.getJob(jobId);
        if (j.status != IAgentKernel.Status.Submitted) revert BadKernelStatus(j.status);
        s = _s[jobId];
        if (s.state == State.None) revert BadState(State.None);
    }

    function _settle(uint256 jobId, JobState storage s, uint16 bps, string memory how) internal {
        s.state = State.Settled;
        emit Settled(jobId, bps, how);
        if (bps == 10_000) {
            kernel.complete(jobId, keccak256(bytes(how)), "");
        } else if (bps == 0) {
            kernel.reject(jobId, keccak256(bytes(how)), "");
        } else {
            kernel.resolveSplit(jobId, bps, keccak256(bytes(how)));
        }
    }

    function _isDecider(JobState storage s, address who) internal view returns (bool) {
        uint256 n = s.deciders.length;
        for (uint256 i = 0; i < n; i++) {
            if (s.deciders[i] == who) return true;
        }
        return false;
    }

    /// @dev Lower median of a small array (<= 5). Odd length -> true median.
    function _median(uint16[] storage v) internal view returns (uint16) {
        uint256 n = v.length;
        uint16[] memory a = new uint16[](n);
        for (uint256 i = 0; i < n; i++) a[i] = v[i];
        for (uint256 i = 1; i < n; i++) {
            uint16 key = a[i];
            uint256 k = i;
            while (k > 0 && a[k - 1] > key) {
                a[k] = a[k - 1];
                k--;
            }
            a[k] = key;
        }
        return a[(n - 1) / 2];
    }
}

// ───────── 3. JobBoard ─────────

interface IEvaluatorRouterView {
    function configHash(uint256 jobId) external view returns (bytes32);
}

interface IOutcomeRecorder {
    function record(uint256 jobId, bytes4 selector, address client, address provider, uint128 budget, uint16 providerBps)
        external;
}

/// @title JobBoard
/// @notice Holds NO funds. Stores listings and bids, and acts as the ERC-8183 hook on kernel
///         jobs so the provider's bid is enforced atomically when the client funds:
///         the funded job's provider, price and evaluator terms must equal an active bid.
///         A client therefore cannot swap price or terms after an agent bids.
contract JobBoard is IACPHook, Ownable2Step {
    enum ListingStatus { None, Open, Filled, Cancelled }
    enum BidStatus { None, Active, Withdrawn, Accepted }

    struct Listing {
        address client;
        address invitee;      // address(0) = open to everyone
        uint128 maxBudget;
        uint64 biddingEnds;   // 0 = no deadline
        ListingStatus status;
        bytes32 specHash;     // hash of the acceptance criteria the evaluator judges against
        uint32 bidCount;
        uint256 jobId;        // set when filled
    }

    struct Bid {
        address provider;
        uint128 price;
        uint64 validUntil;
        BidStatus status;
        bytes32 evalConfigHash; // EvaluatorRouter config the provider accepts
    }

    IAgentKernel public immutable kernel;
    address public immutable router;
    IOutcomeRecorder public recorder; // optional reputation recorder (never blocks settlement)

    uint256 public listingCount;
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => mapping(uint256 => Bid)) public bids;
    mapping(uint256 => uint256) public listingOfJob; // jobId => listingId (0 = none)

    uint256 public constant RECORDER_GAS = 300_000;

    event ListingCreated(uint256 indexed listingId, address indexed client, bytes32 specHash, uint128 maxBudget, uint64 biddingEnds, address invitee, string uri);
    event ListingCancelled(uint256 indexed listingId);
    event BidPlaced(uint256 indexed listingId, uint256 indexed bidId, address indexed provider, uint128 price, bytes32 evalConfigHash, uint64 validUntil, string uri);
    event BidWithdrawn(uint256 indexed listingId, uint256 indexed bidId);
    event ListingFilled(uint256 indexed listingId, uint256 indexed bidId, uint256 indexed jobId);
    event RecorderUpdated(address recorder);

    error ZeroAddress();
    error NotKernel();
    error NotClient();
    error NotProvider();
    error BadListing();
    error BadBid();
    error BidClosed();
    error NotInvited();
    error TermsMismatch();

    constructor(IAgentKernel kernel_, address router_, address owner_) Ownable(owner_) {
        if (address(kernel_) == address(0) || router_ == address(0)) revert ZeroAddress();
        kernel = kernel_;
        router = router_;
    }

    modifier onlyKernel() {
        if (msg.sender != address(kernel)) revert NotKernel();
        _;
    }

    function setRecorder(address r) external onlyOwner {
        recorder = IOutcomeRecorder(r);
        emit RecorderUpdated(r);
    }

    // ───────────── listings and bids ─────────────

    function createListing(bytes32 specHash, uint128 maxBudget, uint64 biddingEnds, address invitee, string calldata uri)
        external
        returns (uint256 listingId)
    {
        if (specHash == bytes32(0) || maxBudget == 0) revert BadListing();
        if (biddingEnds != 0 && biddingEnds <= block.timestamp) revert BadListing();
        if (invitee == msg.sender) revert BadListing();
        listingId = ++listingCount;
        Listing storage l = listings[listingId];
        l.client = msg.sender;
        l.invitee = invitee;
        l.maxBudget = maxBudget;
        l.biddingEnds = biddingEnds;
        l.status = ListingStatus.Open;
        l.specHash = specHash;
        emit ListingCreated(listingId, msg.sender, specHash, maxBudget, biddingEnds, invitee, uri);
    }

    function cancelListing(uint256 listingId) external {
        Listing storage l = listings[listingId];
        if (l.status != ListingStatus.Open) revert BadListing();
        if (msg.sender != l.client) revert NotClient();
        l.status = ListingStatus.Cancelled;
        emit ListingCancelled(listingId);
    }

    function placeBid(uint256 listingId, uint128 price, bytes32 evalConfigHash, uint64 validUntil, string calldata uri)
        external
        returns (uint256 bidId)
    {
        Listing storage l = listings[listingId];
        if (l.status != ListingStatus.Open) revert BadListing();
        if (msg.sender == l.client) revert BadBid();
        if (l.invitee != address(0) && l.invitee != msg.sender) revert NotInvited();
        if (l.biddingEnds != 0 && block.timestamp > l.biddingEnds) revert BidClosed();
        if (price == 0 || price > l.maxBudget) revert BadBid();
        if (evalConfigHash == bytes32(0) || validUntil <= block.timestamp) revert BadBid();

        bidId = l.bidCount++;
        bids[listingId][bidId] = Bid(msg.sender, price, validUntil, BidStatus.Active, evalConfigHash);
        emit BidPlaced(listingId, bidId, msg.sender, price, evalConfigHash, validUntil, uri);
    }

    function withdrawBid(uint256 listingId, uint256 bidId) external {
        Bid storage b = bids[listingId][bidId];
        if (b.status != BidStatus.Active) revert BadBid();
        if (msg.sender != b.provider) revert NotProvider();
        b.status = BidStatus.Withdrawn;
        emit BidWithdrawn(listingId, bidId);
    }

    // ───────────── ERC-8183 hook ─────────────

    /// @dev Called by the kernel inside `fund`. optParams = abi.encode(listingId, bidId).
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external onlyKernel {
        if (selector != IAgentKernel.fund.selector) return;

        (uint256 listingId, uint256 bidId) = abi.decode(data, (uint256, uint256));
        IAgentKernel.Job memory j = kernel.getJob(jobId);
        Listing storage l = listings[listingId];
        Bid storage b = bids[listingId][bidId];

        if (l.status != ListingStatus.Open || listingOfJob[jobId] != 0) revert BadListing();
        if (b.status != BidStatus.Active || block.timestamp > b.validUntil) revert BadBid();
        if (
            l.client != j.client || b.provider != j.provider || b.price != j.budget || j.evaluator != router
                || IEvaluatorRouterView(router).configHash(jobId) != b.evalConfigHash
        ) revert TermsMismatch();

        l.status = ListingStatus.Filled;
        l.jobId = jobId;
        b.status = BidStatus.Accepted;
        listingOfJob[jobId] = listingId;
        emit ListingFilled(listingId, bidId, jobId);
    }

    function afterAction(uint256 jobId, bytes4 selector, bytes calldata data) external onlyKernel {
        IOutcomeRecorder r = recorder;
        if (address(r) == address(0)) return;
        if (
            selector != IAgentKernel.complete.selector && selector != IAgentKernel.reject.selector
                && selector != IAgentKernel.resolveSplit.selector
        ) return;

        IAgentKernel.Job memory j = kernel.getJob(jobId);
        uint16 bps = selector == IAgentKernel.complete.selector ? 10_000 : 0;
        if (selector == IAgentKernel.resolveSplit.selector) (bps,) = abi.decode(data, (uint16, bytes32));
        if (listingOfJob[jobId] == 0) return; // only record board jobs
        try r.record{gas: RECORDER_GAS}(jobId, selector, j.client, j.provider, j.budget, bps) {} catch {}
    }
}

