// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev 6-decimal USDC stand-in with an Arc-style blocklist: any transfer to or from a
///      blocklisted address reverts. Does NOT reproduce native-value rules; run the suite
///      on arc-forge / arc-anvil for those.
contract MockUSDC is ERC20 {
    mapping(address => bool) public blocked;

    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amt) external { _mint(to, amt); }
    function setBlocked(address a, bool b) external { blocked[a] = b; }

    function _update(address from, address to, uint256 value) internal override {
        require(!blocked[from] && !blocked[to], "blocklisted");
        super._update(from, to, value);
    }
}
