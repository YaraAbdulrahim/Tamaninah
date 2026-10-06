import { afterEach, describe, expect, it, vi } from "vitest";
import { mockProvider } from "../ai/mockProvider";
import type { AIProvider } from "../ai/provider";
import { fixtureKnowledgeBase } from "../content/knowledge/testFixtures";
import { RateLimiter, handleUnderstand } from "./understand";

const URL_ = "https://tamaninah.example/api/understand";

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json", host: "tamaninah.example", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const fresh = () => ({ rateLimiter: new RateLimiter(), knowledge: fixtureKnowledgeBase() });

afterEach(() => vi.restoreAllMocks());

describe("handleUnderstand (web Request → Response)", () => {
  it("analyze: 200 JSON, no-store, no CORS headers", async () => {
    const res = await handleUnderstand(
      post({ stage: "analyze", message: "انقبلت في وظيفة جديدة وخايف من المسؤولية", language: "ar" }),
      {},
      { ...fresh(), provider: mockProvider },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, mode: "mock", route: "topic_discovery" });
  });

  it("journey: repository-only, works without an AI key", async () => {
    const res = await handleUnderstand(
      post({ stage: "journey", message: "خايف", language: "ar", topicId: "patience", analyzeLevel: "A" }),
      {},
      fresh(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("live");
    expect(body.payload.content.content_id).toBe("quran-zumar-10");
  });

  it("maps errors to the established status codes", async () => {
    const cases: [Request, number, string][] = [
      [new Request(URL_, { method: "GET" }), 405, "method"],
      [post("{not json"), 400, "body"],
      [post([1, 2]), 400, "body"],
      [post({ stage: "analyze", message: "   " }), 400, "text"],
      [post({ stage: "journey", message: "x", topicId: "patience" }), 400, "body"],
      [post({ stage: "analyze", message: "مرحبا" }), 503, "unconfigured"],
      [post({ stage: "journey", message: "x", topicId: "topic-unpublished-fixture", analyzeLevel: "A" }), 422, "insufficient_reference"],
    ];
    for (const [req, status, error] of cases) {
      const res = await handleUnderstand(req, {}, { ...fresh(), provider: null });
      expect([res.status, (await res.json()).error]).toEqual([status, error]);
    }
  });

  it("safety guards work even without an AI key: self-harm and Level D still get their referral", async () => {
    const selfHarm = await handleUnderstand(post({ stage: "analyze", message: "ما أبغى أعيش" }), {}, { ...fresh(), provider: null });
    expect(selfHarm.status).toBe(200);
    expect((await selfHarm.json()).referral.reason).toBe("self_harm");
    const levelD = await handleUnderstand(
      post({ stage: "analyze", message: "أنا في دولة كذا، هل يجوز لي فعل كذا في زواجي؟" }),
      {},
      { ...fresh(), provider: null },
    );
    expect((await levelD.json()).referral.reason).toBe("level_d");
  });

  it("OPTIONS → 204 without CORS grants", async () => {
    const res = await handleUnderstand(new Request(URL_, { method: "OPTIONS" }), {}, fresh());
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects bodies over 8 KB", async () => {
    const big = JSON.stringify({ stage: "analyze", message: "x".repeat(9000) });
    const res = await handleUnderstand(post(big), {}, { ...fresh(), provider: mockProvider });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("body");
  });

  it("caps the message at 2000 characters before it reaches the model", async () => {
    let seen = "";
    const spy: AIProvider = {
      name: "live",
      async complete(messages) {
        seen = (JSON.parse(messages.at(-1)!.content) as { message: string }).message;
        return "{}";
      },
    };
    await handleUnderstand(post({ stage: "analyze", message: "أحس بضيق ".repeat(300) }), {}, { ...fresh(), provider: spy });
    expect(seen.length).toBe(2000);
  });

  it("same-origin only: cross-site browser requests are refused", async () => {
    const crossSite = await handleUnderstand(
      post({ stage: "analyze", message: "x" }, { "sec-fetch-site": "cross-site" }),
      {},
      { ...fresh(), provider: mockProvider },
    );
    expect(crossSite.status).toBe(403);
    const otherOrigin = await handleUnderstand(
      post({ stage: "analyze", message: "x" }, { origin: "https://evil.example" }),
      {},
      { ...fresh(), provider: mockProvider },
    );
    expect(otherOrigin.status).toBe(403);
    const sameOrigin = await handleUnderstand(
      post({ stage: "journey", message: "x", topicId: "patience", analyzeLevel: "A" }, { origin: "https://tamaninah.example", "sec-fetch-site": "same-origin" }),
      {},
      fresh(),
    );
    expect(sameOrigin.status).toBe(200);
  });

  it("rate-limits per client IP (20/min, best-effort in memory)", async () => {
    const limiter = new RateLimiter(2, 60_000);
    const call = (ip: string) =>
      handleUnderstand(post({ stage: "journey", message: "x", topicId: "patience", analyzeLevel: "A" }), {}, {
        rateLimiter: limiter,
        clientIp: ip,
      });
    expect((await call("1.1.1.1")).status).toBe(200);
    expect((await call("1.1.1.1")).status).toBe(200);
    const limited = await call("1.1.1.1");
    expect(limited.status).toBe(429);
    expect((await limited.json()).error).toBe("rate");
    expect((await call("2.2.2.2")).status).toBe(200);
  });

  it("returns 504 timeout when the analyze deadline is exceeded", async () => {
    const hung: AIProvider = {
      name: "live",
      complete: () => new Promise((_r, reject) => setTimeout(() => reject(new DOMException("t", "TimeoutError")), 50)),
    };
    const res = await handleUnderstand(post({ stage: "analyze", message: "أشعر بالقلق" }), {}, { ...fresh(), provider: hung });
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ ok: false, error: "timeout" });
  });

  it("knowledge route over HTTP returns the KnowledgeAnswer contract", async () => {
    const model: AIProvider = {
      name: "live",
      async complete() {
        return JSON.stringify({
          context_summary: "يبدو أنك تسأل عن معنى مصطلح.",
          level: "A",
          safety: "safe",
          input_intent: "DIRECT_QUESTION",
          recommended_path: "direct_learning",
          domain: "terminology",
          knowledge_id: "gl-tawhid",
          suggested_topics: [],
        });
      },
    };
    const res = await handleUnderstand(post({ stage: "analyze", message: "ما معنى التوحيد؟" }), {}, { ...fresh(), provider: model });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, route: "knowledge", answer: { kind: "glossary", id: "gl-tawhid" } });
  });

  it("never logs the user's text — outcome, status and latency only", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => void lines.push(args.join(" ")));
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => void lines.push(args.join(" ")));
    const secret = "سرّي جدًا لا يُسجَّل";
    await handleUnderstand(post({ stage: "analyze", message: secret }), {}, { ...fresh(), provider: mockProvider });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join("\n")).not.toContain(secret);
    expect(lines.some((l) => /\[understand\] stage=analyze outcome=\S+ status=\d+ latency_ms=\d+/.test(l))).toBe(true);
  });
});
