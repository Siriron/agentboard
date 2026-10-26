// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice ERC-8183 hook interface. VERIFY selector/data encodings against the EIP
///         text and Arc's testnet reference (0x0747…4583) before mainnet.
interface IACPHook {
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
    function afterAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
}
