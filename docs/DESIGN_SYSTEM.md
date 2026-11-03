# AgentBoard design system

Presentation layer only. `frontend/src/protocol/`, `lib/arc.js`, `lib/networks.js`, the wallet hooks and all contracts are not touched by it.

## Principles
White and soft-gray surfaces, deep navy text, one hairline border, very soft shadows. Orange means Mainnet (real USDC), teal means Testnet (practice). Geist and Geist Mono, self-hosted. Motion is short and reduced-motion safe. Each screen has deliberate loading, empty, error and success states.

## Tokens and themes
- `src/styles/tokens.css`: fonts (self-hosted via @fontsource, no CDN), radius (`--r` 10, `--r-lg` 14, `--r-xl` 18), shadows (`--shadow-card`, `--shadow-lift`), motion, and two palettes. Light is white with slate neutrals, dark is zinc. The semantic names (`--bg`, `--text-1`, `--accent`...) let every page follow the theme.
- `--main` (ember, real USDC) and `--test` (teal, practice) are the network colours. `--net` resolves to one of them from `data-network` on `<html>`, set by `Layout`. Use `--net` for focus rings, hovers and highlights so they follow the active network. `--on-accent` / `--on-test` are the text colours on them.
- `src/styles/base.css`: buttons, inputs, cards, badges, header, footer, select, notices, board/dashboard/leaderboard layouts. `landing.css` and `networkhome.css`: the landing page and the per-network home pages.

## Components
- **Header:** every control is 36px tall with one radius and gap. The network switch is a recessed track with a raised active segment and a network-coloured dot. The theme control is a single cycling button from 640px up; the full three-way control lives in the mobile menu.
- **Select** (`components/Select.tsx`): replaces the native `<select>`. Select-only combobox with a popover listbox, keyboard support (arrows, Home, End, Enter, Escape, type-ahead) and flip-up near the screen edge. Use it for every dropdown.
- **Cards:** 14 to 18px radius, neutral border, `--shadow-card`. Links lift 2px and tint the border toward `--net` on hover, on hover-capable devices only.
- **Footer:** brand, two link groups, and a bottom bar with the copyright and a network pill. No build ids.

## Theme behaviour (`src/theme/theme.js`)
- Modes: Auto, Light, Dark. Only an explicit Light/Dark is stored (`localStorage: agentboard.theme`). Auto stores nothing.
- Auto uses the browser's local clock: light 06:00 to 17:59, dark 18:00 to 05:59. No geolocation, no server time. If the clock is unusable it falls back to `prefers-color-scheme`, then light.
- One timeout aims at the next boundary; the theme is also re-checked on focus and visibility. An inline script in `index.html` sets the theme before first paint.

## Network actions
`lib/selectNetwork.js` is the single switch path (header switch and the homepage `NetworkSelect`). Mainnet asks for a one-time per-session confirmation (`MainnetConfirm`). Switching network never opens an inner page: from the homepage you stay on it, from any other page you land on the homepage for that network.

## Mascot
- `src/mascot/scene.ts`: the three.js scene (lazy-loaded chunk, landing only). Pauses off-screen and when the tab is hidden, disposes GPU resources, falls back to the 2D avatar if WebGL fails.
- `MascotAvatar`: 2D SVG used in the app for empty/loading/error states and real status (escrow path, transaction result). It never implies the agent performed an action.
- Faces are shared: `src/mascot/expressions.ts`.

## README artwork
`docs/assets/*.svg` (banner, lifecycle, architecture; light and dark) are static SVGs with text converted to Geist outlines, so they render identically on GitHub. The README picks the variant with `prefers-color-scheme`.
