import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

let buildId = 'dev'
try { buildId = execSync('git rev-parse --short HEAD').toString().trim() } catch { /* not a git checkout */ }

export default defineConfig({
  test: { exclude: ['e2e/**', 'node_modules/**'] },
  plugins: [react()],
  define: { __BUILD_ID__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : buildId) },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          web3: ['viem'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'viem', 'lucide-react'],
  },
})
