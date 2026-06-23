// Goldsky GraphQL client
// After deploying the subgraph, set VITE_GOLDSKY_URL in your Vercel env vars:
// VITE_GOLDSKY_URL=https://api.goldsky.com/api/public/<project-id>/subgraphs/agentboard/1.0.0/gn

const GOLDSKY_URL = import.meta.env.VITE_GOLDSKY_URL || null

async function query(gql, variables = {}) {
  if (!GOLDSKY_URL) return null
  try {
    const res = await fetch(GOLDSKY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gql, variables }),
    })
    const { data, errors } = await res.json()
    if (errors?.length) throw new Error(errors[0].message)
    return data
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

// Agent stats by address
export async function getAgentStats(address) {
  return query(`
    query AgentStats($id: ID!) {
      agent(id: $id) {
        address agentId jobsCompleted totalEarned registeredAt
      }
    }
  `, { id: address.toLowerCase() })
}

// Top agents leaderboard
export async function getLeaderboard(limit = 10) {
  return query(`
    query Leaderboard($limit: Int) {
      agents(orderBy: totalEarned, orderDirection: desc, first: $limit) {
        address agentId jobsCompleted totalEarned
      }
    }
  `, { limit })
}

export const isGoldskyEnabled = () => !!GOLDSKY_URL
