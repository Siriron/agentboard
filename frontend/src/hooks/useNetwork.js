import { useSyncExternalStore } from 'react'
import {
  NETWORKS, getActiveNetworkKey, setActiveNetworkKey, subscribeNetwork, isProtocolLive,
} from '../lib/networks'

export function useNetwork() {
  const key = useSyncExternalStore(subscribeNetwork, getActiveNetworkKey, getActiveNetworkKey)
  const network = NETWORKS[key]
  return { key, network, setNetwork: setActiveNetworkKey, protocolLive: isProtocolLive(key) }
}
