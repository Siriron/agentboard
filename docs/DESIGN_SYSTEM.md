# AgentBoard design system

Presentation layer only. `frontend/src/protocol/`, `lib/arc.js`, `lib/networks.js`, the wallet hooks and all contracts are not touched by it.

## Tokens and themes
- `src/styles/tokens.css`: fonts (self-hosted via @fontsource, no CDN), radius, motion, and two palettes. Light is white with slate neutrals, dark is zinc. Fonts are Geist and Geist Mono. The old variable names (`--bg`, `--text-1`, `--accent`...) are the semantic layer, so every page follows the theme.
- `--main` (ember, real USDC) and `--test` (teal, practice) are the network colours, used identically by the switch, launch buttons, tags and banners. `--on-accent` / `--on-test` are the text colours on them (they differ per theme for contrast).
- `src/styles/base.css`: buttons, inputs, cards, badges, header, notices, board/dashboard/leaderboard layouts. `src/styles/landing.css`: landing only.

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
