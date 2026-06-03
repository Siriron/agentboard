// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentEscrow
 * @notice ERC-8183 compatible job escrow for AgentBoard on Arc Testnet.
 * @dev Chain ID: 5042002 | Gas: USDC
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IIdentityRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract AgentEscrow {

    IERC20 public immutable USDC;
    IIdentityRegistry public immutable IDENTITY_REGISTRY;

    uint256 public constant PLATFORM_FEE_BPS = 100;
    uint256 public constant BPS = 10000;
    uint256 public constant MAX_BIDS = 10;
    uint256 public constant EXPIRY = 30 days;

    address public owner;
    address public feeRecipient;
    uint256 public jobCount;
    uint256 public collectedFees;

    enum JobStatus { OPEN, HIRED, SUBMITTED, VALIDATED, DISPUTED, CANCELLED, EXPIRED }

    // Split into two structs to avoid stack too deep
    struct JobCore {
        address client;
        address hiredAgent;
        address validator;
        uint256 budget;
        uint256 deadline;
        uint256 postedAt;
        uint256 expiresAt;
        uint256 hiredAgentId;
        uint256 bidCount;
        JobStatus status;
    }

    struct JobMeta {
        string title;
        string description;
        string category;
        string deliverableURI;
        string resultNotes;
    }

    struct Bid {
        address agent;
        uint256 agentId;
        uint256 proposedAmount;
        uint256 deliveryDays;
        uint256 submittedAt;
        string proposal;
        bool withdrawn;
    }

    mapping(uint256 => JobCore) public jobCore;
    mapping(uint256 => JobMeta) public jobMeta;
    mapping(uint256 => Bid[]) public jobBids;
    mapping(address => uint256[]) public clientJobs;
    mapping(address => uint256[]) public agentJobs;
    mapping(address => bool) public registeredValidators;
    mapping(uint256 => bool) public agentIdRegistered;

    event JobPosted(uint256 indexed jobId, address indexed client, string title, uint256 budget);
    event BidSubmitted(uint256 indexed jobId, address indexed agent, uint256 agentId, uint256 amount);
    event AgentHired(uint256 indexed jobId, address indexed agent, uint256 amount);
    event WorkSubmitted(uint256 indexed jobId, address indexed agent, string uri);
    event JobValidated(uint256 indexed jobId, address indexed agent, uint256 payout);
    event JobDisputed(uint256 indexed jobId, address indexed client);
    event DisputeResolved(uint256 indexed jobId, address recipient, uint256 amount);
    event JobCancelled(uint256 indexed jobId);
    event JobExpired(uint256 indexed jobId);
    event BidWithdrawn(uint256 indexed jobId, address indexed agent);
    event AgentRegistered(address indexed agent, uint256 agentId);
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);

    error Unauthorized();
    error InvalidState();
    error InvalidInput();
    error PaymentFailed();
    error NotRegistered();
    error BidInvalid();

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier exists(uint256 id) { require(id > 0 && id <= jobCount, "No job"); _; }

    constructor(address _usdc, address _identityRegistry, address _feeRecipient) {
        USDC = IERC20(_usdc);
        IDENTITY_REGISTRY = IIdentityRegistry(_identityRegistry);
        owner = msg.sender;
        feeRecipient = _feeRecipient;
        registeredValidators[msg.sender] = true;
    }

    function registerAgent(uint256 agentId) external {
        require(IDENTITY_REGISTRY.ownerOf(agentId) == msg.sender, "Not owner");
        agentIdRegistered[agentId] = true;
        emit AgentRegistered(msg.sender, agentId);
    }

    function postJob(
        string calldata title,
        string calldata description,
        string calldata category,
        uint256 budget,
        uint256 deadline
    ) external returns (uint256 jobId) {
        require(budget > 0, "Budget zero");
        require(deadline > block.timestamp, "Bad deadline");
        require(USDC.transferFrom(msg.sender, address(this), budget), "Transfer failed");

        jobId = ++jobCount;

        jobCore[jobId] = JobCore({
            client: msg.sender,
            hiredAgent: address(0),
            validator: address(0),
            budget: budget,
            deadline: deadline,
            postedAt: block.timestamp,
            expiresAt: block.timestamp + EXPIRY,
            hiredAgentId: 0,
            bidCount: 0,
            status: JobStatus.OPEN
        });

        jobMeta[jobId] = JobMeta({
            title: title,
            description: description,
            category: category,
            deliverableURI: "",
            resultNotes: ""
        });

        clientJobs[msg.sender].push(jobId);
        emit JobPosted(jobId, msg.sender, title, budget);
    }

    function submitBid(
        uint256 jobId,
        uint256 agentId,
        uint256 proposedAmount,
        string calldata proposal,
        uint256 deliveryDays
    ) external exists(jobId) {
        JobCore storage jc = jobCore[jobId];
        require(jc.status == JobStatus.OPEN, "Not open");
        require(block.timestamp <= jc.expiresAt, "Expired");
        require(msg.sender != jc.client, "Is client");
        require(proposedAmount > 0 && proposedAmount <= jc.budget, "Bad amount");
        require(agentIdRegistered[agentId], "Agent not registered");
        require(IDENTITY_REGISTRY.ownerOf(agentId) == msg.sender, "Not agent owner");

        Bid[] storage bids = jobBids[jobId];
        require(bids.length < MAX_BIDS, "Max bids");
        for (uint256 i = 0; i < bids.length; i++) {
            require(!(bids[i].agent == msg.sender && !bids[i].withdrawn), "Already bid");
        }

        bids.push(Bid({
            agent: msg.sender,
            agentId: agentId,
            proposedAmount: proposedAmount,
            deliveryDays: deliveryDays,
            submittedAt: block.timestamp,
            proposal: proposal,
            withdrawn: false
        }));

        jc.bidCount++;
        emit BidSubmitted(jobId, msg.sender, agentId, proposedAmount);
    }

    function withdrawBid(uint256 jobId) external exists(jobId) {
        require(jobCore[jobId].status == JobStatus.OPEN, "Not open");
        Bid[] storage bids = jobBids[jobId];
        for (uint256 i = 0; i < bids.length; i++) {
            if (bids[i].agent == msg.sender) {
                require(!bids[i].withdrawn, "Already withdrawn");
                bids[i].withdrawn = true;
                jobCore[jobId].bidCount--;
                emit BidWithdrawn(jobId, msg.sender);
                return;
            }
        }
        revert("Bid not found");
    }

    function hireAgent(uint256 jobId, uint256 bidIndex, address validator) external exists(jobId) {
        JobCore storage jc = jobCore[jobId];
        require(msg.sender == jc.client, "Not client");
        require(jc.status == JobStatus.OPEN, "Not open");
        require(registeredValidators[validator], "Bad validator");

        Bid storage bid = jobBids[jobId][bidIndex];
        require(!bid.withdrawn, "Bid withdrawn");

        uint256 excess = jc.budget - bid.proposedAmount;
        if (excess > 0) require(USDC.transfer(jc.client, excess), "Refund failed");

        jc.hiredAgent = bid.agent;
        jc.hiredAgentId = bid.agentId;
        jc.validator = validator;
        jc.budget = bid.proposedAmount;
        jc.status = JobStatus.HIRED;

        agentJobs[bid.agent].push(jobId);
        emit AgentHired(jobId, bid.agent, bid.proposedAmount);
    }

    function submitWork(uint256 jobId, string calldata uri) external exists(jobId) {
        JobCore storage jc = jobCore[jobId];
        require(msg.sender == jc.hiredAgent, "Not agent");
        require(jc.status == JobStatus.HIRED, "Not hired");
        jobMeta[jobId].deliverableURI = uri;
        jc.status = JobStatus.SUBMITTED;
        emit WorkSubmitted(jobId, msg.sender, uri);
    }

    function validateAndRelease(uint256 jobId, string calldata notes) external exists(jobId) {
        JobCore storage jc = jobCore[jobId];
        require(msg.sender == jc.validator, "Not validator");
        require(jc.status == JobStatus.SUBMITTED, "Not submitted");

        uint256 fee = (jc.budget * PLATFORM_FEE_BPS) / BPS;
        uint256 payout = jc.budget - fee;
        collectedFees += fee;
        jobMeta[jobId].resultNotes = notes;
        jc.status = JobStatus.VALIDATED;

        require(USDC.transfer(jc.hiredAgent, payout), "Payment failed");
        emit JobValidated(jobId, jc.hiredAgent, payout);
    }

    function raiseDispute(uint256 jobId, string calldata reason) external exists(jobId) {
        JobCore storage jc = jobCore[jobId];
        require(msg.sender == jc.client, "Not client");
        require(jc.status == JobStatus.SUBMITTED, "Not submitted");
        jc.status = JobStatus.DISPUTED;
        jobMeta[jobId].resultNotes = reason;
        emit JobDisputed(jobId, msg.sender);
    }

    function resolveDispute(uint256 jobId, bool toAgent, string calldata notes) external exists(jobId) onlyOwner {
        JobCore storage jc = jobCore[jobId];
        require(jc.status == JobStatus.DISPUTED, "Not disputed");

        uint256 amount = jc.budget;
        address recipient = toAgent ? jc.hiredAgent : jc.client;

        if (toAgent) {
            uint256 fee = (amount * PLATFORM_FEE_BPS) / BPS;
            collectedFees += fee;
            amount -= fee;
        }

        jc.status = JobStatus.VALIDATED;
        jobMeta[jobId].resultNotes = notes;
        require(USDC.transfer(recipient, amount), "Payment failed");
        emit DisputeResolved(jobId, recipient, amount);
    }

    function cancelJob(uint256 jobId) external exists(jobId) {
        JobCore storage jc = jobCore[jobId];
        require(msg.sender == jc.client, "Not client");
        require(jc.status == JobStatus.OPEN, "Not open");
        jc.status = JobStatus.CANCELLED;
        require(USDC.transfer(jc.client, jc.budget), "Refund failed");
        emit JobCancelled(jobId);
    }

    function expireJob(uint256 jobId) external exists(jobId) {
        JobCore storage jc = jobCore[jobId];
        require(block.timestamp > jc.expiresAt, "Not expired");
        require(jc.status == JobStatus.OPEN, "Not open");
        jc.status = JobStatus.EXPIRED;
        require(USDC.transfer(jc.client, jc.budget), "Refund failed");
        emit JobExpired(jobId);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function addValidator(address v) external onlyOwner {
        registeredValidators[v] = true;
        emit ValidatorAdded(v);
    }

    function removeValidator(address v) external onlyOwner {
        registeredValidators[v] = false;
        emit ValidatorRemoved(v);
    }

    function withdrawFees() external onlyOwner {
        uint256 amt = collectedFees;
        collectedFees = 0;
        require(USDC.transfer(feeRecipient, amt), "Failed");
    }

    function setFeeRecipient(address r) external onlyOwner { feeRecipient = r; }
    function transferOwnership(address n) external onlyOwner { owner = n; }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getJobCore(uint256 jobId) external view returns (JobCore memory) { return jobCore[jobId]; }
    function getJobMeta(uint256 jobId) external view returns (JobMeta memory) { return jobMeta[jobId]; }
    function getJobBids(uint256 jobId) external view returns (Bid[] memory) { return jobBids[jobId]; }
    function getClientJobs(address client) external view returns (uint256[] memory) { return clientJobs[client]; }
    function getAgentJobs(address agent) external view returns (uint256[] memory) { return agentJobs[agent]; }
    function isValidator(address addr) external view returns (bool) { return registeredValidators[addr]; }
}
