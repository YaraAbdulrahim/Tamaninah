/**
 * Shared Playwright fixtures and page helpers for the UI specs.
 *
 * `test` here adds an auto fixture that fails a test on any uncaught page error, console error,
 * or failed request — except the ones a test provokes on purpose (stubbed HTTP errors and
 * aborted requests to /api/understand) and, offline, the Google Fonts stylesheet.
 */
import { test as base, expect, type Locator, type Page, type Request, type Route } from "@playwright/test";
import type { Stubbed } from "../fixtures/understand";

export { expect };

export const API = "**/api/understand";
const isApi = (url: string) => /\/api\/understand(?:\?|$)/.test(url);
const isFont = (url: string) => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url);

/** Offline/deterministic runs serve an empty Google Fonts stylesheet instead of hitting the network. */
export const REAL_FONTS = !!process.env.E2E_BASE_URL || process.env.E2E_REAL_FONTS === "1";

type Issues = { console: string[]; pageErrors: string[]; failed: string[] };

export const test = base.extend<{ issues: Issues }>({
  issues: [
    async ({ page }, use) => {
      const issues: Issues = { console: [], pageErrors: [], failed: [] };
      page.on("pageerror", (e) => issues.pageErrors.push(e.message));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const at = m.location().url ?? "";
        // Chromium logs every 4xx/5xx as "Failed to load resource" — expected for stubbed API errors.
        if (isApi(at) || (/Failed to load resource/.test(m.text()) && REAL_FONTS && isFont(at))) return;
        issues.console.push(`${m.text()} @ ${at}`);
      });
      page.on("requestfailed", (r) => {
        const url = r.url();
        if (isApi(url)) return; // aborts/network failures here are provoked by tests that assert on them
        if (REAL_FONTS && isFont(url)) return; // offline machine
        issues.failed.push(`${r.failure()?.errorText ?? "failed"} ${url}`);
      });
      if (!REAL_FONTS) {
        await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
          route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: "/* e2e: fonts stubbed */" }),
        );
      }
      await use(issues);
      expect.soft(issues.pageErrors, "uncaught page errors").toEqual([]);
      expect.soft(issues.console, "console errors").toEqual([]);
      expect.soft(issues.failed, "failed requests").toEqual([]);
    },
    { auto: true },
  ],
});

/* ───────── API stubs ───────── */

export type Reply = Stubbed | "abort" | "hang" | { raw: string; status: number; contentType?: string };
export type Responder = Reply | ((body: Record<string, unknown>, n: number) => Reply | Promise<Reply>);

/**
 * Stubs POST /api/understand. `replies` are used in order (the last one repeats).
 * Returns the parsed request bodies as they arrive.
 */
export async function stubUnderstand(page: Page, ...replies: Responder[]) {
  const calls: Record<string, unknown>[] = [];
  const pending: Route[] = [];
  await page.route(API, async (route) => {
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    const n = calls.push(body) - 1;
    const r = replies[Math.min(n, replies.length - 1)];
    const reply = typeof r === "function" ? await r(body, n) : r;
    if (reply === "abort") return route.abort("failed");
    if (reply === "hang") {
      pending.push(route);
      return;
    }
    if ("raw" in reply) {
      return route.fulfill({ status: reply.status, contentType: reply.contentType ?? "text/html", body: reply.raw });
    }
    return route.fulfill({
      status: reply.status ?? 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(reply.body),
    });
  });
  return calls;
}

/** A promise you can resolve from the test — to hold a stubbed response while asserting on «thinking». */
export function gate<T = void>() {
  let open!: (v: T) => void;
  const promise = new Promise<T>((r) => (open = r));
  return { promise, open };
}

/* ───────── page helpers ───────── */

export async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

export const experience = (page: Page) => page.locator("#experience");
export const textarea = (page: Page) => page.locator("#tm-text");
/** The composer's own send button (the hero and closing CTAs share its label). */
export const sendButton = (page: Page) => page.locator("#experience .composer__foot button");

export async function toComposer(page: Page) {
  const ta = textarea(page);
  await ta.scrollIntoViewIfNeeded();
  await expect(ta).toBeVisible();
  return ta;
}

/** Types into the composer and sends with the button. */
export async function ask(page: Page, text: string) {
  const ta = await toComposer(page);
  await ta.fill(text);
  await sendButton(page).click();
}

/** The focused state element inside the experience, e.g. `[data-focus="topics"]`. */
export const focusTarget = (page: Page, step: string): Locator => experience(page).locator(`[data-focus="${step}"]`);

/** Waits for the next request to /api/understand and returns its JSON body. */
export async function nextApiBody(page: Page, action: () => Promise<unknown>) {
  const [req] = await Promise.all([page.waitForRequest((r: Request) => isApi(r.url()) && r.method() === "POST"), action()]);
  return req.postDataJSON() as Record<string, unknown>;
}

/** No horizontal page scroll (RTL pages overflow to the left, which scrollWidth also counts). */
export async function expectNoHorizontalScroll(page: Page, where: string) {
  const m = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyScroll: document.body.scrollWidth,
  }));
  expect(m.scrollWidth, `horizontal scroll at ${where}: ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.innerWidth);
  expect(m.bodyScroll, `body horizontal scroll at ${where}: ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.innerWidth);
}
