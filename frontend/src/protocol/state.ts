// Pure state machine for the job page: given chain facts, say what each wallet may do next.
// No network, no React. Unit-tested in state.test.js.
//
// The contracts enforce every rule below. This module only decides which buttons to show and
// which one is primary, so a wrong guess here can hide or show a button but never move funds.

export const JobStatus = { None: 0, Open: 1, Funded: 2, Submitted: 3, Completed: 4, Rejected: 5, Expired: 6, Split: 7 }
export const RouterState = { None: 0, Configured: 1, Disputed: 2, Settled: 3 }
export const Mode = { Client: 0, Validator: 1, Panel: 2 }

export const STATUS_LABEL: readonly string[] = ['None', 'Awaiting funding', 'In progress', 'Work submitted', 'Paid to seller', 'Refunded to buyer', 'Expired and refunded', 'Split between both']

const eq = (a?: string | null, b?: string | null): boolean => !!a && !!b && a.toLowerCase() === b.toLowerCase()

export interface JobLike { client: string; provider: string; status: number; expiredAt: bigint | number; submittedAt: bigint | number }
export interface RouterStateLike { state: number; contested: boolean; disputedAt: bigint | number; deciders: readonly string[]; votes: readonly number[] }
export interface WindowsCfg { reviewWindow: number; responseWindow: number; decisionWindow: number }
export type ActionId = 'cancelOpen' | 'submit' | 'extend' | 'claimRefund' | 'approve' | 'reject' | 'autoRelease' | 'contest' | 'acceptRejection' | 'finalizeUncontested' | 'vote' | 'finalizeTimeout'
export interface JobAction { id: ActionId; label: string; primary: boolean; tone: 'neutral' | 'danger'; enabled: boolean; hint?: string }
export interface JobTimer { id: string; label: string; endsAt: number; minor?: boolean }
export interface JobView { role: 'buyer' | 'seller' | 'decider' | 'observer'; status: number; rstate: number; phase: string; headline: string; note: string; timers: JobTimer[]; actions: JobAction[] }
export interface DescribeInput { job: JobLike; rs: RouterStateLike | null; cfg: WindowsCfg | null; me: string | null; hasVoted?: boolean; now: number }

/**
 * @param {object} p
 * @param {object} p.job        kernel.getJob result (bigint/number fields as returned by viem)
 * @param {object} p.rs         router.jobState result {state, mode, contested, disputedAt, deciders, votes}
 * @param {object|null} p.cfg   {reviewWindow, responseWindow, decisionWindow} seconds, hash-verified, or null
 * @param {string|null} p.me    connected wallet
 * @param {boolean} p.hasVoted  router.hasVoted(jobId, me)
 * @param {number} p.now        unix seconds
 */
export function describeJob({ job, rs, cfg, me, hasVoted = false, now }: DescribeInput): JobView {
  const status = Number(job.status)
  const rstate = Number(rs?.state ?? 0)
  const isClient = eq(me, job.client)
  const isProvider = eq(me, job.provider)
  const isDecider = !!me && (rs?.deciders || []).some((d: string) => eq(d, me))
  const role: JobView['role'] = isClient ? 'buyer' : isProvider ? 'seller' : isDecider ? 'decider' : 'observer'

  const expiredAt = Number(job.expiredAt)
  const submittedAt = Number(job.submittedAt)
  const disputedAt = Number(rs?.disputedAt ?? 0)
  const pastExpiry = now >= expiredAt

  const reviewEnd = cfg && submittedAt ? submittedAt + Number(cfg.reviewWindow) : null
  const responseEnd = cfg && disputedAt ? disputedAt + Number(cfg.responseWindow) : null
  const decisionEnd = cfg && disputedAt ? disputedAt + Number(cfg.decisionWindow) : null

  const out: JobView = { role, status, rstate, phase: '', headline: '', note: '', timers: [], actions: [] }
  const add = (id: ActionId, label: string, opts: Partial<JobAction> = {}) => { out.actions.push({ id, label, primary: false, tone: 'neutral', enabled: true, ...opts }) }

  if (status === JobStatus.Open) {
    out.phase = 'unfunded'
    out.headline = 'Waiting for the buyer to fund this job'
    if (isClient) add('cancelOpen', 'Cancel unfunded job', { tone: 'danger', hint: 'No funds are involved.' })
    out.timers.push({ id: 'expiry', label: 'Job deadline', endsAt: expiredAt })
    return out
  }

  if (status === JobStatus.Funded) {
    out.phase = 'working'
    out.timers.push({ id: 'expiry', label: pastExpiry ? 'Deadline passed' : 'Seller deadline', endsAt: expiredAt })
    if (!pastExpiry) {
      out.headline = isProvider ? 'Funds are escrowed. Deliver before the deadline.' : 'Funds are escrowed. Waiting for the seller to deliver.'
      if (isProvider) add('submit', 'Submit work', { primary: true })
      if (isClient) add('extend', 'Extend deadline', { hint: 'Delays only your own refund.' })
      if (isClient) out.note = 'Escrowed USDC stays locked until the seller submits or the deadline passes.'
    } else {
      out.headline = 'The deadline passed without a submission. The buyer can reclaim the funds.'
      add('claimRefund', 'Refund buyer', { primary: isClient, hint: 'Anyone can trigger this. The money goes to the buyer.' })
    }
    return out
  }

  if (status === JobStatus.Submitted) {
    out.phase = rstate === RouterState.Disputed ? 'disputed' : 'review'
    out.timers.push({ id: 'expiry', label: 'Hard deadline (refund path)', endsAt: expiredAt, minor: true })

    if (rstate === RouterState.Configured) {
      const reviewOpen = reviewEnd === null ? true : now < reviewEnd
      if (reviewEnd) out.timers.unshift({ id: 'review', label: reviewOpen ? 'Buyer review window' : 'Review window ended', endsAt: reviewEnd })
      if (reviewOpen) {
        out.headline = isClient ? 'Review the deliverable, then approve or reject.' : isProvider ? 'Submitted. The buyer is reviewing.' : 'Submitted and under buyer review.'
        if (isClient) {
          add('approve', 'Approve & release payment', { primary: true })
          add('reject', 'Reject with reason', { tone: 'danger', hint: 'Opens a dispute. Nothing is refunded until it resolves.' })
        }
        if (isProvider) out.note = 'If the buyer stays silent, anyone can release payment to you after the review window.'
      } else {
        out.headline = isProvider ? 'The review window ended. Release your payment.' : 'The review window ended with no response from the buyer.'
        add('autoRelease', 'Release payment to seller', { primary: isProvider || !isClient, hint: 'Anyone can trigger this.' })
        if (isClient) add('approve', 'Approve & release payment', { primary: true })
      }
      return out
    }

    if (rstate === RouterState.Disputed) {
      const contested = !!rs?.contested
      if (!contested) {
        const respOpen = responseEnd === null ? true : now <= responseEnd
        if (responseEnd) out.timers.unshift({ id: 'response', label: respOpen ? 'Seller response window' : 'Response window ended', endsAt: responseEnd })
        if (respOpen) {
          out.headline = isProvider ? 'The buyer rejected your work. Accept the refund or contest.' : 'Dispute opened. Waiting for the seller to respond.'
          if (isProvider) {
            add('contest', 'Contest with evidence', { primary: true })
            add('acceptRejection', 'Accept rejection (refund buyer)', { tone: 'danger' })
          }
          if (isClient) add('approve', 'Withdraw dispute and approve', { hint: 'Pays the seller in full.' })
        } else {
          out.headline = 'The seller did not respond. The rejection stands and the buyer is refunded.'
          add('finalizeUncontested', 'Finalize refund to buyer', { primary: isClient, hint: 'Anyone can trigger this.' })
          if (isClient) add('approve', 'Approve & release payment instead', { tone: 'neutral' })
        }
        return out
      }
      // Contested: deciders vote
      const decOpen = decisionEnd === null ? true : now <= decisionEnd
      if (decisionEnd) out.timers.unshift({ id: 'decision', label: decOpen ? 'Decision window' : 'Decision window ended', endsAt: decisionEnd })
      const voted = (rs?.votes || []).length
      const total = (rs?.deciders || []).length
      out.note = `${voted} of ${total} decider vote${total === 1 ? '' : 's'} recorded.`
      if (decOpen) {
        out.headline = isDecider ? 'You are a decider for this dispute. Review both sides and vote.' : 'Contested. Waiting for the agreed decider(s).'
        if (isDecider && !hasVoted && !isClient && !isProvider) add('vote', 'Cast decision', { primary: true })
        if (isDecider && hasVoted) out.note += ' You have voted.'
        if (isClient) add('approve', 'Withdraw dispute and approve', { hint: 'Pays the seller in full.' })
      } else {
        out.headline = 'The decision window ended. Anyone can finalize by the agreed rule.'
        add('finalizeTimeout', 'Finalize by timeout rule', { primary: true, hint: 'Majority median if enough votes, else the agreed default split.' })
      }
      return out
    }

    // Submitted but router not configured (job created outside the board): only the hard deadline applies.
    out.headline = 'Submitted. This job has no agreed evaluation terms.'
    if (pastExpiry) add('claimRefund', 'Refund buyer', { primary: isClient })
    return out
  }

  out.phase = 'final'
  out.headline = STATUS_LABEL[status] || 'Closed'
  return out
}

/** Human line for a deadline countdown. */
export function formatRemaining(endsAt: number | bigint, now: number): string {
  const s = Number(endsAt) - now
  if (s <= 0) return 'ended'
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${Math.max(1, m)}m`
}
