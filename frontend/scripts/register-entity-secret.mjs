#!/usr/bin/env node
/**
 * AgentBoard — One-time Circle Entity Secret setup
 *
 * Run this ONCE locally, not on Vercel. It does the registration step
 * Circle requires before any wallet API call (create-wallet-set,
 * create-wallet, execute, etc.) will work. Skipping this step is the
 * #1 cause of "Request failed with status code 403" on first setup —
 * the API key can be perfectly valid and you'll still get 403 on
 * every call until this script has been run once.
 *
 * What it does:
 *   1. Generates a new 32-byte entity secret (or reuses CIRCLE_ENTITY_SECRET
 *      from your local .env if you already set one and just need to
 *      register it).
 *   2. Registers it with Circle using your CIRCLE_API_KEY.
 *   3. Saves a recovery file — KEEP THIS. Without it + the entity secret,
 *      you permanently lose access to any wallets you create.
 *   4. Prints the entity secret to paste into Vercel → Project →
 *      Settings → Environment Variables → CIRCLE_ENTITY_SECRET.
 *
 * Usage:
 *   cd frontend
 *   CIRCLE_API_KEY="TEST_API_KEY:xxxx:xxxx" node scripts/register-entity-secret.mjs
 *
 * Or put CIRCLE_API_KEY in a local .env file (never commit it) and run:
 *   node --env-file=.env scripts/register-entity-secret.mjs
 */

import {
  generateEntitySecret,
  registerEntitySecretCiphertext,
} from '@circle-fin/developer-controlled-wallets'

const apiKey = process.env.CIRCLE_API_KEY
if (!apiKey) {
  console.error('\n✗ Missing CIRCLE_API_KEY.\n')
  console.error('  Get a Testnet key from console.circle.com → your entity → API Keys.')
  console.error('  It looks like: TEST_API_KEY:xxxxxxxx:xxxxxxxx\n')
  console.error('  Then run:')
  console.error('    CIRCLE_API_KEY="TEST_API_KEY:..." node scripts/register-entity-secret.mjs\n')
  process.exit(1)
}
if (!apiKey.startsWith('TEST_API_KEY:')) {
  console.warn('⚠ This key does not start with "TEST_API_KEY:" — make sure you copied a TESTNET key, not a LIVE/Mainnet key.\n')
}

// Reuse an existing secret if one is already set locally (useful if a
// previous registration attempt was interrupted), otherwise generate fresh.
let entitySecret = process.env.CIRCLE_ENTITY_SECRET
if (entitySecret) {
  console.log('Using existing CIRCLE_ENTITY_SECRET from your environment...')
} else {
  console.log('Generating a new entity secret...')
  entitySecret = generateEntitySecret()
}

if (!/^[0-9a-fA-F]{64}$/.test(entitySecret)) {
  console.error(`\n✗ Entity secret is ${entitySecret.length} characters — it must be exactly 64 hex characters. Unset CIRCLE_ENTITY_SECRET and rerun this script to generate a fresh one.\n`)
  process.exit(1)
}

console.log('Registering entity secret with Circle (one-time, irreversible without rotation)...\n')

try {
  const response = await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
  })

  console.log('✓ Entity secret registered successfully.\n')
  console.log('A recovery file was saved in this directory (recovery_file_*.dat).')
  console.log('Move it somewhere safe OUTSIDE this repo — it is the only way to')
  console.log('recover wallet access if you ever lose this entity secret.\n')

  console.log('────────────────────────────────────────────────────────────')
  console.log('Now set these in Vercel → Project → Settings → Environment Variables:')
  console.log('────────────────────────────────────────────────────────────')
  console.log(`CIRCLE_API_KEY=${apiKey}`)
  console.log(`CIRCLE_ENTITY_SECRET=${entitySecret}`)
  console.log('────────────────────────────────────────────────────────────')
  console.log('\nAfter saving both, redeploy on Vercel (env var changes need a redeploy).')
  console.log('Then test with: GET https://arc-agentboard.vercel.app/api/agent-wallet?action=diagnose\n')

  if (response?.data?.recoveryFile) {
    console.log('(Recovery file content was also returned in the API response and saved to disk.)')
  }
} catch (err) {
  const status = err?.response?.status
  const body = err?.response?.data
  console.error('\n✗ Registration failed.\n')
  if (status === 401) {
    console.error('Circle rejected the API key (401). Double-check CIRCLE_API_KEY is copied correctly and is a Testnet key.')
  } else if (body?.message) {
    console.error(`Circle says: ${body.message} (code ${body.code ?? 'n/a'})`)
  } else {
    console.error(err.message || err)
  }
  console.error('\nIf this entity secret was already registered before, generating a NEW one (unset CIRCLE_ENTITY_SECRET first) and rerunning will fix a "already registered" style error.\n')
  process.exit(1)
}
