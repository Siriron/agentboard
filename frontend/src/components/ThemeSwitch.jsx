import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme/useTheme'

// Three explicit states. "Auto" follows the visitor's local time; Light and Dark are saved choices.
const OPTIONS = [
  { value: 'auto', label: 'Auto', Icon: Monitor, hint: 'Follow local time: light by day, dark at night' },
  { value: 'light', label: 'Light', Icon: Sun, hint: 'Always light' },
  { value: 'dark', label: 'Dark', Icon: Moon, hint: 'Always dark' },
]

export default function ThemeSwitch({ wide = false, compact = false }) {
  const { mode, resolved, setMode } = useTheme()
  if (compact) {
    // One square button that cycles Auto, Light, Dark. The full three-way control lives in the mobile menu.
    const i = Math.max(0, OPTIONS.findIndex(o => o.value === mode))
    const cur = OPTIONS[i], next = OPTIONS[(i + 1) % OPTIONS.length]
    return (
      <button type="button" className="hdr-ctl-btn" onClick={() => setMode(next.value)}
        aria-label={`Theme: ${cur.label}. Switch to ${next.label}`} title={`Theme: ${cur.label}. Click for ${next.label}`}>
        <cur.Icon size={16} aria-hidden />
      </button>
    )
  }
  return (
    <div className={`theme-switch${wide ? ' is-wide' : ''}`} role="radiogroup" aria-label={`Theme. Now showing ${resolved}${mode === 'auto' ? ' (automatic, from local time)' : ''}`}>
      {OPTIONS.map(({ value, label, Icon, hint }) => (
        <button key={value} role="radio" aria-checked={mode === value} aria-label={label} title={hint} onClick={() => setMode(value)}>
          <Icon size={15} aria-hidden /><span className="ts-label">{label}</span>
        </button>
      ))}
    </div>
  )
}
