// Pure leaderboard aggregation over hired jobs. No chain access, so it is unit-tested directly.
export interface JobFact { client: string; provider: string; budget: bigint; status: number }
export interface LeaderRow { address: string; completed: number; hired: number; volume: bigint }

const COMPLETED = 4 // JobStatus.Completed: paid to seller

function build(jobs: JobFact[], pick: (j: JobFact) => string): LeaderRow[] {
  const m = new Map<string, LeaderRow>()
  for (const j of jobs) {
    const key = pick(j).toLowerCase()
    const r = m.get(key) ?? { address: pick(j), completed: 0, hired: 0, volume: 0n }
    r.hired += 1
    if (j.status === COMPLETED) { r.completed += 1; r.volume += j.budget }
    m.set(key, r)
  }
  return [...m.values()].sort((a, b) => (a.volume === b.volume ? b.completed - a.completed || b.hired - a.hired : a.volume < b.volume ? 1 : -1))
}

export const sellerBoard = (jobs: JobFact[]) => build(jobs, j => j.provider)
export const buyerBoard = (jobs: JobFact[]) => build(jobs, j => j.client)
