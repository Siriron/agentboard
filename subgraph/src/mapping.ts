import { BigInt } from '@graphprotocol/graph-ts'
import { JobPosted, BidSubmitted, AgentHired, JobValidated } from '../generated/AgentEscrow/AgentEscrow'
import { Job, Bid, Agent, Payment, Protocol } from '../generated/schema'

function getOrCreateProtocol(): Protocol {
  let p = Protocol.load('agentboard')
  if (!p) {
    p = new Protocol('agentboard')
    p.totalJobs = BigInt.fromI32(0)
    p.totalBids = BigInt.fromI32(0)
    p.totalPaid = BigInt.fromI32(0)
    p.lastUpdated = BigInt.fromI32(0)
  }
  return p
}

export function handleJobPosted(event: JobPosted): void {
  let job = new Job(event.params.jobId.toString())
  job.jobId = event.params.jobId
  job.client = event.params.client
  job.title = event.params.title
  job.budget = event.params.budget
  job.status = 0
  job.bidCount = BigInt.fromI32(0)
  job.postedAt = event.block.timestamp
  job.save()
  let p = getOrCreateProtocol()
  p.totalJobs = p.totalJobs.plus(BigInt.fromI32(1))
  p.lastUpdated = event.block.timestamp
  p.save()
}

export function handleBidSubmitted(event: BidSubmitted): void {
  let bid = new Bid(event.params.jobId.toString() + '-' + event.params.agent.toHex())
  bid.job = event.params.jobId.toString()
  bid.agent = event.params.agent
  bid.agentId = event.params.agentId
  bid.proposedAmount = event.params.proposedAmount
  bid.submittedAt = event.block.timestamp
  bid.hired = false
  bid.save()
  let job = Job.load(event.params.jobId.toString())
  if (job) { job.bidCount = job.bidCount.plus(BigInt.fromI32(1)); job.save() }
  let p = getOrCreateProtocol()
  p.totalBids = p.totalBids.plus(BigInt.fromI32(1))
  p.lastUpdated = event.block.timestamp
  p.save()
}

export function handleAgentHired(event: AgentHired): void {
  let job = Job.load(event.params.jobId.toString())
  if (job) { job.status = 1; job.hiredAgent = event.params.agent; job.budget = event.params.amount; job.save() }
  let bid = Bid.load(event.params.jobId.toString() + '-' + event.params.agent.toHex())
  if (bid) { bid.hired = true; bid.save() }
}

export function handleJobValidated(event: JobValidated): void {
  let job = Job.load(event.params.jobId.toString())
  if (job) { job.status = 3; job.payout = event.params.payout; job.validatedAt = event.block.timestamp; job.save() }
  let payment = new Payment(event.params.jobId.toString() + '-pay')
  payment.job = event.params.jobId.toString()
  payment.agent = event.params.agent
  payment.amount = event.params.payout
  payment.timestamp = event.block.timestamp
  payment.txHash = event.transaction.hash
  payment.save()
  let agent = Agent.load(event.params.agent.toHex())
  if (!agent) {
    agent = new Agent(event.params.agent.toHex())
    agent.address = event.params.agent
    agent.agentId = BigInt.fromI32(0)
    agent.jobsCompleted = BigInt.fromI32(0)
    agent.totalEarned = BigInt.fromI32(0)
    agent.registeredAt = event.block.timestamp
  }
  agent.jobsCompleted = agent.jobsCompleted.plus(BigInt.fromI32(1))
  agent.totalEarned = agent.totalEarned.plus(event.params.payout)
  agent.save()
  let p = getOrCreateProtocol()
  p.totalPaid = p.totalPaid.plus(event.params.payout)
  p.lastUpdated = event.block.timestamp
  p.save()
}
