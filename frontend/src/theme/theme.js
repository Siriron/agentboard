// Theme engine. Modes: 'auto' | 'light' | 'dark'.
//  - Only an explicit 'light' or 'dark' choice is stored (localStorage 'agentboard.theme').
//    Auto = no stored value, so it keeps following the visitor's local time.
//  - Auto uses the browser's LOCAL clock (new Date().getHours()), so it respects the visitor's timezone
//    with no geolocation and no server time. Day is 06:00 to 17:59 local, night is 18:00 to 05:59.
//  - If the clock is unusable, fall back to the system colour-scheme preference, then to light.
//  - Re-evaluated when the tab regains focus/visibility and by ONE timeout aimed at the next boundary (no polling).
export const THEME_KEY = 'agentboard.theme'
export const DAY_START = 6
export const NIGHT_START = 18

const listeners = new Set()
let mode = 'auto'
let resolved = 'light'
let timer = null

export function resolveAuto(now = new Date()) {
  const h = now.getHours()
  if (Number.isInteger(h)) return h >= DAY_START && h < NIGHT_START ? 'light' : 'dark'
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' } catch { return 'light' }
}

/** Milliseconds until the next 06:00 / 18:00 local boundary. */
export function msToNextBoundary(now = new Date()) {
  const next = new Date(now)
  const h = now.getHours()
  if (h < DAY_START) next.setHours(DAY_START, 0, 0, 0)
  else if (h < NIGHT_START) next.setHours(NIGHT_START, 0, 0, 0)
  else { next.setDate(next.getDate() + 1); next.setHours(DAY_START, 0, 0, 0) }
  return Math.max(1000, next.getTime() - now.getTime())
}

function readStored() {
  try { const v = localStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : 'auto' } catch { return 'auto' }
}

function apply() {
  resolved = mode === 'auto' ? resolveAuto() : mode
  const r = document.documentElement
  r.dataset.theme = resolved
  r.dataset.themeMode = mode
  r.style.colorScheme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0d0e11' : '#efeadf')
  listeners.forEach(l => l())
}

function schedule() {
  if (timer) clearTimeout(timer)
  timer = null
  if (mode !== 'auto') return
  timer = setTimeout(() => { apply(); schedule() }, msToNextBoundary())
}

export function setThemeMode(next) {
  mode = next === 'light' || next === 'dark' ? next : 'auto'
  try { mode === 'auto' ? localStorage.removeItem(THEME_KEY) : localStorage.setItem(THEME_KEY, mode) } catch { /* storage blocked: still applies for this session */ }
  apply(); schedule()
}

export function initTheme() {
  mode = readStored()
  apply(); schedule()
  const recheck = () => { if (mode === 'auto') { apply(); schedule() } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recheck() })
  window.addEventListener('focus', recheck)
  window.addEventListener('storage', e => { if (e.key === THEME_KEY) { mode = readStored(); apply(); schedule() } }) // other tabs
}

export const subscribeTheme = fn => { listeners.add(fn); return () => listeners.delete(fn) }
export const getThemeSnapshot = () => `${mode}|${resolved}`
