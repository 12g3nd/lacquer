import { defineConfig } from '@playwright/test';

/**
 * Lacquer's Playwright setup.
 *
 * Two suites, deliberately separated because they have different costs and
 * different failure meanings:
 *
 *   - `smoke`    — upstream's launch test plus Lacquer's headless checks.
 *                  Fast, runs anywhere, safe in CI.
 *   - `capture`  — drives the real Electron window and writes screenshots to
 *                  `test-results/capture/`. This is the stage gate: a stage is
 *                  not complete until its captures exist and have been looked
 *                  at. Serial, because it launches the actual app.
 *
 * Run everything:            pnpm test
 * Run just the gate:         pnpm test:capture
 */
export default defineConfig({
  testDir: './tests',
  // Electron launches are not safe to parallelise: they contend for the same
  // userData directory and the same single-instance lock.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 120_000,
  expect: { timeout: 15_000 },

  projects: [
    {
      name: 'smoke',
      testMatch: ['**/index.test.js', '**/*.smoke.spec.ts'],
    },
    {
      name: 'capture',
      testMatch: ['**/*.capture.spec.ts'],
      // Captures drive a real signed-in app over CDP — searching, opening an
      // album, playing a track, toggling the overlay, resizing. That is minutes
      // of genuine UI settling, not the seconds a headless assertion takes.
      timeout: 360_000,
    },
  ],
});
