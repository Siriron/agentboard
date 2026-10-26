// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

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
