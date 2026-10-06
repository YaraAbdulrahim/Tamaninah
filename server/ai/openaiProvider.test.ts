import { afterEach, describe, expect, it, vi } from "vitest";
import { statusFor } from "../http/understand";
import {
  MIN_ATTEMPT_MS,
  RETRY_BACKOFF_MS,
  createOpenAIProvider,
  parseModelList,
  resetProviderCachesForTests,
} from "./openaiProvider";
import { DeadlineExceededError, UpstreamError, type AIProvider } from "./provider";
import { createProvider, runAnalyze } from "./orchestrate";

type Call = { model: string; effort: unknown };

function completion(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Scripted fetch: `script[model]` decides per call; records every call. */
function scriptedFetch(script: Record<string, (body: Record<string, unknown>, signal: AbortSignal) => Promise<Response>>) {
  const calls: Call[] = [];
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ model: String(body.model), effort: body.reasoning_effort });
    const handler = script[String(body.model)];
    if (!handler) return new Response("{}", { status: 404 });
    return handler(body, init!.signal!);
  }) as typeof fetch;
  return { calls, fetchImpl };
}

/** Never answers; rejects when the attempt's abort signal fires (like a hung upstream). */
function hang(_body: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason ?? new DOMException("aborted", "TimeoutError")));
  });
}

const status = (code: number, text = "") => async () => new Response(text || JSON.stringify({ error: { code } }), { status: code });
const ok = (content: string) => async () => completion(content);

afterEach(() => resetProviderCachesForTests());

describe("model fallback list", () => {
  it("parses a comma-separated AI_MODEL list (deduped, trimmed)", () => {
    expect(parseModelList(" a , b,a,, c ", "x")).toEqual(["a", "b", "c"]);
    expect(parseModelList("", "x")).toEqual(["x"]);
  });

  it("moves to the next model on 503, 429, 500 and 404", async () => {
    for (const code of [503, 429, 500, 404]) {
      resetProviderCachesForTests();
      const { calls, fetchImpl } = scriptedFetch({ m1: status(code), m2: ok('{"ok":1}') });
      const provider = createOpenAIProvider({ apiKey: "k", baseUrl: "https://x/v1", models: ["m1", "m2"], fetchImpl });
      await expect(provider.complete([{ role: "user", content: "hi" }])).resolves.toBe('{"ok":1}');
      expect(calls.map((c) => c.model)).toEqual(["m1", "m2"]);
    }
  });

  it("remembers a retired (404) model and skips it on later calls", async () => {
    const { calls, fetchImpl } = scriptedFetch({ old: status(404), m2: ok("{}") });
    const provider = createOpenAIProvider({ apiKey: "k", baseUrl: "https://x/v1", models: ["old", "m2"], fetchImpl });
    await provider.complete([{ role: "user", content: "1" }]);
    await provider.complete([{ role: "user", content: "2" }]);
    expect(calls.map((c) => c.model)).toEqual(["old", "m2", "m2"]);
  });

  it("sends reasoning_effort and drops it for a model that rejects it", async () => {
    const { calls, fetchImpl } = scriptedFetch({
      m1: async (body) =>
        body.reasoning_effort
          ? new Response(JSON.stringify({ error: { message: "Request contains an invalid argument." } }), { status: 400 })
          : completion("{}"),
    });
    const provider = createOpenAIProvider({
      apiKey: "k",
      baseUrl: "https://x/v1",
      models: ["m1"],
      reasoningEffort: "low",
      fetchImpl,
    });
    await provider.complete([{ role: "user", content: "1" }]);
    await provider.complete([{ role: "user", content: "2" }]);
    expect(calls).toEqual([
      { model: "m1", effort: "low" },
      { model: "m1", effort: undefined },
      { model: "m1", effort: undefined },
    ]);
  });

  it("a 400 that is not about reasoning_effort stays an ordinary failure — effort is not dropped for the model", async () => {
    const invalid = JSON.stringify({ error: { message: "Request contains an invalid argument." } });
    const { calls, fetchImpl } = scriptedFetch({ m1: status(400, invalid), m2: ok("{}") });
    const provider = createOpenAIProvider({
      apiKey: "k",
      baseUrl: "https://x/v1",
      models: ["m1", "m2"],
      reasoningEffort: "low",
      fetchImpl,
    });
    await expect(provider.complete([{ role: "user", content: "1" }])).resolves.toBe("{}");
    await expect(provider.complete([{ role: "user", content: "2" }])).resolves.toBe("{}");
    // The retry without effort failed too, so m1 is still asked with effort on the next request.
    const round = [
      { model: "m1", effort: "low" },
      { model: "m1", effort: undefined },
      { model: "m2", effort: "low" },
    ];
    expect(calls).toEqual([...round, ...round]);

    // Alone, the original 400 surfaces as the failure (not a timeout).
    const single = createOpenAIProvider({
      apiKey: "k",
      baseUrl: "https://x/v1",
      models: ["m1"],
      reasoningEffort: "low",
      fetchImpl,
    });
    await expect(single.complete([{ role: "user", content: "3" }])).rejects.toMatchObject({
      name: "UpstreamError",
      status: 400,
    });
  });

  it("a 400 that names reasoning_effort is remembered at once, even when the retry fails for another reason", async () => {
    const { calls, fetchImpl } = scriptedFetch({
      m1: async (body) =>
        body.reasoning_effort
          ? new Response(
              JSON.stringify({ error: { message: "Unrecognized request argument supplied: reasoning_effort" } }),
              { status: 400 },
            )
          : new Response("{}", { status: 422 }),
      m2: ok("{}"),
    });
    const provider = createOpenAIProvider({
      apiKey: "k",
      baseUrl: "https://x/v1",
      models: ["m1", "m2"],
      reasoningEffort: "low",
      fetchImpl,
    });
    await provider.complete([{ role: "user", content: "1" }]);
    await provider.complete([{ role: "user", content: "2" }]);
    expect(calls).toEqual([
      { model: "m1", effort: "low" },
      { model: "m1", effort: undefined },
      { model: "m2", effort: "low" },
      { model: "m1", effort: undefined },
      { model: "m2", effort: "low" },
    ]);
  });

  it("stops immediately on 401/403 (key problem affects every model)", async () => {
    const { calls, fetchImpl } = scriptedFetch({ m1: status(401), m2: ok("{}") });
    const provider = createOpenAIProvider({ apiKey: "k", baseUrl: "https://x/v1", models: ["m1", "m2"], fetchImpl });
    await expect(provider.complete([{ role: "user", content: "x" }])).rejects.toBeInstanceOf(UpstreamError);
    expect(calls.map((c) => c.model)).toEqual(["m1"]);
  });

  it("treats an empty completion as a failure and falls back", async () => {
    const { calls, fetchImpl } = scriptedFetch({ m1: ok(""), m2: ok('{"a":1}') });
    const provider = createOpenAIProvider({ apiKey: "k", baseUrl: "https://x/v1", models: ["m1", "m2"], fetchImpl });
    await expect(provider.complete([{ role: "user", content: "x" }])).resolves.toBe('{"a":1}');
    expect(calls.map((c) => c.model)).toEqual(["m1", "m2"]);
  });

  it("retries the list once more when every model failed fast and time remains", async () => {
    let first = true;
    const { calls, fetchImpl } = scriptedFetch({
      m1: async () => {
        if (first) {
          first = false;
          return new Response("{}", { status: 503 });
        }
        return completion("{}");
      },
      m2: status(503),
    });
    const provider = createOpenAIProvider({ apiKey: "k", baseUrl: "https://x/v1", models: ["m1", "m2"], fetchImpl });
    await expect(provider.complete([{ role: "user", content: "x" }])).resolves.toBe("{}");
    expect(calls.map((c) => c.model)).toEqual(["m1", "m2", "m1"]);
  });
});

describe("second-pass backoff", () => {
  afterEach(() => vi.useRealTimers());

  /** m1 answers `code` once, then succeeds; records the (fake) time of every call. */
  function busyOnce(code: number) {
    const times: number[] = [];
    let n = 0;
    const { calls, fetchImpl } = scriptedFetch({
      m1: async () => {
        times.push(Date.now());
        return n++ === 0 ? new Response("{}", { status: code }) : completion('{"ok":1}');
      },
    });
    return { calls, times, fetchImpl };
  }

  it.each([429, 503])("waits RETRY_BACKOFF_MS before trying a model that just answered %i again", async (code) => {
    vi.useFakeTimers();
    const { calls, times, fetchImpl } = busyOnce(code);
    const provider = createOpenAIProvider({ apiKey: "k", baseUrl: "https://x/v1", models: ["m1"], fetchImpl });
    const result = provider.complete([{ role: "user", content: "x" }], { deadline: Date.now() + 9000 });
    await vi.advanceTimersByTimeAsync(RETRY_BACKOFF_MS - 50);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe('{"ok":1}');
    expect(calls).toHaveLength(2);
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(RETRY_BACKOFF_MS);
  });

  it("never waits past deadline − MIN_ATTEMPT_MS", async () => {
    vi.useFakeTimers();
    const { calls, times, fetchImpl } = busyOnce(503);
    const provider = createOpenAIProvider({ apiKey: "k", baseUrl: "https://x/v1", models: ["m1"], fetchImpl });
    const deadline = Date.now() + MIN_ATTEMPT_MS + 300; // less room than a full backoff
    const result = provider.complete([{ role: "user", content: "x" }], { deadline });
    await vi.advanceTimersByTimeAsync(300);
    await expect(result).resolves.toBe('{"ok":1}');
    expect(calls).toHaveLength(2);
    expect(times[1]! - times[0]!).toBeGreaterThan(0);
    expect(deadline - times[1]!).toBeGreaterThanOrEqual(MIN_ATTEMPT_MS);
  });
});

describe("shared deadline", () => {
  it("hedges: a hung model gets company after hedgeAfterMs and the first answer wins", async () => {
    const { calls, fetchImpl } = scriptedFetch({ slow: hang, fast: ok('{"x":1}') });
    const provider = createOpenAIProvider({
      apiKey: "k",
      baseUrl: "https://x/v1",
      models: ["slow", "fast"],
      hedgeAfterMs: 150,
      fetchImpl,
    });
    const started = Date.now();
    await expect(provider.complete([{ role: "user", content: "x" }], { deadline: started + 3000 })).resolves.toBe('{"x":1}');
    expect(Date.now() - started).toBeLessThan(1500);
    expect(calls.map((c) => c.model)).toEqual(["slow", "fast"]);
  });

  it("hedging keeps the slow attempt alive — whichever answers first wins, the other is aborted", async () => {
    let fastAborted = false;
    const { calls, fetchImpl } = scriptedFetch({
      slowButOk: () => new Promise((resolve) => setTimeout(() => resolve(completion('{"from":"slow"}')), 250)),
      slower: (_b, signal) =>
        new Promise((resolve, reject) => {
          const t = setTimeout(() => resolve(completion('{"from":"slower"}')), 2000);
          signal.addEventListener("abort", () => {
            fastAborted = true;
            clearTimeout(t);
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    });
    const provider = createOpenAIProvider({
      apiKey: "k",
      baseUrl: "https://x/v1",
      models: ["slowButOk", "slower"],
      hedgeAfterMs: 100,
      fetchImpl,
    });
    await expect(provider.complete([{ role: "user", content: "x" }], { deadline: Date.now() + 3000 })).resolves.toBe(
      '{"from":"slow"}',
    );
    expect(calls.map((c) => c.model)).toEqual(["slowButOk", "slower"]);
    expect(fastAborted).toBe(true);
  });

  it("never runs past the deadline: all models hang → timeout error on time", async () => {
    const { fetchImpl } = scriptedFetch({ a: hang, b: hang, c: hang });
    const provider = createOpenAIProvider({
      apiKey: "k",
      baseUrl: "https://x/v1",
      models: ["a", "b", "c"],
      hedgeAfterMs: 400,
      fetchImpl,
    });
    const started = Date.now();
    const deadline = started + 1600;
    await expect(provider.complete([{ role: "user", content: "x" }], { deadline })).rejects.toBeInstanceOf(
      DeadlineExceededError,
    );
    expect(Date.now()).toBeLessThan(deadline + 250);
  });

  it("does not start an attempt when the deadline is already (nearly) spent", async () => {
    const { calls, fetchImpl } = scriptedFetch({ a: ok("{}") });
    const provider = createOpenAIProvider({ apiKey: "k", baseUrl: "https://x/v1", models: ["a"], fetchImpl });
    await expect(
      provider.complete([{ role: "user", content: "x" }], { deadline: Date.now() + 100 }),
    ).rejects.toBeInstanceOf(DeadlineExceededError);
    expect(calls).toEqual([]);
  });

  it("runAnalyze returns a clean `timeout` when the analyze stage exceeds its deadline", async () => {
    const { fetchImpl } = scriptedFetch({ a: hang });
    const provider = createOpenAIProvider({ apiKey: "k", baseUrl: "https://x/v1", models: ["a"], fetchImpl });
    const started = Date.now();
    const result = await runAnalyze(
      { message: "أشعر بالقلق من المستقبل", language: "ar", context: [] },
      provider,
      { deadline: started + 1200 },
    );
    expect(result).toEqual({ ok: false, error: "timeout" });
    expect(Date.now() - started).toBeLessThan(1700);
  });

  it("JSON repair shares the deadline: no repair call when no time is left → `invalid` (502), not `timeout`", async () => {
    let calls = 0;
    const slowInvalid: AIProvider = {
      name: "live",
      async complete(_messages, options) {
        calls += 1;
        // Burn the budget, then answer with something that is not valid analyze JSON.
        await new Promise((r) => setTimeout(r, Math.max(0, (options?.deadline ?? Date.now()) - Date.now() - 300)));
        return "not json";
      },
    };
    const result = await runAnalyze(
      { message: "أشعر بالقلق من المستقبل", language: "ar", context: [] },
      slowInvalid,
      { deadline: Date.now() + 1200 },
    );
    // The model did answer — just not validly — so this is not a timeout.
    expect(result).toEqual({ ok: false, error: "invalid" });
    if (!result.ok) expect(statusFor(result.error)).toBe(502);
    expect(calls).toBe(1);
  });

  it("createProvider reads the fallback list and effort from env", async () => {
    const seen: Call[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      seen.push({ model: String(body.model), effort: body.reasoning_effort });
      return body.model === "b" ? completion("{}") : new Response("{}", { status: 503 });
    }) as typeof fetch;
    try {
      const provider = createProvider({
        AI_API_KEY: "k",
        AI_MODEL: "a, b",
        AI_BASE_URL: "https://x/v1",
        AI_REASONING_EFFORT: "low",
      });
      await provider!.complete([{ role: "user", content: "x" }]);
    } finally {
      globalThis.fetch = original;
    }
    expect(seen).toEqual([
      { model: "a", effort: "low" },
      { model: "b", effort: "low" },
    ]);
  });

  it("createProvider sends no reasoning_effort unless AI_REASONING_EFFORT is set (gpt-4o-mini rejects it)", async () => {
    const seen: unknown[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      seen.push("reasoning_effort" in body ? body.reasoning_effort : "(absent)");
      return completion("{}");
    }) as typeof fetch;
    try {
      for (const effort of [undefined, "", "none", "off"]) {
        const env = { AI_API_KEY: "k", AI_BASE_URL: "https://x/v1", AI_REASONING_EFFORT: effort };
        await createProvider(env)!.complete([{ role: "user", content: "x" }]);
      }
    } finally {
      globalThis.fetch = original;
    }
    expect(seen).toEqual(["(absent)", "(absent)", "(absent)", "(absent)"]);
  });
});
