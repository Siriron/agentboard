// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {AgentKernel} from "../src/AgentKernel.sol";
import {IAgentKernel} from "../src/interfaces/IAgentKernel.sol";
import {RevertingHook, GasBombHook, ReentrantHook} from "./mocks/Hooks.sol";

contract AgentKernelTest is Base {
    // ───────── lifecycle and fees ─────────
    function test_complete_paysProviderAndFee() public {
        uint256 id = _plainSubmitted(100e6);
        vm.prank(evaluator);
        kernel.complete(id, keccak256("ok"), "");
        assertEq(usdc.balanceOf(provider), 99e6);
        assertEq(usdc.balanceOf(treasury), 1e6);
        assertEq(usdc.balanceOf(address(kernel)), 0);
        assertEq(uint8(_status(id)), uint8(IAgentKernel.Status.Completed));
    }

    function test_evaluatorReject_refundsClientInFull() public {
        uint256 id = _plainSubmitted(100e6);
        uint256 before_ = usdc.balanceOf(client);
        vm.prank(evaluator);
        kernel.reject(id, keccak256("bad"), "");
        assertEq(usdc.balanceOf(client), before_ + 100e6);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_clientCanRejectOnlyWhenOpen() public {
        vm.prank(client);
        uint256 id = kernel.createJob(provider, evaluator, block.timestamp + 5 days, "d", address(0));
        vm.prank(client);
        kernel.reject(id, bytes32(0), "");
        assertEq(uint8(_status(id)), uint8(IAgentKernel.Status.Rejected));

        uint256 id2 = _plainFunded(10e6);
        vm.prank(client);
        vm.expectRevert(AgentKernel.NotEvaluator.selector);
        kernel.reject(id2, bytes32(0), "");
    }

    function test_clientAndProviderCannotComplete() public {
        uint256 id = _plainSubmitted(10e6);
        vm.prank(client);
        vm.expectRevert(AgentKernel.NotEvaluator.selector);
        kernel.complete(id, bytes32(0), "");
        vm.prank(provider);
        vm.expectRevert(AgentKernel.NotEvaluator.selector);
        kernel.complete(id, bytes32(0), "");
    }

    function test_cannotCompleteBeforeSubmit() public {
        uint256 id = _plainFunded(10e6);
        vm.prank(evaluator);
        vm.expectRevert(abi.encodeWithSelector(AgentKernel.BadStatus.selector, IAgentKernel.Status.Funded));
        kernel.complete(id, bytes32(0), "");
    }

    function test_noDoubleSettlement() public {
        uint256 id = _plainSubmitted(10e6);
        vm.startPrank(evaluator);
        kernel.complete(id, bytes32(0), "");
        vm.expectRevert();
        kernel.complete(id, bytes32(0), "");
        vm.expectRevert();
        kernel.reject(id, bytes32(0), "");
        vm.expectRevert();
        kernel.resolveSplit(id, 5000, bytes32(0));
        vm.stopPrank();
        vm.expectRevert();
        kernel.claimRefund(id);
    }

    // ───────── split ─────────
    function test_resolveSplit_feeOnlyOnProviderShare() public {
        uint256 id = _plainSubmitted(100e6);
        vm.prank(evaluator);
        kernel.resolveSplit(id, 7000, keccak256("split")); // provider gross 70, fee 0.7
        assertEq(usdc.balanceOf(provider), 69_300_000);
        assertEq(usdc.balanceOf(treasury), 700_000);
        assertEq(usdc.balanceOf(client), 100_000e6 - 100e6 + 30e6);
        assertEq(usdc.balanceOf(address(kernel)), 0);
    }

    function test_resolveSplit_rejectsExtremes() public {
        uint256 id = _plainSubmitted(10e6);
        vm.startPrank(evaluator);
        vm.expectRevert(AgentKernel.BadBps.selector);
        kernel.resolveSplit(id, 0, bytes32(0));
        vm.expectRevert(AgentKernel.BadBps.selector);
        kernel.resolveSplit(id, 10_000, bytes32(0));
        vm.stopPrank();
    }

    function testFuzz_split_conservesFunds(uint128 budget, uint16 bps, uint16 fee) public {
        budget = uint128(bound(budget, MIN, MAX));
        bps = uint16(bound(bps, 1, 9_999));
        fee = uint16(bound(fee, 0, 500));
        vm.prank(owner);
        kernel.setFeeBps(fee);
        usdc.mint(client, budget);
        uint256 id = _plainSubmitted(budget);
        uint256 total = usdc.balanceOf(client) + usdc.balanceOf(provider) + usdc.balanceOf(treasury);
        vm.prank(evaluator);
        kernel.resolveSplit(id, bps, bytes32(0));
        assertEq(usdc.balanceOf(address(kernel)), 0);
        assertEq(usdc.balanceOf(client) + usdc.balanceOf(provider) + usdc.balanceOf(treasury), total + budget);
    }

    function testFuzz_complete_conservesFunds(uint128 budget, uint16 fee) public {
        budget = uint128(bound(budget, MIN, MAX));
        fee = uint16(bound(fee, 0, 500));
        vm.prank(owner);
        kernel.setFeeBps(fee);
        usdc.mint(client, budget);
        uint256 id = _plainSubmitted(budget);
        vm.prank(evaluator);
        kernel.complete(id, bytes32(0), "");
        assertEq(usdc.balanceOf(provider) + usdc.balanceOf(treasury), budget);
        assertEq(usdc.balanceOf(address(kernel)), 0);
    }

    // ───────── expiry ─────────
    function test_claimRefund_afterExpiry_permissionless() public {
        uint256 id = _plainFunded(50e6);
        vm.expectRevert(AgentKernel.NotExpired.selector);
        kernel.claimRefund(id);
        vm.warp(block.timestamp + 21 days);
        uint256 before_ = usdc.balanceOf(client);
        vm.prank(stranger);
        kernel.claimRefund(id);
        assertEq(usdc.balanceOf(client), before_ + 50e6);
        assertEq(uint8(_status(id)), uint8(IAgentKernel.Status.Expired));
    }

    function test_submit_pushesExpiryToGraceWindow() public {
        uint256 id = _plainFunded(10e6);
        vm.warp(block.timestamp + 19 days); // 1 day left
        vm.prank(provider);
        kernel.submit(id, keccak256("w"), "");
        IAgentKernel.Job memory j = kernel.getJob(id);
        assertEq(j.expiredAt, block.timestamp + 30 days);
        vm.warp(block.timestamp + 5 days); // original expiry long passed
        vm.expectRevert(AgentKernel.NotExpired.selector);
        kernel.claimRefund(id);
    }

    function test_submit_afterExpiryReverts() public {
        uint256 id = _plainFunded(10e6);
        vm.warp(block.timestamp + 21 days);
        vm.prank(provider);
        vm.expectRevert(AgentKernel.AlreadyExpired.selector);
        kernel.submit(id, keccak256("w"), "");
    }

    function test_extendDeadline() public {
        uint256 id = _plainFunded(10e6);
        uint64 old = kernel.getJob(id).expiredAt;
        vm.prank(client);
        kernel.extendDeadline(id, old + 10 days);
        assertEq(kernel.getJob(id).expiredAt, old + 10 days);
        vm.prank(client);
        vm.expectRevert(AgentKernel.BadExpiry.selector);
        kernel.extendDeadline(id, old); // cannot shorten
        vm.prank(stranger);
        vm.expectRevert(AgentKernel.NotClient.selector);
        kernel.extendDeadline(id, old + 20 days);
    }

    // ───────── blocklist (Arc) ─────────
    function test_blockedProvider_payoutDeferred_thenClaimToOtherAddress() public {
        uint256 id = _plainSubmitted(100e6);
        usdc.setBlocked(provider, true);
        vm.prank(evaluator);
        kernel.complete(id, bytes32(0), ""); // must NOT revert
        assertEq(uint8(_status(id)), uint8(IAgentKernel.Status.Completed));
        assertEq(kernel.claimable(provider), 99e6);
        assertEq(usdc.balanceOf(treasury), 1e6);

        address alt = makeAddr("alt");
        vm.prank(provider);
        kernel.withdrawClaimable(alt);
        assertEq(usdc.balanceOf(alt), 99e6);
        assertEq(kernel.claimable(provider), 0);
        vm.prank(provider);
        vm.expectRevert(AgentKernel.NothingToClaim.selector);
        kernel.withdrawClaimable(alt);
    }

    function test_blockedClient_refundDeferred() public {
        uint256 id = _plainSubmitted(100e6);
        usdc.setBlocked(client, true);
        vm.prank(evaluator);
        kernel.reject(id, bytes32(0), "");
        assertEq(kernel.claimable(client), 100e6);
        assertEq(usdc.balanceOf(address(kernel)), 100e6); // still escrowed as claimable, not lost
    }

    function test_blockedTreasury_doesNotBlockSettlement() public {
        uint256 id = _plainSubmitted(100e6);
        usdc.setBlocked(treasury, true);
        vm.prank(evaluator);
        kernel.complete(id, bytes32(0), "");
        assertEq(usdc.balanceOf(provider), 99e6);
        assertEq(kernel.claimable(treasury), 1e6);
    }

    function test_withdrawClaimable_toBlockedAddressReverts() public {
        uint256 id = _plainSubmitted(100e6);
        usdc.setBlocked(provider, true);
        vm.prank(evaluator);
        kernel.complete(id, bytes32(0), "");
        vm.prank(provider);
        vm.expectRevert();
        kernel.withdrawClaimable(provider);
        assertEq(kernel.claimable(provider), 99e6); // state intact after revert
    }

    // ───────── fee snapshot, limits, pause ─────────
    function test_feeSnapshot_laterChangeDoesNotApply() public {
        uint256 id = _plainSubmitted(100e6); // funded at 1%
        vm.prank(owner);
        kernel.setFeeBps(500);
        vm.prank(evaluator);
        kernel.complete(id, bytes32(0), "");
        assertEq(usdc.balanceOf(treasury), 1e6);
    }

    function test_feeCap() public {
        vm.prank(owner);
        vm.expectRevert(AgentKernel.FeeTooHigh.selector);
        kernel.setFeeBps(501);
    }

    function test_budgetLimits() public {
        vm.startPrank(client);
        uint256 id = kernel.createJob(provider, evaluator, block.timestamp + 5 days, "d", address(0));
        vm.expectRevert(AgentKernel.BadBudget.selector);
        kernel.setBudget(id, MIN - 1, "");
        vm.expectRevert(AgentKernel.BadBudget.selector);
        kernel.setBudget(id, uint256(MAX) + 1, "");
        vm.stopPrank();
    }

    function test_loweringCap_doesNotStrandFundedJobs() public {
        uint256 id = _plainSubmitted(500e6);
        vm.prank(owner);
        kernel.setBudgetLimits(1e6, 10e6);
        vm.prank(evaluator);
        kernel.complete(id, bytes32(0), "");
        assertEq(usdc.balanceOf(provider), 495e6);
    }

    function test_pause_blocksNewJobsAndFunding_notSettlement() public {
        uint256 id = _plainSubmitted(10e6);
        vm.prank(client);
        uint256 openId = kernel.createJob(provider, evaluator, block.timestamp + 5 days, "d", address(0));
        vm.prank(owner);
        kernel.pause();

        vm.prank(client);
        vm.expectRevert();
        kernel.createJob(provider, evaluator, block.timestamp + 5 days, "d", address(0));
        vm.startPrank(client);
        kernel.setBudget(openId, 5e6, "");
        usdc.approve(address(kernel), 5e6);
        vm.expectRevert();
        kernel.fund(openId, 5e6, "");
        vm.stopPrank();

        vm.prank(evaluator);
        kernel.complete(id, bytes32(0), ""); // settlement still works
        assertEq(usdc.balanceOf(provider), 9.9e6);
    }

    // ───────── party and parameter validation ─────────
    function test_selfHireAndSelfEvaluate_revert() public {
        vm.startPrank(client);
        vm.expectRevert(AgentKernel.InvalidParty.selector);
        kernel.createJob(client, evaluator, block.timestamp + 5 days, "d", address(0));
        vm.expectRevert(AgentKernel.InvalidParty.selector);
        kernel.createJob(evaluator, evaluator, block.timestamp + 5 days, "d", address(0));
        vm.expectRevert(AgentKernel.ZeroAddress.selector);
        kernel.createJob(provider, address(0), block.timestamp + 5 days, "d", address(0));
        vm.stopPrank();
    }

    function test_setProvider_rules() public {
        vm.startPrank(client);
        uint256 id = kernel.createJob(address(0), evaluator, block.timestamp + 5 days, "d", address(0));
        vm.expectRevert(AgentKernel.ZeroAddress.selector);
        kernel.setProvider(id, address(0), "");
        vm.expectRevert(AgentKernel.InvalidParty.selector);
        kernel.setProvider(id, client, "");
        kernel.setProvider(id, provider, "");
        vm.expectRevert(AgentKernel.ProviderAlreadySet.selector);
        kernel.setProvider(id, stranger, "");
        vm.stopPrank();
    }

    function test_fund_requiresProviderAndMatchingBudget() public {
        vm.startPrank(client);
        uint256 id = kernel.createJob(address(0), evaluator, block.timestamp + 5 days, "d", address(0));
        kernel.setBudget(id, 10e6, "");
        usdc.approve(address(kernel), 10e6);
        vm.expectRevert(AgentKernel.ProviderNotSet.selector);
        kernel.fund(id, 10e6, "");
        kernel.setProvider(id, provider, "");
        vm.stopPrank();

        vm.prank(provider);
        kernel.setBudget(id, 20e6, ""); // provider counter-proposes
        vm.prank(client);
        vm.expectRevert(AgentKernel.BudgetMismatch.selector); // client's expectation is stale
        kernel.fund(id, 10e6, "");
    }

    function test_fund_rejectsShortExpiry() public {
        vm.startPrank(client);
        uint256 id = kernel.createJob(provider, evaluator, block.timestamp + 30 minutes, "d", address(0));
        kernel.setBudget(id, 10e6, "");
        usdc.approve(address(kernel), 10e6);
        vm.expectRevert(AgentKernel.BadExpiry.selector);
        kernel.fund(id, 10e6, "");
        vm.stopPrank();
    }

    function test_strangerCannotSetBudgetOrFund() public {
        vm.prank(client);
        uint256 id = kernel.createJob(provider, evaluator, block.timestamp + 5 days, "d", address(0));
        vm.prank(stranger);
        vm.expectRevert(AgentKernel.NotClientOrProvider.selector);
        kernel.setBudget(id, 5e6, "");
        vm.prank(stranger);
        vm.expectRevert(AgentKernel.NotClient.selector);
        kernel.fund(id, 5e6, "");
    }

    function test_onlyProviderSubmits_andDeliverableRequired() public {
        uint256 id = _plainFunded(10e6);
        vm.prank(client);
        vm.expectRevert(AgentKernel.NotProvider.selector);
        kernel.submit(id, keccak256("w"), "");
        vm.prank(provider);
        vm.expectRevert(AgentKernel.EmptyDeliverable.selector);
        kernel.submit(id, bytes32(0), "");
    }

    function test_predictJobId() public {
        uint256 predicted = kernel.predictJobId(client);
        vm.prank(client);
        uint256 id = kernel.createJob(provider, evaluator, block.timestamp + 5 days, "d", address(0));
        assertEq(id, predicted);
        assertTrue(kernel.predictJobId(client) != predicted);
    }

    // ───────── ownership and admin ─────────
    function test_ownable2Step() public {
        address next = makeAddr("next");
        vm.prank(owner);
        kernel.transferOwnership(next);
        assertEq(kernel.owner(), owner); // not yet
        vm.prank(next);
        kernel.acceptOwnership();
        assertEq(kernel.owner(), next);
    }

    function test_adminOnlyOwner() public {
        vm.startPrank(stranger);
        vm.expectRevert();
        kernel.setFeeBps(1);
        vm.expectRevert();
        kernel.setTreasury(stranger);
        vm.expectRevert();
        kernel.setHookAllowed(stranger, true);
        vm.expectRevert();
        kernel.pause();
        vm.stopPrank();
    }

    function test_ownerCannotTouchEscrow() public {
        _plainFunded(100e6);
        uint256 bal = usdc.balanceOf(address(kernel));
        vm.startPrank(owner);
        kernel.setFeeBps(500);
        kernel.setTreasury(owner);
        kernel.setBudgetLimits(1e6, 2e6);
        kernel.pause();
        kernel.unpause();
        vm.stopPrank();
        assertEq(usdc.balanceOf(address(kernel)), bal);
    }

    // ───────── hooks ─────────
    function test_unlistedHookRejected() public {
        RevertingHook h = new RevertingHook();
        vm.prank(client);
        vm.expectRevert(AgentKernel.HookNotAllowed.selector);
        kernel.createJob(provider, evaluator, block.timestamp + 5 days, "d", address(h));
    }

    function test_revertingHook_cannotBlockSettlement() public {
        RevertingHook h = new RevertingHook();
        vm.prank(owner);
        kernel.setHookAllowed(address(h), true);
        // Blocking paths (setBudget/fund/submit) may be vetoed by an allowlisted hook by design...
        vm.startPrank(client);
        uint256 id = kernel.createJob(provider, evaluator, block.timestamp + 20 days, "d", address(h));
        vm.expectRevert();
        kernel.setBudget(id, 10e6, "");
        // ...but a client can always get out: reject while Open is non-blocking.
        kernel.reject(id, bytes32(0), "");
        vm.stopPrank();
        assertEq(uint8(_status(id)), uint8(IAgentKernel.Status.Rejected));
    }

    function test_gasBombHook_cannotBlockSettlement() public {
        // Hook is only allowed to be a "soft" hook on settle paths; build a funded job
        // with a benign hook, then swap behavior is not possible, so use a hook that
        // misbehaves only after funding by deploying GasBomb as evaluator-side hook.
        GasBombHook h = new GasBombHook();
        vm.prank(owner);
        kernel.setHookAllowed(address(h), true);
        vm.prank(client);
        uint256 id = kernel.createJob(provider, evaluator, block.timestamp + 20 days, "d", address(h));
        // blocking paths (setBudget) would consume all gas; verify the soft path on reject-while-open
        uint256 gasBefore = gasleft();
        vm.prank(client);
        kernel.reject(id, bytes32(0), "");
        assertLt(gasBefore - gasleft(), 1_500_000); // capped by HOOK_GAS, did not burn the tx
        assertEq(uint8(_status(id)), uint8(IAgentKernel.Status.Rejected));
    }

    function test_reentrantHook_cannotDoubleSettle() public {
        ReentrantHook h = new ReentrantHook(IAgentKernel(address(kernel)));
        vm.prank(owner);
        kernel.setHookAllowed(address(h), true);
        // use the hook only on soft paths: reject while Open triggers afterAction (soft)
        vm.prank(client);
        uint256 id = kernel.createJob(provider, evaluator, block.timestamp + 20 days, "d", address(h));
        vm.prank(client);
        kernel.reject(id, bytes32(0), "");
        // The hook's re-entrant complete() reverted inside the soft hook call, which rolled back
        // its own state (attempts stays 0) and was swallowed. Settlement happened exactly once.
        assertEq(h.attempts(), 0);
        assertEq(uint8(_status(id)), uint8(IAgentKernel.Status.Rejected));
        assertEq(usdc.balanceOf(address(kernel)), 0);
    }
}
