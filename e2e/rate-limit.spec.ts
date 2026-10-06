/**
 * Per-IP rate limit (20 requests / minute) on the dev handler. Runs last (project dependencies in
 * playwright.config.ts) because it exhausts the budget shared with api/real-handler specs.
 * The dev middleware keys on the socket address, so X-Forwarded-For cannot isolate it.
 */
import { expect, test } from "@playwright/test";

test("21+ rapid requests from one client → 429 rate with Retry-After", async ({ request }) => {
  // Cheapest request that still reaches the limiter: a valid body with an empty message (400 text).
  const send = () => request.post("/api/understand", { data: { stage: "analyze", message: " ", language: "ar" } });
  const statuses: number[] = [];
  let limited = null as Awaited<ReturnType<typeof send>> | null;
  for (let i = 0; i < 25 && !limited; i++) {
    const res = await send();
    statuses.push(res.status());
    if (res.status() === 429) limited = res;
  }
  expect(limited, `statuses: ${statuses.join(",")}`).not.toBeNull();
  // Earlier specs may have used part of this minute's budget; never more than 20 get through.
  expect(statuses.filter((s) => s !== 429).length).toBeLessThanOrEqual(20);
  expect(statuses.slice(0, -1).every((s) => s === 400)).toBe(true);

  expect(await limited!.json()).toEqual({ ok: false, error: "rate" });
  expect(limited!.headers()["retry-after"]).toBe("60");
  expect(limited!.headers()["cache-control"]).toBe("no-store");

  // Still limited on the next request, and the method guard still answers first.
  expect((await send()).status()).toBe(429);
  expect((await request.get("/api/understand")).status()).toBe(405);
});
