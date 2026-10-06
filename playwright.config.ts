/**
 * End-to-end tests (Playwright). Three ways to run:
 *
 *   npm run e2e
 *     Deterministic, CI-safe. Starts `vite` on :5191 with AI_MOCK=true and a blank AI_API_KEY, so
 *     the analyze stage uses the offline mock provider and never calls a model. UI states come
 *     from page.route() stubs (e2e/fixtures) plus a few flows through the real dev handler.
 *
 *   npm run e2e:live                         (E2E_LIVE=1)
 *     Starts `vite` on :5192 with the real .env (model key) and runs e2e/live.spec.ts serially.
 *
 *   E2E_BASE_URL=https://<site> npm run e2e:live
 *     No local server: live tests + security headers + the stubbed UI smoke against that URL.
 *
 * Both local modes run `vite --config e2e/vite.e2e.config.ts` (the project config with file
 * watching off) so edits elsewhere in the repo cannot restart the server mid-run, and always a
 * fresh server (clean mock env + rate-limit window). Ports 5191/5192 must be free.
 *
 * Browsers: Chromium only. `npx playwright install chromium` (or `--only-shell` for headless).
 * PW_CHANNEL=msedge|chrome uses an installed browser instead of the bundled one.
 */
import { defineConfig, devices, type Project } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL?.trim().replace(/\/+$/, "") || "";
const REMOTE = BASE !== "";
const LIVE = process.env.E2E_LIVE === "1" || REMOTE;
const CI = !!process.env.CI;
const PORT = LIVE ? 5192 : 5191;
// 127.0.0.1 (not "localhost") so the browser and the request fixture share one client IP —
// the API's per-IP rate limit is part of what the suite checks.
const baseURL = REMOTE ? BASE : `http://127.0.0.1:${PORT}`;
const channel = process.env.PW_CHANNEL || undefined;

const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, channel };

const mobile = (width: number, height: number) => ({
  ...devices["Pixel 7"],
  viewport: { width, height },
  screen: { width, height },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  channel,
});

/** Specs that only use page.route() stubs for /api/understand (safe against any server). */
const STUBBED_UI = /(landing|composer|states|a11y)\.spec\.ts$/;

const defaultProjects: Project[] = [
  { name: "api", testMatch: /api\.spec\.ts$/ },
  { name: "desktop", testMatch: [STUBBED_UI, /real-handler\.spec\.ts$/], use: desktop },
  {
    name: "reduced-motion",
    testMatch: [/(landing|states|reduced-motion)\.spec\.ts$/],
    use: { ...desktop, reducedMotion: "reduce" },
  },
  { name: "mobile-390", testMatch: /mobile\.spec\.ts$/, use: mobile(390, 844) },
  { name: "mobile-360", testMatch: /mobile\.spec\.ts$/, use: mobile(360, 740) },
  { name: "headers", testMatch: /headers\.spec\.ts$/ },
  {
    // Exhausts the per-IP API budget, so it runs after every project that calls the API.
    name: "rate-limit",
    testMatch: /rate-limit\.spec\.ts$/,
    dependencies: ["api", "desktop", "reduced-motion", "mobile-390", "mobile-360"],
  },
];

const liveProjects: Project[] = [
  { name: "live", testMatch: /live\.spec\.ts$/, use: desktop, timeout: 90_000, expect: { timeout: 25_000 } },
  ...(REMOTE
    ? [
        { name: "headers", testMatch: /headers\.spec\.ts$/ },
        { name: "remote-ui", testMatch: /(landing|states)\.spec\.ts$/, use: desktop },
      ]
    : []),
];

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: !LIVE,
  forbidOnly: CI,
  retries: CI && !LIVE ? 1 : 0,
  // Live: one request at a time keeps the run well under the 20 req/min/IP API limit.
  workers: LIVE ? 1 : CI ? 2 : undefined,
  // The dev server serves unbundled modules and the page runs GSAP/Lenis: parallel workers are slow.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    locale: "ar",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: LIVE ? liveProjects : defaultProjects,
  webServer: REMOTE
    ? undefined
    : {
        // Project config with file watching off (see e2e/vite.e2e.config.ts).
        command: `npx vite --config e2e/vite.e2e.config.ts --port ${PORT} --strictPort`,
        url: `http://127.0.0.1:${PORT}/`,
        // Always a fresh server: the mock env below and a clean rate-limit window are part of the contract.
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
        env: LIVE
          ? { QURAN_LIVE_WARM: "false" }
          : {
              AI_MOCK: "true",
              // Vite's loadEnv lets process.env override .env. A blank key (a space survives every
              // shell; the server trims it) means no live provider, so the mock is selected.
              AI_API_KEY: " ",
              OPENAI_API_KEY: " ",
              QURAN_LIVE_WARM: "false",
            },
      },
});
