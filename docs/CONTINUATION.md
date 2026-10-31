# AgentBoard redesign: continuation brief (paste into a new chat)

Repo: Siriron/agentboard, frontend in `frontend/` (Vite, React, three.js). Contracts, `src/protocol/`, `lib/arc.js`, `lib/networks.js`, wallet hooks: DO NOT CHANGE.

## Non-negotiable owner requirements
- Exact palettes (guarded by `src/theme/palette.test.ts`): Light #FFFFFF / #F8FAFC / #F1F5F9, text #111827 / #64748B / #94A3B8, border #E5E7EB, primary button #111827, teal #0F766E, orange #E54826. Dark #09090B / #111113 / #18181B / #202024, text #FAFAFA / #A1A1AA / #71717A, border #27272A, primary #FAFAFA, teal #2DD4BF, orange #FB704F. No beige or cream anywhere. Teal = Testnet, orange = Mainnet.
- Geist + Geist Mono. 10 to 12px button radius, no pills, no big promotional buttons.
- Network control = ONLY the two header buttons. Testnet opens `/testnet`, Mainnet (with one-time confirm) opens `/mainnet`. Separate pages, never Jobs, never a split-screen layout.
- Landing `/`: full-width stacked sections, centred hero with the robot below the headline, floating cards, example-job card, stats, steps, escrow, bento, rail, roles. No sticky half-screen robot.
- Robot: original mascot, scroll-driven camera, touch must not block scrolling, taps react, reduced motion respected.
- Do not fabricate data or claims. Say what is untested.

## State (see `git log`)
Done and browser-verified (headless Chromium): routing, exact colours, theme persistence, mobile overflow 0, header flows, mascot swipe-scroll.
Not verified: iOS Safari, real Android, real GPU frame rate (software WebGL ran ~5 fps in the sandbox), wallet connect, live-data pages.
Known gaps: testnet (V1) pages use the new tokens but their layouts are not individually redesigned; `--text-3` (#94A3B8) is below AA on white by the owner's choice; white text on #E54826 is 3.9:1.

## How to look at it (do this before claiming anything)
`npm i puppeteer-core @sparticuz/chromium` in a scratch dir, launch with `--use-angle=swiftshader`, run `vite preview`, screenshot at 390x844 and 1440x900 in both themes. `npm run typecheck && npm test && npm run test:e2e && npm run build` must stay green (e2e needs solc 0.8.28 and `contracts-v2/script/install-deps.sh`).
