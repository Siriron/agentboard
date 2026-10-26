// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {EvaluatorRouter} from "../src/EvaluatorRouter.sol";
import {IAgentKernel} from "../src/interfaces/IAgentKernel.sol";

contract EvaluatorRouterTest is Base {
    uint128 constant B = 100e6;

    // ───────── happy paths ─────────
    function test_clientApproves_providerPaid() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.prank(client);
        router.approve(id);
        assertEq(usdc.balanceOf(provider), 99e6);
        assertEq(uint8(_status(id)), uint8(IAgentKernel.Status.Completed));
    }

    function test_strangerCannotApprove() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.prank(stranger);
        vm.expectRevert(EvaluatorRouter.NotClient.selector);
        router.approve(id);
    }

    function test_clientSilent_autoReleaseOnlyAfterWindow() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.prank(stranger);
        vm.expectRevert(EvaluatorRouter.WindowOpen.selector);
        router.autoRelease(id);

        vm.warp(block.timestamp + 2 days);
        vm.prank(stranger);
        router.autoRelease(id); // permissionless
        assertEq(usdc.balanceOf(provider), 99e6);
    }

    function test_autoRelease_blockedOnceDisputed() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.prank(client);
        router.reject(id, keccak256("r"), keccak256("e"));
        vm.warp(block.timestamp + 10 days);
        vm.expectRevert(abi.encodeWithSelector(EvaluatorRouter.BadState.selector, EvaluatorRouter.State.Disputed));
        router.autoRelease(id);
    }

    // ───────── reject / accept / uncontested ─────────
    function test_reject_doesNotRefundByItself() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        uint256 before_ = usdc.balanceOf(client);
        vm.prank(client);
        router.reject(id, keccak256("r"), keccak256("e"));
        assertEq(usdc.balanceOf(client), before_);
        assertEq(uint8(_status(id)), uint8(IAgentKernel.Status.Submitted));
    }

    function test_reject_onlyInsideReviewWindow() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.warp(block.timestamp + 2 days);
        vm.prank(client);
        vm.expectRevert(EvaluatorRouter.WindowClosed.selector);
        router.reject(id, bytes32(0), bytes32(0));
    }

    function test_providerAcceptsRejection_clientRefunded() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.prank(client);
        router.reject(id, keccak256("r"), bytes32(0));
        uint256 before_ = usdc.balanceOf(client);
        vm.prank(provider);
        router.acceptRejection(id);
        assertEq(usdc.balanceOf(client), before_ + B);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_uncontested_refundOnlyAfterResponseWindow() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.prank(client);
        router.reject(id, bytes32(0), bytes32(0));
        vm.expectRevert(EvaluatorRouter.WindowOpen.selector);
        router.finalizeUncontested(id);
        vm.warp(block.timestamp + 2 days + 1);
        uint256 before_ = usdc.balanceOf(client);
        vm.prank(stranger);
        router.finalizeUncontested(id);
        assertEq(usdc.balanceOf(client), before_ + B);
    }

    function test_contest_afterWindowReverts_andOnlyProvider() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.prank(client);
        router.reject(id, bytes32(0), bytes32(0));
        vm.prank(client);
        vm.expectRevert(EvaluatorRouter.NotProvider.selector);
        router.contest(id, bytes32(0));
        vm.warp(block.timestamp + 2 days + 1);
        vm.prank(provider);
        vm.expectRevert(EvaluatorRouter.WindowClosed.selector);
        router.contest(id, bytes32(0));
    }

    function test_clientCanApproveDuringDispute() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.startPrank(client);
        router.reject(id, bytes32(0), bytes32(0));
        router.approve(id); // changed their mind
        vm.stopPrank();
        assertEq(usdc.balanceOf(provider), 99e6);
    }

    // ───────── arbitrator (Client mode) ─────────
    function test_arbitratorRules_providerWins() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.prank(client);
        router.reject(id, bytes32(0), bytes32(0));
        vm.prank(provider);
        router.contest(id, keccak256("proof"));
        vm.prank(arbitrator);
        router.vote(id, 10_000, keccak256("ruling"));
        assertEq(usdc.balanceOf(provider), 99e6);
    }

    function test_arbitratorRules_split() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.prank(client);
        router.reject(id, bytes32(0), bytes32(0));
        vm.prank(provider);
        router.contest(id, bytes32(0));
        vm.prank(arbitrator);
        router.vote(id, 6000, bytes32(0));
        assertEq(usdc.balanceOf(provider), 59_400_000); // 60 - 1% of 60
        assertEq(usdc.balanceOf(treasury), 600_000);
    }

    function test_voteRequiresContest() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.prank(client);
        router.reject(id, bytes32(0), bytes32(0));
        vm.prank(arbitrator);
        vm.expectRevert(EvaluatorRouter.NotContested.selector);
        router.vote(id, 0, bytes32(0));
    }

    function test_strangerCannotVote() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _contested(id);
        vm.prank(stranger);
        vm.expectRevert(EvaluatorRouter.NotDecider.selector);
        router.vote(id, 0, bytes32(0));
    }

    function test_arbitratorChange_doesNotAffectConfiguredJobs() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        address newArb = makeAddr("newArb");
        vm.prank(owner);
        router.setArbitrator(newArb);
        _contested(id);
        vm.prank(newArb);
        vm.expectRevert(EvaluatorRouter.NotDecider.selector);
        router.vote(id, 0, bytes32(0));
        vm.prank(arbitrator); // snapshot still decides
        router.vote(id, 0, bytes32(0));
    }

    // ───────── validator and panel ─────────
    function test_validatorMode_singleVoteSettles() public {
        (uint256 id,,) = _hire(cfgValidator(v1), B);
        _contested(id);
        vm.prank(v1);
        router.vote(id, 0, bytes32(0));
        assertEq(usdc.balanceOf(client), 100_000e6); // refunded in full
    }

    function test_panel_medianOfThree() public {
        (uint256 id,,) = _hire(cfgPanel3(v1, v2, v3), B);
        _contested(id);
        vm.prank(v1);
        router.vote(id, 0, bytes32(0));
        vm.prank(v2);
        router.vote(id, 10_000, bytes32(0));
        assertEq(uint8(_status(id)), uint8(IAgentKernel.Status.Submitted)); // needs all 3
        vm.prank(v3);
        router.vote(id, 4000, bytes32(0));
        // median of [0, 10000, 4000] = 4000
        assertEq(usdc.balanceOf(provider), 39_600_000);
        assertEq(uint8(_status(id)), uint8(IAgentKernel.Status.Split));
    }

    function test_panel_cannotVoteTwice() public {
        (uint256 id,,) = _hire(cfgPanel3(v1, v2, v3), B);
        _contested(id);
        vm.startPrank(v1);
        router.vote(id, 0, bytes32(0));
        vm.expectRevert(EvaluatorRouter.AlreadyVoted.selector);
        router.vote(id, 0, bytes32(0));
        vm.stopPrank();
    }

    function test_panel_timeoutWithMajority_usesMedian() public {
        (uint256 id,,) = _hire(cfgPanel3(v1, v2, v3), B);
        _contested(id);
        vm.prank(v1);
        router.vote(id, 10_000, bytes32(0));
        vm.prank(v2);
        router.vote(id, 10_000, bytes32(0));
        vm.expectRevert(EvaluatorRouter.WindowOpen.selector);
        router.finalizeTimeout(id);
        vm.warp(block.timestamp + 7 days + 1);
        router.finalizeTimeout(id); // 2 of 3 voted -> median 10000
        assertEq(usdc.balanceOf(provider), 99e6);
    }

    function test_timeoutNoVotes_usesAgreedDefaultSplit() public {
        (uint256 id,,) = _hire(cfgPanel3(v1, v2, v3), B); // timeoutProviderBps = 5000
        _contested(id);
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(stranger);
        router.finalizeTimeout(id);
        assertEq(usdc.balanceOf(provider), 49_500_000);
        assertEq(usdc.balanceOf(client), 100_000e6 - 100e6 + 50e6);
    }

    function test_voteAfterDecisionWindowReverts() public {
        (uint256 id,,) = _hire(cfgValidator(v1), B);
        _contested(id);
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(v1);
        vm.expectRevert(EvaluatorRouter.WindowClosed.selector);
        router.vote(id, 0, bytes32(0));
    }

    function test_votingBpsBounded() public {
        (uint256 id,,) = _hire(cfgValidator(v1), B);
        _contested(id);
        vm.prank(v1);
        vm.expectRevert(EvaluatorRouter.BadBps.selector);
        router.vote(id, 10_001, bytes32(0));
    }

    // ───────── configuration rules ─────────
    function test_configure_onlyClient_onlyOnce_onlyWhileOpen() public {
        vm.prank(client);
        uint256 id = kernel.createJob(provider, address(router), block.timestamp + 20 days, "d", address(board));
        EvaluatorRouter.Config memory c = cfgClient();
        vm.prank(stranger);
        vm.expectRevert(EvaluatorRouter.NotClient.selector);
        router.configure(id, c);
        vm.startPrank(client);
        router.configure(id, c);
        vm.expectRevert(abi.encodeWithSelector(EvaluatorRouter.BadState.selector, EvaluatorRouter.State.Configured));
        router.configure(id, c);
        vm.stopPrank();
    }

    function test_configure_rejectsJobsWithOtherEvaluator() public {
        uint256 id = _plainFunded(10e6);
        vm.prank(client);
        vm.expectRevert(); // job already Funded
        router.configure(id, cfgClient());
        vm.prank(client);
        uint256 id2 = kernel.createJob(provider, evaluator, block.timestamp + 20 days, "d", address(0));
        vm.prank(client);
        vm.expectRevert(EvaluatorRouter.NotThisEvaluator.selector);
        router.configure(id2, cfgClient());
    }

    function test_configure_validation() public {
        vm.prank(client);
        uint256 id = kernel.createJob(provider, address(router), block.timestamp + 20 days, "d", address(0));
        vm.startPrank(client);

        EvaluatorRouter.Config memory c = cfgClient();
        c.reviewWindow = 1 hours;
        vm.expectRevert(EvaluatorRouter.BadConfig.selector);
        router.configure(id, c);

        c = cfgClient();
        c.decisionWindow = 15 days;
        vm.expectRevert(EvaluatorRouter.BadConfig.selector);
        router.configure(id, c);

        c = cfgClient();
        c.responseWindow = 5 days;
        c.decisionWindow = 3 days; // response must fit inside decision
        vm.expectRevert(EvaluatorRouter.BadConfig.selector);
        router.configure(id, c);

        c = cfgClient();
        c.timeoutProviderBps = 10_001;
        vm.expectRevert(EvaluatorRouter.BadConfig.selector);
        router.configure(id, c);

        c = cfgClient();
        c.validators = new address[](1); // Client mode must have none
        c.validators[0] = v1;
        vm.expectRevert(EvaluatorRouter.BadConfig.selector);
        router.configure(id, c);

        c = cfgPanel3(v1, v1, v2); // duplicate
        vm.expectRevert(EvaluatorRouter.BadConfig.selector);
        router.configure(id, c);

        c = cfgPanel3(v1, client, v2); // client as validator
        vm.expectRevert(EvaluatorRouter.BadConfig.selector);
        router.configure(id, c);

        c = cfgPanel3(v1, provider, v2); // provider as validator
        vm.expectRevert(EvaluatorRouter.BadConfig.selector);
        router.configure(id, c);

        c = cfgValidator(address(0));
        vm.expectRevert(EvaluatorRouter.BadConfig.selector);
        router.configure(id, c);

        c = cfgPanel3(v1, v2, v3);
        c.validators = new address[](2); // panel must be 3 or 5
        c.validators[0] = v1; c.validators[1] = v2;
        vm.expectRevert(EvaluatorRouter.BadConfig.selector);
        router.configure(id, c);
        vm.stopPrank();
    }

    function test_configHash_bindsEveryTerm() public view {
        EvaluatorRouter.Config memory a = cfgClient();
        bytes32 base = router.computeConfigHash(a, arbitrator);
        EvaluatorRouter.Config memory b = cfgClient();
        b.timeoutProviderBps = 0;
        assertTrue(router.computeConfigHash(b, arbitrator) != base);
        b = cfgClient();
        b.reviewWindow = 3 days;
        assertTrue(router.computeConfigHash(b, arbitrator) != base);
        assertTrue(router.computeConfigHash(a, address(1)) != base); // arbitrator is part of the terms
    }

    // ───────── end-to-end: nobody can unilaterally take the money ─────────
    function test_scenario_dishonestSeller_fakeWork_clientRefundedByPanel() public {
        (uint256 id,,) = _hire(cfgPanel3(v1, v2, v3), B);
        _submit(id); // junk deliverable
        vm.prank(client);
        router.reject(id, keccak256("fake"), keccak256("evidence"));
        vm.prank(provider);
        router.contest(id, keccak256("it is real"));
        vm.prank(v1); router.vote(id, 0, bytes32(0));
        vm.prank(v2); router.vote(id, 0, bytes32(0));
        vm.prank(v3); router.vote(id, 0, bytes32(0));
        assertEq(usdc.balanceOf(provider), 0);
        assertEq(usdc.balanceOf(client), 100_000e6);
    }

    function test_scenario_dishonestBuyer_silence_sellerStillPaid() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.warp(block.timestamp + 3 days);
        router.autoRelease(id);
        assertEq(usdc.balanceOf(provider), 99e6);
    }

    function test_scenario_dishonestBuyer_badFaithReject_sellerContests_arbitratorPays() public {
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.prank(client);
        router.reject(id, keccak256("meh"), bytes32(0));
        vm.prank(provider);
        router.contest(id, keccak256("matches spec"));
        vm.prank(arbitrator);
        router.vote(id, 10_000, bytes32(0));
        assertEq(usdc.balanceOf(provider), 99e6);
    }

    function test_scenario_everyone_silent_fundsNeverStuck() public {
        (uint256 id,,) = _hire(cfgPanel3(v1, v2, v3), B);
        _submit(id);
        vm.prank(client);
        router.reject(id, bytes32(0), bytes32(0));
        vm.prank(provider);
        router.contest(id, bytes32(0));
        // validators disappear: after the decision window anyone can finalize the agreed default
        vm.warp(block.timestamp + 7 days + 1);
        router.finalizeTimeout(id);
        assertEq(usdc.balanceOf(address(kernel)), 0);
        // and the kernel's own refund path was never needed before this (grace window = 30 days)
        assertLt(block.timestamp, kernel.getJob(id).expiredAt);
    }

    // ── helper ──
    function _contested(uint256 id) internal {
        _submit(id);
        vm.prank(client);
        router.reject(id, keccak256("r"), keccak256("e"));
        vm.prank(provider);
        router.contest(id, keccak256("c"));
    }
}
