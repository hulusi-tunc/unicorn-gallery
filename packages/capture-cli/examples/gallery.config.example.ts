import { defineConfig } from '@unicorn-studio/gallery-capture';

export default defineConfig({
  projectId: 'example-app',

  baseUrl: 'http://localhost:3000',

  // Optional. Override how the route walker locates the app dir.
  // appDir: 'app',

  // Optional. Run before any route is visited. Use to log in.
  // auth: async (page) => {
  //   await page.goto('/login');
  //   await page.fill('[name=email]', 'demo@example.test');
  //   await page.fill('[name=password]', 'demo');
  //   await page.click('button[type=submit]');
  //   await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  // },

  // Optional. Seed fixtures into the running app before capture.
  // seed: async () => {
  //   await fetch('http://localhost:3000/api/test/seed', { method: 'POST' });
  // },

  // Glob patterns the route walker should not visit. * matches anything.
  skip: ['/internal/admin/*', '/_dev/*'],

  // Optional. Disable the auto route walker (e.g. for mobile-only projects).
  // skipRouteWalker: true,

  // Multi-step flow scripts.
  //  - .ts/.js/.mjs → Playwright flow (defineFlow)
  //  - .yaml/.yml   → Maestro flow (mobile)
  flows: [
    // 'flows/booking-padel.ts',
    // 'flows/onboarding.yaml',
  ],

  viewport: { width: 1440, height: 900 },
});
