// Guards the design brief's exact palettes. If someone edits a token, this fails.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8')
const light = css.slice(css.indexOf("[data-theme='light']"), css.indexOf("[data-theme='dark']"))
const dark = css.slice(css.indexOf("[data-theme='dark']"))
const val = (blk: string, k: string) => blk.match(new RegExp(k.replace(/[-]/g, '\\-') + ':\\s*(#[0-9a-fA-F]{6})'))?.[1].toUpperCase()

describe('brief palette', () => {
  it.each(Object.entries({ '--bg': '#FFFFFF', '--bg-surface': '#F8FAFC', '--bg-subtle': '#F1F5F9', '--bg-card': '#FFFFFF', '--text-1': '#111827', '--text-2': '#64748B', '--text-3': '#94A3B8', '--border': '#E5E7EB', '--border-light': '#F1F5F9', '--btn-bg': '#111827', '--btn-fg': '#FFFFFF', '--test': '#0F766E', '--accent': '#E54826' }))('light %s', (k, v) => expect(val(light, k)).toBe(v))
  it.each(Object.entries({ '--bg': '#09090B', '--bg-surface': '#111113', '--bg-card': '#18181B', '--bg-elevated': '#202024', '--text-1': '#FAFAFA', '--text-2': '#A1A1AA', '--text-3': '#71717A', '--border': '#27272A', '--btn-bg': '#FAFAFA', '--btn-fg': '#09090B', '--test': '#2DD4BF', '--accent': '#FB704F' }))('dark %s', (k, v) => expect(val(dark, k)).toBe(v))
})
