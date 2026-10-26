// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IACPHook} from "../../src/interfaces/IACPHook.sol";
import {IAgentKernel} from "../../src/interfaces/IAgentKernel.sol";

contract RevertingHook is IACPHook {
    function beforeAction(uint256, bytes4, bytes calldata) external pure { revert("nope"); }
    function afterAction(uint256, bytes4, bytes calldata) external pure { revert("nope"); }
}

contract GasBombHook is IACPHook {
    uint256 public x;
    function beforeAction(uint256, bytes4, bytes calldata) external { while (true) { x++; } }
    function afterAction(uint256, bytes4, bytes calldata) external { while (true) { x++; } }
}

contract ReentrantHook is IACPHook {
    IAgentKernel public kernel;
    uint256 public attempts;
    constructor(IAgentKernel k) { kernel = k; }
    function beforeAction(uint256, bytes4, bytes calldata) external {}
    function afterAction(uint256 jobId, bytes4, bytes calldata) external {
        attempts++;
        kernel.complete(jobId, bytes32(0), ""); // must fail: nonReentrant (and not evaluator)
    }
}

contract RevertingRecorder {
    function record(uint256, bytes4, address, address, uint128, uint16) external pure { revert("rec"); }
}

contract CountingRecorder {
    uint256 public calls;
    uint16 public lastBps;
    address public lastProvider;
    function record(uint256, bytes4, address, address provider, uint128, uint16 bps) external {
        calls++; lastBps = bps; lastProvider = provider;
    }
}
