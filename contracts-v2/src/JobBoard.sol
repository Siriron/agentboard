// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IACPHook} from "./interfaces/IACPHook.sol";
import {IAgentKernel} from "./interfaces/IAgentKernel.sol";

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
