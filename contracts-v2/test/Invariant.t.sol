// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {AgentKernel} from "../src/AgentKernel.sol";
import {IAgentKernel} from "../src/interfaces/IAgentKernel.sol";

/// @dev Random walk over the kernel lifecycle (including blocklisting and expiry).
contract KernelHandler is Test {
    AgentKernel public kernel;
    MockUSDC public usdc;
    address public evaluator = address(0xE7A1);
    address public treasury;
    address[3] public clients = [address(0xC1), address(0xC2), address(0xC3)];
    address[3] public providers = [address(0xA1), address(0xA2), address(0xA3)];
    uint256[] public ids;

    constructor(AgentKernel k, MockUSDC u, address t) {
        kernel = k; usdc = u; treasury = t;
        for (uint256 i = 0; i < 3; i++) {
            usdc.mint(clients[i], 1e15);
            vm.prank(clients[i]);
            usdc.approve(address(kernel), type(uint256).max);
        }
    }

    function open(uint256 c, uint256 p, uint128 budget) external {
        c %= 3; p %= 3;
        budget = uint128(bound(budget, 1e6, 1_000e6));
        if (usdc.blocked(clients[c])) return; // a blocklisted client cannot fund (covered elsewhere)
        vm.startPrank(clients[c]);
        uint256 id = kernel.createJob(providers[p], evaluator, block.timestamp + 10 days, "i", address(0));
        kernel.setBudget(id, budget, "");
        kernel.fund(id, budget, "");
        vm.stopPrank();
        ids.push(id);
    }

    function submit(uint256 i) external {
        if (ids.length == 0) return;
        uint256 id = ids[i % ids.length];
        IAgentKernel.Job memory j = kernel.getJob(id);
        if (j.status != IAgentKernel.Status.Funded || block.timestamp >= j.expiredAt) return;
        vm.prank(j.provider);
        kernel.submit(id, keccak256("w"), "");
    }

    function complete(uint256 i) external { _eval(i, 0, 0); }
    function reject(uint256 i) external { _eval(i, 1, 0); }
    function split(uint256 i, uint16 bps) external { _eval(i, 2, uint16(bound(bps, 1, 9_999))); }

    function _eval(uint256 i, uint8 kind, uint16 bps) internal {
        if (ids.length == 0) return;
        uint256 id = ids[i % ids.length];
        IAgentKernel.Job memory j = kernel.getJob(id);
        if (j.status != IAgentKernel.Status.Submitted && !(kind == 1 && j.status == IAgentKernel.Status.Funded)) return;
        vm.prank(evaluator);
        if (kind == 0) kernel.complete(id, bytes32(0), "");
        else if (kind == 1) kernel.reject(id, bytes32(0), "");
        else kernel.resolveSplit(id, bps, bytes32(0));
    }

    function expire(uint256 i) external {
        if (ids.length == 0) return;
        uint256 id = ids[i % ids.length];
        IAgentKernel.Job memory j = kernel.getJob(id);
        if (j.status != IAgentKernel.Status.Funded && j.status != IAgentKernel.Status.Submitted) return;
        vm.warp(j.expiredAt);
        kernel.claimRefund(id);
    }

    function block_(uint256 who, bool on) external {
        who %= 6;
        address a = who < 3 ? clients[who] : providers[who - 3];
        usdc.setBlocked(a, on);
    }

    function claim(uint256 who) external {
        who %= 6;
        address a = who < 3 ? clients[who] : providers[who - 3];
        if (kernel.claimable(a) == 0 || usdc.blocked(a)) return;
        vm.prank(a);
        kernel.withdrawClaimable(a);
    }

    function warp(uint256 dt) external { vm.warp(block.timestamp + bound(dt, 0, 5 days)); }

    function idCount() external view returns (uint256) { return ids.length; }

    function escrowedAndClaimable() external view returns (uint256 total) {
        for (uint256 i = 0; i < ids.length; i++) {
            IAgentKernel.Job memory j = kernel.getJob(ids[i]);
            if (j.status == IAgentKernel.Status.Funded || j.status == IAgentKernel.Status.Submitted) total += j.budget;
        }
        for (uint256 i = 0; i < 3; i++) total += kernel.claimable(clients[i]) + kernel.claimable(providers[i]);
        total += kernel.claimable(treasury) + kernel.claimable(evaluator);
    }
}

contract KernelInvariantTest is StdInvariant, Test {
    KernelHandler h;
    AgentKernel kernel;
    MockUSDC usdc;

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        address treasury = address(0x7EA5);
        kernel = new AgentKernel(usdc, treasury, address(this), 1e6, 1_000e6);
        h = new KernelHandler(kernel, usdc, treasury);
        targetContract(address(h));
    }

    /// @notice Every USDC unit in the kernel is either an open job's budget or a claimable credit.
    function invariant_kernelBalanceEqualsEscrowPlusClaimable() public view {
        assertEq(usdc.balanceOf(address(kernel)), h.escrowedAndClaimable());
    }

    function invariant_noFundsCreatedOrDestroyed() public view {
        // total supply is constant after setup; kernel + all participants hold all of it
        uint256 sum = usdc.balanceOf(address(kernel)) + usdc.balanceOf(address(0x7EA5));
        for (uint256 i = 0; i < 3; i++) sum += usdc.balanceOf(h.clients(i)) + usdc.balanceOf(h.providers(i));
        assertEq(sum, usdc.totalSupply());
    }
}
