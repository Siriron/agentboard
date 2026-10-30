import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme/useTheme'

// Three explicit states. "Auto" follows the visitor's local time; Light and Dark are saved choices.
const OPTIONS = [
  { value: 'auto', label: 'Auto', Icon: Monitor, hint: 'Follow local time: light by day, dark at night' },
  { value: 'light', label: 'Light', Icon: Sun, hint: 'Always light' },
  { value: 'dark', label: 'Dark', Icon: Moon, hint: 'Always dark' },
]

export default function ThemeSwitch({ wide = false }) {
  const { mode, resolved, setMode } = useTheme()
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
