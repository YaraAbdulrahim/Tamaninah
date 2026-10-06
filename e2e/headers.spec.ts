/**
 * Security headers of a deployed site (netlify.toml [[headers]] + the function's own headers).
 * Only meaningful against a real deployment: set E2E_BASE_URL (the Vite dev server sets none).
 */
import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_BASE_URL, "set E2E_BASE_URL to check a deployment's headers");

test("app shell: CSP (frame-ancestors), nosniff, referrer policy, framing, HSTS", async ({ request }) => {
  const res = await request.get("/");
  expect(res.status()).toBe(200);
  const h = res.headers();
  const csp = h["content-security-policy"] ?? "";
  expect(csp, "Content-Security-Policy").toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toMatch(/connect-src 'self'/);
  expect(csp).toMatch(/script-src 'self'(;|$)/); // no inline / eval for scripts
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["strict-transport-security"]).toMatch(/max-age=\d+/);
  expect(h["cache-control"] ?? "").toMatch(/max-age=0|must-revalidate|no-cache/);
});

test("hashed assets are immutable; unknown paths fall back to the app shell", async ({ request }) => {
  const html = await (await request.get("/")).text();
  const asset = /\/assets\/[^"']+\.js/.exec(html)?.[0];
  expect(asset, "a hashed JS asset in index.html").toBeTruthy();
  const a = await request.get(asset!);
  expect(a.status()).toBe(200);
  expect(a.headers()["cache-control"]).toContain("immutable");

  const missing = await request.get("/e2e-no-such-page");
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain('id="root"');
});

test("API responses: JSON, no-store, nosniff, no CORS — without calling the model", async ({ request }) => {
  const get = await request.get("/api/understand");
  expect(get.status()).toBe(405);
  // Empty message is rejected before any model call.
  const bad = await request.post("/api/understand", { data: { stage: "analyze", message: "", language: "ar" } });
  expect(bad.status()).toBe(400);
  const cross = await request.post("/api/understand", {
    data: { stage: "analyze", message: "x", language: "ar" },
    headers: { Origin: "https://evil.example" },
  });
  expect(cross.status()).toBe(403);
  for (const res of [get, bad, cross]) {
    const h = res.headers();
    expect(h["cache-control"]).toContain("no-store");
    expect(h["content-type"]).toMatch(/^application\/json/);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["access-control-allow-origin"]).toBeUndefined();
  }
});
