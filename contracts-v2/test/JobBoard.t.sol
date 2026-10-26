// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {JobBoard} from "../src/JobBoard.sol";
import {EvaluatorRouter} from "../src/EvaluatorRouter.sol";
import {IAgentKernel} from "../src/interfaces/IAgentKernel.sol";
import {RevertingRecorder, CountingRecorder} from "./mocks/Hooks.sol";

contract JobBoardTest is Base {
    uint128 constant B = 100e6;

    function _listAndBid(EvaluatorRouter.Config memory cfg, uint128 price) internal returns (uint256 lid, uint256 bid_) {
        vm.prank(client);
        lid = board.createListing(keccak256("spec"), B, 0, address(0), "ipfs://s");
        bytes32 h = router.computeConfigHash(cfg, router.arbitrator());
        vm.prank(provider);
        bid_ = board.placeBid(lid, price, h, uint64(block.timestamp + 30 days), "ipfs://b");
    }

    function _create(EvaluatorRouter.Config memory cfg) internal returns (uint256 id) {
        vm.startPrank(client);
        id = kernel.createJob(provider, address(router), block.timestamp + 20 days, "d", address(board));
        router.configure(id, cfg);
        vm.stopPrank();
    }

    // ───────── atomic enforcement of the provider's bid ─────────
    function test_hire_happyPath_marksListingAndBid() public {
        (uint256 id, uint256 lid, uint256 bid_) = _hire(cfgClient(), B);
        (,,,, JobBoard.ListingStatus st,,, uint256 jobId) = board.listings(lid);
        assertEq(uint8(st), uint8(JobBoard.ListingStatus.Filled));
        assertEq(jobId, id);
        (,,, JobBoard.BidStatus bs,) = board.bids(lid, bid_);
        assertEq(uint8(bs), uint8(JobBoard.BidStatus.Accepted));
        assertEq(board.listingOfJob(id), lid);
        assertEq(uint8(_status(id)), uint8(IAgentKernel.Status.Funded));
    }

    function test_hire_clientCannotChangePriceAfterBid() public {
        EvaluatorRouter.Config memory cfg = cfgClient();
        (uint256 lid, uint256 bid_) = _listAndBid(cfg, 80e6);
        uint256 id = _create(cfg);
        vm.startPrank(client);
        kernel.setBudget(id, 50e6, ""); // client tries to underpay
        usdc.approve(address(kernel), 50e6);
        vm.expectRevert(JobBoard.TermsMismatch.selector);
        kernel.fund(id, 50e6, abi.encode(lid, bid_));
        vm.stopPrank();
    }

    function test_hire_clientCannotSwapEvaluatorTerms() public {
        (uint256 lid, uint256 bid_) = _listAndBid(cfgClient(), B); // provider agreed to client-mode terms
        EvaluatorRouter.Config memory nasty = cfgClient();
        nasty.timeoutProviderBps = 0; // client quietly changes the default outcome
        uint256 id = _create(nasty);
        vm.startPrank(client);
        kernel.setBudget(id, B, "");
        usdc.approve(address(kernel), B);
        vm.expectRevert(JobBoard.TermsMismatch.selector);
        kernel.fund(id, B, abi.encode(lid, bid_));
        vm.stopPrank();
    }

    function test_hire_wrongProviderReverts() public {
        EvaluatorRouter.Config memory cfg = cfgClient();
        (uint256 lid, uint256 bid_) = _listAndBid(cfg, B);
        vm.startPrank(client);
        uint256 id = kernel.createJob(stranger, address(router), block.timestamp + 20 days, "d", address(board));
        router.configure(id, cfg);
        kernel.setBudget(id, B, "");
        usdc.approve(address(kernel), B);
        vm.expectRevert(JobBoard.TermsMismatch.selector);
        kernel.fund(id, B, abi.encode(lid, bid_));
        vm.stopPrank();
    }

    function test_hire_otherClientCannotHijackListing() public {
        EvaluatorRouter.Config memory cfg = cfgClient();
        (uint256 lid, uint256 bid_) = _listAndBid(cfg, B);
        usdc.mint(stranger, B);
        vm.startPrank(stranger);
        uint256 id = kernel.createJob(provider, address(router), block.timestamp + 20 days, "d", address(board));
        router.configure(id, cfg);
        kernel.setBudget(id, B, "");
        usdc.approve(address(kernel), B);
        vm.expectRevert(JobBoard.TermsMismatch.selector);
        kernel.fund(id, B, abi.encode(lid, bid_));
        vm.stopPrank();
    }

    function test_hire_withdrawnOrExpiredBidReverts() public {
        EvaluatorRouter.Config memory cfg = cfgClient();
        (uint256 lid, uint256 bid_) = _listAndBid(cfg, B);
        vm.prank(provider);
        board.withdrawBid(lid, bid_);
        uint256 id = _create(cfg);
        vm.startPrank(client);
        kernel.setBudget(id, B, "");
        usdc.approve(address(kernel), B);
        vm.expectRevert(JobBoard.BadBid.selector);
        kernel.fund(id, B, abi.encode(lid, bid_));
        vm.stopPrank();

        (uint256 lid2, uint256 bid2) = _listAndBid(cfg, B);
        vm.warp(block.timestamp + 31 days);
        vm.startPrank(client);
        uint256 id2 = kernel.createJob(provider, address(router), block.timestamp + 20 days, "d", address(board));
        router.configure(id2, cfg);
        kernel.setBudget(id2, B, "");
        vm.expectRevert(JobBoard.BadBid.selector);
        kernel.fund(id2, B, abi.encode(lid2, bid2));
        vm.stopPrank();
    }

    function test_hire_listingCannotBeFilledTwice() public {
        EvaluatorRouter.Config memory cfg = cfgClient();
        (uint256 id, uint256 lid, uint256 bid_) = _hire(cfg, B);
        id; // silence
        vm.startPrank(client);
        uint256 id2 = kernel.createJob(provider, address(router), block.timestamp + 20 days, "d", address(board));
        router.configure(id2, cfg);
        kernel.setBudget(id2, B, "");
        usdc.approve(address(kernel), B);
        vm.expectRevert(JobBoard.BadListing.selector);
        kernel.fund(id2, B, abi.encode(lid, bid_));
        vm.stopPrank();
    }

    function test_fund_withBoardHook_requiresOptParams() public {
        uint256 id = _create(cfgClient());
        vm.startPrank(client);
        kernel.setBudget(id, B, "");
        usdc.approve(address(kernel), B);
        vm.expectRevert();
        kernel.fund(id, B, ""); // cannot skip the bid check
        vm.stopPrank();
    }

    function test_boardHook_notCallableByStrangers() public {
        vm.expectRevert(JobBoard.NotKernel.selector);
        board.beforeAction(1, IAgentKernel.fund.selector, "");
        vm.expectRevert(JobBoard.NotKernel.selector);
        board.afterAction(1, IAgentKernel.complete.selector, "");
    }

    // ───────── listings and bids ─────────
    function test_listing_inviteOnly() public {
        vm.prank(client);
        uint256 lid = board.createListing(keccak256("s"), B, 0, provider, "u");
        vm.prank(stranger);
        vm.expectRevert(JobBoard.NotInvited.selector);
        board.placeBid(lid, B, keccak256("h"), uint64(block.timestamp + 1 days), "u");
        vm.prank(provider);
        board.placeBid(lid, B, keccak256("h"), uint64(block.timestamp + 1 days), "u");
    }

    function test_bid_validation() public {
        vm.prank(client);
        uint256 lid = board.createListing(keccak256("s"), B, uint64(block.timestamp + 1 days), address(0), "u");
        vm.startPrank(provider);
        vm.expectRevert(JobBoard.BadBid.selector);
        board.placeBid(lid, B + 1, keccak256("h"), uint64(block.timestamp + 1 days), "u"); // over max
        vm.expectRevert(JobBoard.BadBid.selector);
        board.placeBid(lid, 0, keccak256("h"), uint64(block.timestamp + 1 days), "u");
        vm.expectRevert(JobBoard.BadBid.selector);
        board.placeBid(lid, B, bytes32(0), uint64(block.timestamp + 1 days), "u");
        vm.expectRevert(JobBoard.BadBid.selector);
        board.placeBid(lid, B, keccak256("h"), uint64(block.timestamp), "u"); // already expired
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(JobBoard.BidClosed.selector);
        board.placeBid(lid, B, keccak256("h"), uint64(block.timestamp + 1 days), "u");
        vm.stopPrank();

        vm.prank(client);
        vm.expectRevert(JobBoard.BadBid.selector); // client cannot bid on own listing
        board.placeBid(lid, B, keccak256("h"), uint64(block.timestamp + 1 days), "u");
    }

    function test_cancelListing_onlyClient_onlyOpen() public {
        vm.prank(client);
        uint256 lid = board.createListing(keccak256("s"), B, 0, address(0), "u");
        vm.prank(stranger);
        vm.expectRevert(JobBoard.NotClient.selector);
        board.cancelListing(lid);
        vm.prank(client);
        board.cancelListing(lid);
        vm.prank(provider);
        vm.expectRevert(JobBoard.BadListing.selector);
        board.placeBid(lid, B, keccak256("h"), uint64(block.timestamp + 1 days), "u");
    }

    function test_withdrawBid_onlyOwnerOfBid() public {
        (uint256 lid, uint256 bid_) = _listAndBid(cfgClient(), B);
        vm.prank(stranger);
        vm.expectRevert(JobBoard.NotProvider.selector);
        board.withdrawBid(lid, bid_);
    }

    // ───────── reputation recorder is advisory only ─────────
    function test_recorder_receivesOutcome() public {
        CountingRecorder rec = new CountingRecorder();
        vm.prank(owner);
        board.setRecorder(address(rec));
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.prank(client);
        router.approve(id);
        assertEq(rec.calls(), 1);
        assertEq(rec.lastBps(), 10_000);
        assertEq(rec.lastProvider(), provider);
    }

    function test_recorder_splitBpsPassedThrough() public {
        CountingRecorder rec = new CountingRecorder();
        vm.prank(owner);
        board.setRecorder(address(rec));
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.prank(client);
        router.reject(id, bytes32(0), bytes32(0));
        vm.prank(provider);
        router.contest(id, bytes32(0));
        vm.prank(arbitrator);
        router.vote(id, 3000, bytes32(0));
        assertEq(rec.lastBps(), 3000);
    }

    function test_revertingRecorder_cannotBlockSettlement() public {
        RevertingRecorder rec = new RevertingRecorder();
        vm.prank(owner);
        board.setRecorder(address(rec));
        (uint256 id,,) = _hire(cfgClient(), B);
        _submit(id);
        vm.prank(client);
        router.approve(id); // must succeed
        assertEq(usdc.balanceOf(provider), 99e6);
    }
}
