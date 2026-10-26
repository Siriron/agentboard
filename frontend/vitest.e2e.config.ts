import { defineConfig } from 'vitest/config'

// Local-chain end-to-end test of the real adapter code against the real contracts.
// Run: npm run test:e2e   (needs foundry: anvil, forge on PATH; solc via FOUNDRY_SOLC if offline)
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.test.ts'],
    globalSetup: ['e2e/setup.ts'],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
