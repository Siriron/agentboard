import { describe, expect, it } from 'vitest'
import { describeJob, type JobLike, type RouterStateLike } from './state'

const C = '0x1111111111111111111111111111111111111111'
const P = '0x2222222222222222222222222222222222222222'
const V = '0x3333333333333333333333333333333333333333'
const base = (o: Partial<JobLike> = {}): JobLike => ({ client: C, provider: P, status: 3, expiredAt: 10_000_000, submittedAt: 1000, ...o })
const rs = (o: Partial<RouterStateLike> = {}): RouterStateLike => ({ state: 1, contested: false, disputedAt: 0, deciders: [V], votes: [], ...o })
const cfg = { reviewWindow: 86400, responseWindow: 86400, decisionWindow: 172800 }
const ids = (v: ReturnType<typeof describeJob>) => v.actions.map(a => a.id)

describe('describeJob', () => {
  it('funded: seller submits, buyer extends', () => {
    expect(ids(describeJob({ job: base({ status: 2 }), rs: rs({ state: 0 }), cfg, me: P, now: 2000 }))).toEqual(['submit'])
    expect(ids(describeJob({ job: base({ status: 2 }), rs: rs({ state: 0 }), cfg, me: C, now: 2000 }))).toEqual(['extend'])
  })
  it('funded past expiry: refund path for anyone', () => {
    const v = describeJob({ job: base({ status: 2, expiredAt: 1500 }), rs: rs({ state: 0 }), cfg, me: null, now: 2000 })
    expect(ids(v)).toEqual(['claimRefund'])
  })
  it('review window open: buyer approves or rejects, seller waits', () => {
    expect(ids(describeJob({ job: base(), rs: rs(), cfg, me: C, now: 2000 }))).toEqual(['approve', 'reject'])
    expect(ids(describeJob({ job: base(), rs: rs(), cfg, me: P, now: 2000 }))).toEqual([])
  })
  it('review window over: anyone auto-releases, seller primary', () => {
    const v = describeJob({ job: base(), rs: rs(), cfg, me: P, now: 1000 + 86400 })
    expect(ids(v)).toEqual(['autoRelease'])
    expect(v.actions[0]!.primary).toBe(true)
  })
  it('disputed: seller accepts or contests', () => {
    const v = describeJob({ job: base(), rs: rs({ state: 2, disputedAt: 5000 }), cfg, me: P, now: 6000 })
    expect(ids(v)).toEqual(['contest', 'acceptRejection'])
  })
  it('uncontested after response window: finalize refund', () => {
    const v = describeJob({ job: base(), rs: rs({ state: 2, disputedAt: 5000 }), cfg, me: null, now: 5000 + 86401 })
    expect(ids(v)).toEqual(['finalizeUncontested'])
  })
  it('contested: only an eligible decider votes; timeout finalizes', () => {
    const r = rs({ state: 2, disputedAt: 5000, contested: true })
    expect(ids(describeJob({ job: base(), rs: r, cfg, me: V, now: 6000 }))).toEqual(['vote'])
    expect(ids(describeJob({ job: base(), rs: r, cfg, me: V, hasVoted: true, now: 6000 }))).toEqual([])
    expect(ids(describeJob({ job: base(), rs: r, cfg, me: C, now: 6000 }))).toEqual(['approve'])
    expect(ids(describeJob({ job: base(), rs: r, cfg, me: null, now: 5000 + 172801 }))).toEqual(['finalizeTimeout'])
  })
  it('without verified windows buttons stay available (contract enforces)', () => {
    expect(ids(describeJob({ job: base(), rs: rs(), cfg: null, me: C, now: 2000 }))).toEqual(['approve', 'reject'])
  })
  it('terminal status has no actions', () => {
    expect(describeJob({ job: base({ status: 4 }), rs: rs({ state: 3 }), cfg, me: C, now: 2000 }).actions).toEqual([])
  })
})
