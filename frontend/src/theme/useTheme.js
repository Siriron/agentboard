import { useSyncExternalStore } from 'react'
import { getThemeSnapshot, setThemeMode, subscribeTheme } from './theme'

export function useTheme() {
  const snap = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => 'auto|light')
  const [mode, resolved] = snap.split('|')
  return { mode, resolved, setMode: setThemeMode }
}
