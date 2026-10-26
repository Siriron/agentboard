// V1 is the live Arc Testnet escrow (0x0DbB…E5a0E4). Its pages keep calling lib/arc.js exactly as
// before; this module only describes it so routing code can treat both protocols the same way.
// Nothing here reads or writes the testnet contract.

export interface ProtocolInfo {
  id: 'v1' | 'v2'
  network: 'testnet' | 'mainnet'
  label: string
  capabilities: { listings: boolean; evaluatorRouter: boolean; receipts: boolean; circleAgentWallet: boolean }
}

export const v1Info: ProtocolInfo = {
  id: 'v1', network: 'testnet', label: 'AgentBoard V1 (Arc Testnet)',
  capabilities: { listings: false, evaluatorRouter: false, receipts: false, circleAgentWallet: true },
}
