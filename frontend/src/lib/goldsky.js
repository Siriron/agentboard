// Goldsky GraphQL client
// After deploying the subgraph, set VITE_GOLDSKY_URL in your Vercel env vars:
// VITE_GOLDSKY_URL=https://api.goldsky.com/api/public/<project-id>/subgraphs/agentboard/1.0.0/gn

const GOLDSKY_URL = import.meta.env.VITE_GOLDSKY_URL || null

// Callers that need to tell "no data" apart from "query failed" should use
// queryOrThrow instead of query — e.g. a page that would otherwise render
// an identical empty state for both cases. `query` keeps its old
// swallow-and-log behavior for lower-stakes, best-effort call sites (like
// Dashboard's non-blocking enrichment) that intentionally don't want a
// Goldsky outage to affect their primary (chain-read) data path.
async function queryOrThrow(gql, variables = {}) {
  if (!GOLDSKY_URL) throw new Error('VITE_GOLDSKY_URL is not configured')
  const res = await fetch(GOLDSKY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: gql, variables }),
  })
  if (!res.ok) throw new Error(`Goldsky request failed: ${res.status} ${res.statusText}`)
  const { data, errors } = await res.json()
  if (errors?.length) throw new Error(errors[0].message)
  return data
}

async function query(gql, variables = {}) {
  try {
    return await queryOrThrow(gql, variables)
  } catch (e) {
    console.warn('[Goldsky]', e.message)
    return null
  }
}

// Get open jobs sorted by budget
export async function getOpenJobs(limit = 20, skip = 0) {
  return query(`
    query GetOpenJobs($limit: Int, $skip: Int) {
      jobs(where: { status: 0 }, orderBy: budget, orderDirection: desc, first: $limit, skip: $skip) {
        id jobId title budget bidCount postedAt client
      }
    }
  `, { limit, skip })
}

// Get all bids for a job
export async function getJobBids(jobId) {
  return query(`
    query GetBids($jobId: String) {
      bids(where: { job: $jobId }) {
        agent agentId proposedAmount submittedAt hired
      }
    }
  `, { jobId: jobId.toString() })
}

// Protocol-wide stats
export async function getProtocolStats() {
  return query(`
    {
      protocol(id: "agentboard") {
        totalJobs totalBids totalPaid lastUpdated
      }
    }
  `)
}

// Recent activity feed — jobs, bids, payments
export async function getRecentActivity(limit = 10) {
  return query(`
    query RecentActivity($limit: Int) {
      recentJobs: jobs(orderBy: postedAt, orderDirection: desc, first: $limit) {
        jobId title budget postedAt
      }
      recentBids: bids(orderBy: submittedAt, orderDirection: desc, first: $limit) {
        job { jobId title } agent proposedAmount submittedAt
      }
      recentPayments: payments(orderBy: timestamp, orderDirection: desc, first: $limit) {
        job { jobId title } agent amount timestamp txHash
      }
    }
  `, { limit })
}

// Agent stats by address. Now includes `registered`/`registeredAt`, which
// only resolve to real values once the subgraph's AgentRegistered handler
// (added alongside this) has backfilled from the AgentRegistered event —
// on a subgraph deployed with startBlock: 0 that happens automatically,
// but on a subgraph re-pointed to a later startBlock, agents who
// registered before that block will show registered: false here even
// though registerAgent() succeeded onchain. Cross-check with the direct
// agentIdRegistered() read in arc.js (as Register.jsx already does) if
// that mismatch ever shows up.
export async function getAgentStats(address) {
  return query(`
    query AgentStats($id: ID!) {
      agent(id: $id) {
        address agentId registered registeredAt jobsCompleted totalEarned
      }
    }
  `, { id: address.toLowerCase() })
}

// Same as getAgentStats but throws on failure/misconfiguration instead of
// resolving null — use this where the caller needs to show the user a
// real error rather than an indistinguishable empty state.
export async function getAgentStatsOrThrow(address) {
  return queryOrThrow(`
    query AgentStats($id: ID!) {
      agent(id: $id) {
        address agentId registered registeredAt jobsCompleted totalEarned
      }
    }
  `, { id: address.toLowerCase() })
}

// Top agents leaderboard — registered-but-unpaid agents now show up here
// too (jobsCompleted: 0, totalEarned: 0) rather than being absent, since
// AgentRegistered now creates the Agent entity instead of JobValidated
// being the only creation path.
export async function getLeaderboard(limit = 10) {
  return query(`
    query Leaderboard($limit: Int) {
      agents(orderBy: totalEarned, orderDirection: desc, first: $limit) {
        address agentId registered jobsCompleted totalEarned
      }
    }
  `, { limit })
}

export const isGoldskyEnabled = () => !!GOLDSKY_URL
