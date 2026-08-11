import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * E2E config for the one class of bug unit tests structurally cannot reach:
 * behaviour that differs between the dev server and a production bundle.
 *
 * There is deliberately no dev-server mode. The regression this suite exists
 * for (see the recharts section of this app's TODO) rendered charts blank in
 * the production build ONLY - React's dev-only double-invocation of effects
 * papered over it under `vite dev`. A suite that ran against the dev server
 * would have passed while the deployed site was broken, so `preview` (which
 * serves the real `vite build` output) is the only mode offered.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  // No retries, on purpose. This suite is small and deterministic; a retry
  // here would convert a real production-only regression into a flake that
  // passes on the second attempt and never gets looked at.
  retries: 0,

  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // Serves dist/ - `npm run build` must have run first. The turbo `test:e2e`
    // task declares that dependency so `turbo run test:e2e` handles it.
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
