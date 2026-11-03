import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export type SelectOption = { value: string; label: string }

type Props = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Accessible name when no visible <label> points at the control. */
  ariaLabel?: string
  id?: string
  size?: 'md' | 'sm'
  /** Shrink to the content width instead of filling the row (toolbars). */
  auto?: boolean
  className?: string
}

/**
 * Select-only combobox. Replaces the native <select>, whose OS picker ignores the app's fonts and spacing on mobile.
 * Keyboard: Enter / Space / ArrowDown open, arrows + Home / End move, Enter / Space choose, Esc closes, letters jump.
 */
export default function Select({ value, onChange, options, ariaLabel, id, size = 'md', auto = false, className = '' }: Props) {
  const uid = useId()
  const listId = `${uid}-list`
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const selected = Math.max(0, options.findIndex(o => o.value === value))
  const [active, setActive] = useState(selected)

  const show = useCallback(() => {
    const r = root.current?.getBoundingClientRect()
    if (r) { const below = window.innerHeight - r.bottom; setUp(below < 280 && r.top > below) }
    setActive(selected); setOpen(true)
  }, [selected])
  const hide = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) hide() }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open, hide])

  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const choose = (i: number) => { const o = options[i]; if (o) onChange(o.value); hide() }

  const onKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show() }
      return
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive(a => Math.min(last, a + 1)); break
      case 'ArrowUp': e.preventDefault(); setActive(a => Math.max(0, a - 1)); break
      case 'Home': e.preventDefault(); setActive(0); break
      case 'End': e.preventDefault(); setActive(last); break
      case 'Enter': case ' ': e.preventDefault(); choose(active); break
      case 'Escape': e.preventDefault(); hide(); break
      case 'Tab': hide(); break
      default:
        if (e.key.length === 1) {
          const k = e.key.toLowerCase()
          const n = options.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(k))
          const f = n >= 0 ? n : options.findIndex(o => o.label.toLowerCase().startsWith(k))
          if (f >= 0) setActive(f)
        }
    }
  }

  return (
    <div ref={root} className={`sel${size === 'sm' ? ' is-sm' : ''}${auto ? ' is-auto' : ''}${className ? ` ${className}` : ''}`}>
      <button type="button" id={id} className="sel-btn" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-label={ariaLabel} aria-activedescendant={open ? `${uid}-o${active}` : undefined}
        onClick={() => (open ? hide() : show())} onKeyDown={onKey}>
        <span className="sel-val">{options[selected]?.label ?? ''}</span>
        <ChevronDown className="sel-chev" size={16} aria-hidden />
      </button>
      {open && (
        <div ref={list} id={listId} role="listbox" aria-label={ariaLabel} className={`sel-panel${up ? ' is-up' : ''}`}>
          {options.map((o, i) => (
            <div key={o.value} id={`${uid}-o${i}`} data-i={i} role="option" aria-selected={i === selected}
              className={`sel-opt${i === active ? ' is-active' : ''}`}
              onPointerEnter={() => setActive(i)} onPointerDown={e => e.preventDefault()} onClick={() => choose(i)}>
              <span>{o.label}</span>{i === selected && <Check size={15} aria-hidden />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Display names for the contract's category strings. The stored value never changes. */
export const categoryLabel = (c: string) => (c === 'SmartContract' ? 'Smart contract' : c)
