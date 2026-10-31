import { defineConfig, devices } from '@playwright/test';
const externalBaseURL = process.env.NBTI_E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/browser',
  // This branch serves the black-mirror experience. Historical role/video
  // suites remain in Git, but target routes that are absent from this edition.
  testMatch: ['**/mirror-flow.spec.js', '**/mirror-sharing.spec.js'],
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: externalBaseURL || 'http://127.0.0.1:5282',
    headless: true,
    channel: 'msedge',
    launchOptions: { args: ['--disable-gpu'] },
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', testIgnore: '**/mobile-layout.spec.js', use: { viewport: { width: 1440, height: 1050 } } },
    { name: 'mobile', use: { ...devices['iPhone 16'], defaultBrowserType: 'chromium', channel: 'msedge' } },
  ],
  webServer: externalBaseURL ? undefined : {
    command: 'npm run dev -- --port 5282 --strictPort', url: 'http://127.0.0.1:5282', reuseExistingServer: false,
    // UI-only development tests must never write to the real collection DB.
    env: { NBTI_DEV_BACKEND: 'disabled' },
  },
});
