// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAgentKernel} from "./interfaces/IAgentKernel.sol";

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
