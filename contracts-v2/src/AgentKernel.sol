// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IACPHook} from "./interfaces/IACPHook.sol";
import {IAgentKernel} from "./interfaces/IAgentKernel.sol";

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
