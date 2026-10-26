import { BaseError } from 'viem'

interface WalkedError { data?: { errorName?: string }; name?: string }

// Maps wallet, RPC and contract failures to fixed, plain-language messages.
// Raw error text never reaches the UI.

const CONTRACT_MESSAGES: Record<string, string> = {
  // AgentKernel
  BadStatus: 'This job is not in the right state for that action. Refresh and check its status.',
  BadBudget: 'The amount is outside the allowed launch limits.',
  BudgetMismatch: 'The agreed price changed. Reload the page and review the terms.',
  BadExpiry: 'The deadline is not valid. It must be at least 1 hour away to fund, and at most the maximum duration.',
  NotClient: 'Only the buyer can do this.',
  NotProvider: 'Only the seller can do this.',
  NotEvaluator: 'This action is restricted to the evaluator.',
  EnforcedPause: 'New jobs and funding are paused by the operator. Existing jobs keep working.',
  NotExpired: 'The deadline has not passed yet.',
  AlreadyExpired: 'The deadline has already passed.',
  EmptyDeliverable: 'The deliverable hash is empty.',
  NothingToClaim: 'There is nothing to withdraw.',
  ProviderNotSet: 'No seller is set on this job.',
  HookNotAllowed: 'This hook is not allowed by the kernel.',
  // EvaluatorRouter
  WindowOpen: 'That window is still open. Try again after it ends.',
  WindowClosed: 'That window has closed.',
  BadState: 'The dispute is not in the right state for that action.',
  BadKernelStatus: 'The job is not in the right state for that action.',
  AlreadyContested: 'This rejection was already contested.',
  AlreadyVoted: 'You already voted on this dispute.',
  NotContested: 'The seller has not contested this rejection.',
  NotDecider: 'Your wallet is not an agreed decider for this job.',
  ConflictOfInterest: 'The buyer and seller cannot vote on their own dispute.',
  BadConfig: 'The evaluation terms are not valid. Check the windows and validators.',
  BadBps: 'The provider share must be between 0% and 100%.',
  // JobBoard
  BadListing: 'This listing is not open.',
  BadBid: 'This bid is not valid. It may be withdrawn, expired, or above the listing budget.',
  BidClosed: 'Bidding on this listing has closed.',
  NotInvited: 'This listing is invite-only and your wallet is not invited.',
  TermsMismatch: 'The job terms do not match the seller\u2019s bid. Reload and review the bid.',
}

export function explainError(input: unknown): string {
  if (!input) return 'Something went wrong. Try again.'
  const err = input as { code?: number | string; cause?: { code?: number | string }; message?: string; name?: string }
  const code = err.code ?? err.cause?.code
  if (code === 4001 || code === 'ACTION_REJECTED' || /user rejected|user denied/i.test(err.message || '')) {
    return 'You rejected the request in your wallet. Nothing was sent.'
  }
  if (err.name === 'AppError') return err.message || 'Something went wrong.'

  let name: string | undefined
  let msg = ''
  if (input instanceof BaseError) {
    const hit = input.walk(e => !!(e as WalkedError)?.data?.errorName) as WalkedError | null
    name = hit?.data?.errorName
    msg = input.shortMessage || input.message || ''
  } else {
    msg = err.message || ''
  }
  if (name && CONTRACT_MESSAGES[name]) return CONTRACT_MESSAGES[name]
  // Custom-error name embedded in text, for wallets that flatten errors.
  const m = Object.keys(CONTRACT_MESSAGES).find(k => new RegExp(`\\b${k}\\b`).test(msg))
  if (m) return CONTRACT_MESSAGES[m]

  if (/transaction underpriced|intrinsic gas too low|max fee per gas less than block base fee/i.test(msg)) {
    return 'The network fee was below Arc\u2019s minimum (20 Gwei). Retry; the app sets a valid fee automatically.'
  }
  if (/insufficient funds|exceeds balance|transfer amount exceeds/i.test(msg)) {
    return 'Not enough USDC for this amount plus network fees.'
  }
  if (/blocklist|blacklist|blocked/i.test(msg)) {
    return 'The USDC contract refused this transfer because an address is blocklisted. Gas for the attempt is still charged.'
  }
  if (/chain|network/i.test(msg) && /mismatch|wrong|switch/i.test(msg)) {
    return 'Your wallet is on the wrong network. Switch to Arc Mainnet and try again.'
  }
  if (/timeout|timed out|fetch failed|HTTP request failed|429/i.test(msg)) {
    return 'The network is busy or unreachable. Wait a moment and retry. Check your wallet history before resending.'
  }
  return 'The transaction failed. Review the details and try again.'
}

export class AppError extends Error {
  constructor(message: string) { super(message); this.name = 'AppError' }
}
