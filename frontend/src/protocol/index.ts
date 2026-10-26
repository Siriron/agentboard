import { protocolFor } from '../lib/networks'
import { v1Info, type ProtocolInfo } from './v1'

export const v2Info: ProtocolInfo = {
  id: 'v2', network: 'mainnet', label: 'AgentBoard V2 (Arc Mainnet)',
  capabilities: { listings: true, evaluatorRouter: true, receipts: true, circleAgentWallet: false },
}

export function getProtocolInfo(network: 'testnet' | 'mainnet'): ProtocolInfo | null {
  const p = protocolFor(network)
  return p === 'v1' ? v1Info : p === 'v2' ? v2Info : null
}
