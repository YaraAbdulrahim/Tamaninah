/**
 * POST /api/understand contract, against the real dev handler (mock provider, no model key).
 *
 * The handler rate-limits per client IP (20/min). Every POST here that reaches the limiter counts
 * (GET/405 and cross-origin/403 are rejected before it); keep this file + real-handler.spec.ts
 * under ~16 such requests together. rate-limit.spec.ts runs after both and exhausts the budget.
 */
import { connect } from "node:net";
import { expect, test, type APIResponse } from "@playwright/test";

const URL = "/api/understand";
const json = async (res: APIResponse) => (await res.json()) as Record<string, any>;

function expectApiHeaders(res: APIResponse) {
  const h = res.headers();
  expect(h["content-type"]).toMatch(/^application\/json/);
  expect(h["cache-control"]).toBe("no-store");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["access-control-allow-origin"], "no CORS").toBeUndefined();
}

test.describe("request guards", () => {
  test("GET → 405 method, Allow: POST", async ({ request }) => {
    const res = await request.get(URL);
    expect(res.status()).toBe(405);
    expect(res.headers()["allow"]).toBe("POST");
    expect(await json(res)).toEqual({ ok: false, error: "method" });
    expectApiHeaders(res);
  });

  test("cross-origin browser request → 403 forbidden", async ({ request }) => {
    const body = { stage: "analyze", message: "x", language: "ar" };
    const byOrigin = await request.post(URL, { data: body, headers: { Origin: "https://evil.example" } });
    expect(byOrigin.status()).toBe(403);
    expect(await json(byOrigin)).toEqual({ ok: false, error: "forbidden" });
    expectApiHeaders(byOrigin);

    const byFetchSite = await request.post(URL, { data: body, headers: { "Sec-Fetch-Site": "cross-site" } });
    expect(byFetchSite.status()).toBe(403);

    const nullOrigin = await request.post(URL, { data: body, headers: { Origin: "null" } });
    expect(nullOrigin.status(), "sandboxed iframes send Origin: null").toBe(403);
  });

  test("malformed JSON → 400 body", async ({ request }) => {
    const res = await request.post(URL, { data: "{not json", headers: { "Content-Type": "application/json" } });
    expect(res.status()).toBe(400);
    expect(await json(res)).toEqual({ ok: false, error: "body" });
    expectApiHeaders(res);
  });

  test("empty / whitespace message → 400 text", async ({ request }) => {
    const res = await request.post(URL, { data: { stage: "analyze", message: "   ", language: "ar" } });
    expect(res.status()).toBe(400);
    expect(await json(res)).toEqual({ ok: false, error: "text" });
  });

  test("body over 8 KB → 400 body (rejected before parsing)", async ({ request }) => {
    const res = await request.post(URL, {
      data: { stage: "analyze", message: "ا".repeat(50_000), language: "ar" }, // ~100 KB of UTF-8
    });
    expect(res.status()).toBe(400);
    expect(await json(res)).toEqual({ ok: false, error: "body" });
  });

  test("an oversized body does not wedge a keep-alive connection", async ({ baseURL }) => {
    test.skip(!!process.env.E2E_BASE_URL, "dev/preview middleware only");
    // Raw socket: browsers reuse keep-alive connections; Playwright's request client does not.
    const { hostname, port } = new globalThis.URL(baseURL!);
    const status = await new Promise<string>((resolve) => {
      const big = JSON.stringify({ stage: "analyze", message: "a".repeat(1_000_000), language: "ar" }); // 1 MB: beyond socket buffers
      const small = JSON.stringify({ stage: "analyze", message: " ", language: "ar" });
      const post = (b: string) =>
        `POST ${URL} HTTP/1.1\r\nHost: ${hostname}:${port}\r\nContent-Type: application/json\r\n` +
        `Content-Length: ${Buffer.byteLength(b)}\r\nConnection: keep-alive\r\n\r\n${b}`;
      const socket = connect(Number(port), hostname);
      let seen = "";
      let reused = false;
      const finish = (s: string) => {
        clearTimeout(timer);
        socket.destroy();
        resolve(s);
      };
      const timer = setTimeout(() => finish(`wedged: ${seen.match(/HTTP\/1\.1 \d+/g)?.join(", ") ?? "no response"}`), 4_000);
      socket.on("data", (d) => {
        seen += d.toString("latin1");
        const statuses = seen.match(/HTTP\/1\.1 \d+/g) ?? [];
        if (statuses.length === 1 && !reused) {
          reused = true;
          socket.write(post(small)); // the next request on the same socket
        }
        if (statuses.length === 2) finish("answered the next request");
      });
      // Closing the connection after rejecting the upload is also fine — the client opens a new one.
      socket.on("close", () => finish(seen.includes("HTTP/1.1 400") ? "closed after 400" : "closed without a response"));
      socket.on("error", () => undefined);
      socket.write(post(big));
    });
    expect(["answered the next request", "closed after 400"], status).toContain(status);
  });

  test("journey without topicId / analyzeLevel → 400 body", async ({ request }) => {
    const res = await request.post(URL, { data: { stage: "journey", message: "نص تجريبي", language: "ar" } });
    expect(res.status()).toBe(400);
    expect(await json(res)).toEqual({ ok: false, error: "body" });
  });
});

test.describe("deterministic routes (no model needed)", () => {
  test("self-harm phrasing → self_harm referral, Arabic message, no pointer", async ({ request }) => {
    const res = await request.post(URL, { data: { stage: "analyze", message: "thoughts of self-harm", language: "ar" } });
    expect(res.status()).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({ ok: true, referral: { kind: "referral", reason: "self_harm", level: "D" } });
    expect(body.referral.message).toMatch(/دعمًا بشريًا/);
    expect(body.pointer).toBeUndefined();
    expectApiHeaders(res);
  });

  test("personal ruling (Level D) → level_d referral with an approved-source pointer", async ({ request }) => {
    const res = await request.post(URL, {
      data: { stage: "analyze", message: "هل صلاتي صحيحة إذا نسيت ركعة؟", language: "ar" },
    });
    expect(res.status()).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({ ok: true, referral: { reason: "level_d", level: "D" } });
    expect(body.pointer?.domain).toBe("fiqh");
    expect(body.pointer?.sources?.length).toBeGreaterThan(0);
    for (const s of body.pointer.sources) expect(s.url).toMatch(/^https:\/\//);
  });

  test("out-of-product-scope → 422 insufficient_reference", async ({ request }) => {
    const res = await request.post(URL, {
      data: { stage: "analyze", message: "how do I fix my car engine", language: "en" },
    });
    expect(res.status()).toBe(422);
    expect(await json(res)).toMatchObject({ ok: false, error: "insufficient_reference" });
  });
});

test.describe("mock provider + verified repository", () => {
  test("analyze runs on the mock provider (never a live model in this suite)", async ({ request }) => {
    const res = await request.post(URL, {
      data: { stage: "analyze", message: "تعبت من كل شيء وأحس إني أحاول وما يتغير شيء", language: "ar" },
    });
    expect(res.status()).toBe(200);
    const body = await json(res);
    expect(body.mode, "AI_MOCK must be active; a 'live' mode here means a real key leaked in").toBe("mock");
    expect(body.route).toBe("topic_discovery");
    expect(body.analyze.suggested_topics.length).toBeGreaterThan(0);
    for (const t of body.analyze.suggested_topics) {
      expect(typeof t.id).toBe("string");
      expect(t.title.trim()).not.toBe("");
    }
  });

  test("journey returns a verified catalog payload with its source", async ({ request }) => {
    const res = await request.post(URL, {
      data: { stage: "journey", message: "تعبت من الانتظار", language: "ar", topicId: "patience", analyzeLevel: "A" },
    });
    expect(res.status()).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({ ok: true, mode: "mock", payload: { topic_id: "patience" } });
    const c = body.payload.content;
    expect(c).toMatchObject({ type: "quran", verified: true, published: true });
    expect(c.arabic.trim()).not.toBe("");
    expect(c.reference).toMatch(/\d+:\d+/);
    expect(c.source.name.trim()).not.toBe("");
    expectApiHeaders(res);
  });
});
