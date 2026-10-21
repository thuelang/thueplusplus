import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'hash-target.spec.ts',
  timeout: 40_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.HASH_BASE ?? 'http://127.0.0.1:4173',
    testIdAttribute: 'data-test',
  },
})
