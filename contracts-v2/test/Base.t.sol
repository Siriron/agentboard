// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {AgentKernel} from "../src/AgentKernel.sol";
import {EvaluatorRouter} from "../src/EvaluatorRouter.sol";
import {JobBoard} from "../src/JobBoard.sol";
import {IAgentKernel} from "../src/interfaces/IAgentKernel.sol";

abstract contract Base is Test {
    MockUSDC usdc;
    AgentKernel kernel;
    EvaluatorRouter router;
    JobBoard board;

    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address arbitrator = makeAddr("arbitrator");
    address client = makeAddr("client");
    address provider = makeAddr("provider");
    address stranger = makeAddr("stranger");
    address evaluator = makeAddr("evaluator"); // plain EOA evaluator for kernel-only tests
    address v1 = makeAddr("v1");
    address v2 = makeAddr("v2");
    address v3 = makeAddr("v3");
    address v4 = makeAddr("v4");
    address v5 = makeAddr("v5");

    uint128 constant MIN = 1e6;
    uint128 constant MAX = 1_000e6;

    function setUp() public virtual {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        kernel = new AgentKernel(usdc, treasury, owner, MIN, MAX);
        router = new EvaluatorRouter(IAgentKernel(address(kernel)), arbitrator, owner);
        board = new JobBoard(IAgentKernel(address(kernel)), address(router), owner);
        vm.prank(owner);
        kernel.setHookAllowed(address(board), true);
        usdc.mint(client, 100_000e6);
    }

    // ── kernel-only helpers (EOA evaluator, no router/board) ──
    function _plainFunded(uint128 budget) internal returns (uint256 jobId) {
        vm.startPrank(client);
        jobId = kernel.createJob(provider, evaluator, block.timestamp + 20 days, "plain", address(0));
        kernel.setBudget(jobId, budget, "");
        usdc.approve(address(kernel), budget);
        kernel.fund(jobId, budget, "");
        vm.stopPrank();
    }

    function _plainSubmitted(uint128 budget) internal returns (uint256 jobId) {
        jobId = _plainFunded(budget);
        vm.prank(provider);
        kernel.submit(jobId, keccak256("work"), "");
    }

    // ── router configs ──
    function cfgClient() internal pure returns (EvaluatorRouter.Config memory c) {
        c.mode = EvaluatorRouter.Mode.Client;
        c.reviewWindow = 2 days;
        c.responseWindow = 2 days;
        c.decisionWindow = 7 days;
        c.timeoutProviderBps = 5000;
    }

    function cfgValidator(address v) internal pure returns (EvaluatorRouter.Config memory c) {
        c = cfgClient();
        c.mode = EvaluatorRouter.Mode.Validator;
        c.validators = new address[](1);
        c.validators[0] = v;
    }

    function cfgPanel3(address a, address b, address d) internal pure returns (EvaluatorRouter.Config memory c) {
        c = cfgClient();
        c.mode = EvaluatorRouter.Mode.Panel;
        c.validators = new address[](3);
        c.validators[0] = a; c.validators[1] = b; c.validators[2] = d;
    }

    // ── board hire: listing -> bid -> createJob + configure + budget + approve + fund ──
    function _hire(EvaluatorRouter.Config memory cfg, uint128 budget)
        internal
        returns (uint256 jobId, uint256 listingId, uint256 bidId)
    {
        vm.prank(client);
        listingId = board.createListing(keccak256("spec"), budget, 0, address(0), "ipfs://spec");
        bytes32 h = router.computeConfigHash(cfg, router.arbitrator());
        vm.prank(provider);
        bidId = board.placeBid(listingId, budget, h, uint64(block.timestamp + 30 days), "ipfs://bid");

        vm.startPrank(client);
        jobId = kernel.createJob(provider, address(router), block.timestamp + 20 days, "desc", address(board));
        router.configure(jobId, cfg);
        kernel.setBudget(jobId, budget, "");
        usdc.approve(address(kernel), budget);
        kernel.fund(jobId, budget, abi.encode(listingId, bidId));
        vm.stopPrank();
    }

    function _submit(uint256 jobId) internal {
        vm.prank(provider);
        kernel.submit(jobId, keccak256("work"), "");
    }

    function _status(uint256 jobId) internal view returns (IAgentKernel.Status) {
        return kernel.getJob(jobId).status;
    }
}
