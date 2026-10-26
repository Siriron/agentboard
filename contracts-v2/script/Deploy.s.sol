// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AgentKernel} from "../src/AgentKernel.sol";
import {EvaluatorRouter} from "../src/EvaluatorRouter.sol";
import {JobBoard} from "../src/JobBoard.sol";
import {IAgentKernel} from "../src/interfaces/IAgentKernel.sol";

/// @notice Same script for testnet rehearsal and mainnet; parametrized by env.
///
///   export OWNER=0x...        # final owner (use a multisig on mainnet)
///   export TREASURY=0x...
///   export ARBITRATOR=0x...   # multisig that rules Client-mode disputes
///   export MIN_BUDGET=1000000          # 1 USDC (6 decimals)
///   export MAX_BUDGET=100000000        # launch cap: 100 USDC per job
///
///   Dedicated deployer from an encrypted keystore (never a raw key):
///   forge script script/Deploy.s.sol --rpc-url $RPC --account deployer --broadcast \
///       --priority-gas-price 1000000000 --with-gas-price 20000000000   # check flag names for your Foundry version
///
/// `maxFeePerGas` must be >= 20 gwei on Arc or the transaction is silently dropped.
/// Ownership is handed over with Ownable2Step: the OWNER must call acceptOwnership() on
/// each contract afterwards.
contract Deploy is Script {
    address constant USDC = 0x3600000000000000000000000000000000000000; // ERC-20 view, 6 decimals

    function run() external {
        address owner = vm.envAddress("OWNER");
        address treasury = vm.envAddress("TREASURY");
        address arbitrator = vm.envAddress("ARBITRATOR");
        uint128 minBudget = uint128(vm.envUint("MIN_BUDGET"));
        uint128 maxBudget = uint128(vm.envUint("MAX_BUDGET"));
        require(block.chainid == 5042 || block.chainid == 5042002, "not an Arc chain");

        vm.startBroadcast();
        address deployer = msg.sender;

        AgentKernel kernel = new AgentKernel(IERC20(USDC), treasury, deployer, minBudget, maxBudget);
        EvaluatorRouter router = new EvaluatorRouter(IAgentKernel(address(kernel)), arbitrator, deployer);
        JobBoard board = new JobBoard(IAgentKernel(address(kernel)), address(router), deployer);
        kernel.setHookAllowed(address(board), true);

        if (owner != deployer) {
            kernel.transferOwnership(owner);
            router.transferOwnership(owner);
            board.transferOwnership(owner);
        }
        vm.stopBroadcast();

        console2.log("chainid      ", block.chainid);
        console2.log("AgentKernel  ", address(kernel));
        console2.log("EvaluatorRouter", address(router));
        console2.log("JobBoard     ", address(board));
        console2.log("Pending owner (must acceptOwnership):", owner);
    }
}
