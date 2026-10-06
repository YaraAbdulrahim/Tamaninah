import {
  DeadlineExceededError,
  UpstreamError,
  isTimeoutError,
  type AIProvider,
  type ChatMessage,
  type CompleteOptions,
} from "./provider";

/**
 * OpenAI-compatible Chat Completions provider (used with Google Gemini's `/v1beta/openai`
 * endpoint in production), with hedged model fallback under one shared deadline.
 *
 * - `models` is an ordered fallback list. The first model starts immediately. The next one
 *   starts as soon as the current attempt FAILS (404 retired, 408/429 busy/quota, 5xx such as
 *   Gemini's 503 "high demand", other 4xx, network error, empty completion) — or, if the current
 *   attempt is merely slow, after `hedgeAfterMs` while the slow one keeps running. The first
 *   usable completion wins and every other in-flight attempt is aborted.
 * - Every attempt is bounded by the absolute `options.deadline` (shared with JSON repair by the
 *   orchestrator). Nothing starts with less than MIN_ATTEMPT_MS left; at the deadline all
 *   attempts are aborted and a `timeout` error is thrown.
 * - When every model failed fast and time remains, retryable models are tried once more (busy
 *   models often recover within seconds) — a second pass of the same model waits RETRY_BACKOFF_MS
 *   after its failure (never past deadline − MIN_ATTEMPT_MS). A 404 is remembered for a few
 *   minutes so retired models stop costing a round-trip.
 * - `reasoning_effort` is sent when configured; a model that answers 400 to a request carrying it
 *   is retried at once without it. It is remembered as effort-rejecting (for the process lifetime)
 *   only when the 400 names reasoning/effort or the retry without it succeeds — otherwise the
 *   original 400 is an ordinary failure.
 * - 401/403 stop everything immediately (a key problem affects every model).
 */
export type OpenAIProviderConfig = {
  apiKey: string;
  baseUrl: string;
  models: readonly string[];
  /** e.g. "low". `null`/"" disables the parameter. */
  reasoningEffort?: string | null;
  /** Start the next model if the current attempt has not answered after this long (ms). */
  hedgeAfterMs?: number;
  /** Deadline used when the caller passes none. */
  defaultBudgetMs?: number;
  /** Passes over the model list while time remains (default 2). */
  maxPasses?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export const DEFAULT_HEDGE_AFTER_MS = 2500;
/** Analyze budget. Netlify synchronous functions may run 60 s; 18 s keeps the wait humane. */
export const DEFAULT_BUDGET_MS = 18000;
/** Never start an attempt with less than this left — it could not finish usefully. */
export const MIN_ATTEMPT_MS = 900;
/** Pause before a model that just answered 429/5xx is tried again in the same request. */
export const RETRY_BACKOFF_MS = 800;
/** Timers fire a little late; keep the retry clear of the MIN_ATTEMPT_MS floor. */
const TIMER_SLACK_MS = 20;
const RETIRED_MODEL_TTL_MS = 10 * 60_000;

const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const FATAL_STATUSES = new Set([401, 403]);

/** Models that answered 400 to `reasoning_effort` — learned at runtime, per process. */
const effortRejectedModels = new Set<string>();
/** Models that answered 404 recently (retired / not available to this key). */
const retiredModels = new Map<string, number>();

export function resetProviderCachesForTests() {
  effortRejectedModels.clear();
  retiredModels.clear();
}

export function parseModelList(raw: string | undefined, fallback: string): string[] {
  const list = (raw ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const unique = [...new Set(list)];
  return unique.length ? unique : [fallback];
}

/** One launch: `effortProbe` holds the original 400 while a no-effort retry checks its cause. */
type Launch = { model: string; sendEffort: boolean; effortProbe?: Error };

type AttemptOutcome =
  | { kind: "ok"; content: string }
  /** 400 on a request carrying reasoning_effort; `confirmed` when the error body names it. */
  | { kind: "effort_rejected"; confirmed: boolean; error: Error }
  | { kind: "fatal"; error: Error }
  | { kind: "failed"; error: Error; retryable: boolean; timedOut: boolean };

export function createOpenAIProvider(config: OpenAIProviderConfig): AIProvider {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const now = config.now ?? Date.now;
  const models = config.models.length ? [...config.models] : ["gpt-4o-mini"];
  const effort = config.reasoningEffort?.trim() || null;
  const hedgeAfter = Math.max(100, config.hedgeAfterMs ?? DEFAULT_HEDGE_AFTER_MS);
  const maxPasses = Math.max(1, config.maxPasses ?? 2);
  const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;

  function isRecentlyRetired(model: string) {
    const at = retiredModels.get(model);
    if (at === undefined) return false;
    if (now() - at > RETIRED_MODEL_TTL_MS) {
      retiredModels.delete(model);
      return false;
    }
    return true;
  }

  async function attempt(
    model: string,
    sendEffort: boolean,
    messages: ChatMessage[],
    options: CompleteOptions,
    signal: AbortSignal,
  ): Promise<AttemptOutcome> {
    const body: Record<string, unknown> = {
      model,
      temperature: options.temperature ?? 0.3,
      // Thinking tokens count against max_tokens on Gemini — keep headroom.
      max_tokens: options.maxTokens ?? 2048,
      response_format: { type: "json_object" },
      messages,
    };
    if (sendEffort && effort) body.reasoning_effort = effort;

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      const timedOut = isTimeoutError(error) || signal.aborted;
      return {
        kind: "failed",
        error: timedOut ? new DeadlineExceededError(`timeout: ${model}`) : new UpstreamError(0, `upstream:network (${model})`),
        retryable: !timedOut,
        timedOut,
      };
    }

    if (response.ok) {
      try {
        const completion = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
        const content = completion.choices?.[0]?.message?.content ?? "";
        if (content.trim()) return { kind: "ok", content };
      } catch (error) {
        if (isTimeoutError(error) || signal.aborted) {
          return { kind: "failed", error: new DeadlineExceededError(`timeout: ${model} body`), retryable: false, timedOut: true };
        }
      }
      return { kind: "failed", error: new UpstreamError(200, `upstream:empty (${model})`), retryable: true, timedOut: false };
    }

    // Gemini answers an unsupported effort value with a generic 400 ("invalid argument"), so any
    // 400 on a request that carried reasoning_effort is retried once without it.
    if (response.status === 400 && sendEffort) {
      const text = await readErrorText(response);
      return {
        kind: "effort_rejected",
        confirmed: /reasoning|effort/i.test(text),
        error: new UpstreamError(400, `upstream:400 (${model})`),
      };
    }
    await drain(response);
    if (FATAL_STATUSES.has(response.status)) return { kind: "fatal", error: new UpstreamError(response.status) };
    if (response.status === 404) retiredModels.set(model, now());
    return {
      kind: "failed",
      error: new UpstreamError(response.status, `upstream:${response.status} (${model})`),
      retryable: RETRYABLE_STATUSES.has(response.status),
      timedOut: false,
    };
  }

  return {
    name: "live",
    complete(messages: ChatMessage[], options: CompleteOptions = {}) {
      const deadline = options.deadline ?? now() + (config.defaultBudgetMs ?? DEFAULT_BUDGET_MS);
      if (deadline - now() < MIN_ATTEMPT_MS) return Promise.reject(new DeadlineExceededError());

      // Launch queue in configured order (recently retired models only as a last resort).
      const fresh = models.filter((m) => !isRecentlyRetired(m));
      const queue: string[] = fresh.length ? [...fresh] : [...models];
      /** How many times each model has been re-queued after a retryable failure. */
      const requeued = new Map<string, number>();

      return new Promise<string>((resolve, reject) => {
        const controllers = new Set<AbortController>();
        let inFlight = 0;
        let settled = false;
        let lastError: Error | null = null;
        let onlyTimeouts = true;
        let hedgeTimer: ReturnType<typeof setTimeout> | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        /** When each re-queued model last failed (second-pass backoff). */
        const failedAt = new Map<string, number>();

        const deadlineTimer = setTimeout(() => {
          finish(() => reject(lastError instanceof DeadlineExceededError ? lastError : new DeadlineExceededError()));
        }, Math.max(0, deadline - now()));

        function finish(action: () => void) {
          if (settled) return;
          settled = true;
          clearTimeout(deadlineTimer);
          if (hedgeTimer) clearTimeout(hedgeTimer);
          if (retryTimer) clearTimeout(retryTimer);
          for (const controller of controllers) controller.abort();
          controllers.clear();
          action();
        }

        function failIfIdle() {
          if (settled || inFlight > 0 || retryTimer) return;
          if (onlyTimeouts || deadline - now() < MIN_ATTEMPT_MS) {
            finish(() => reject(lastError instanceof DeadlineExceededError ? lastError : new DeadlineExceededError()));
          } else {
            finish(() => reject(lastError ?? new UpstreamError(0, "upstream:unavailable")));
          }
        }

        function armHedge() {
          if (hedgeTimer) clearTimeout(hedgeTimer);
          hedgeTimer = setTimeout(() => {
            hedgeTimer = null;
            if (!settled && queue.length) launchNext();
          }, hedgeAfter);
        }

        /** How long a second pass of `model` must still wait (0 = start now). */
        function backoffFor(model: string): number {
          const at = failedAt.get(model);
          if (at === undefined) return 0;
          const latest = deadline - MIN_ATTEMPT_MS - TIMER_SLACK_MS - now();
          return Math.max(0, Math.min(at + RETRY_BACKOFF_MS - now(), latest));
        }

        function launchNext(override?: Launch) {
          if (settled) return;
          const remaining = deadline - now();
          if (remaining < MIN_ATTEMPT_MS) {
            failIfIdle();
            return;
          }
          // A model that just answered 429/5xx is not hammered again at once.
          const wait = !override && queue.length ? backoffFor(queue[0]!) : 0;
          if (wait > 0) {
            retryTimer ??= setTimeout(() => {
              retryTimer = null;
              launchNext();
            }, wait);
            return;
          }
          const next: Launch | null = override ?? (queue.length ? { model: queue.shift()!, sendEffort: true } : null);
          if (!next) {
            failIfIdle();
            return;
          }
          const sendEffort = next.sendEffort && Boolean(effort) && !effortRejectedModels.has(next.model);
          const controller = new AbortController();
          controllers.add(controller);
          inFlight += 1;
          armHedge();

          void attempt(next.model, sendEffort, messages, options, controller.signal).then((outcome) => {
            controllers.delete(controller);
            inFlight -= 1;
            if (settled) return;
            switch (outcome.kind) {
              case "ok":
                // The retry without reasoning_effort worked: the 400 was about the parameter.
                if (next.effortProbe) effortRejectedModels.add(next.model);
                finish(() => resolve(outcome.content));
                return;
              case "fatal":
                finish(() => reject(outcome.error));
                return;
              case "effort_rejected":
                if (outcome.confirmed) effortRejectedModels.add(next.model);
                launchNext({
                  model: next.model,
                  sendEffort: false,
                  ...(outcome.confirmed ? {} : { effortProbe: outcome.error }),
                });
                return;
              case "failed": {
                // An unconfirmed effort probe that failed too: the 400 was not about effort — it is
                // reported as an ordinary (non-retryable) failure and nothing is remembered.
                const probe = next.effortProbe;
                lastError = probe ?? outcome.error;
                if (probe || !outcome.timedOut) onlyTimeouts = false;
                const retries = requeued.get(next.model) ?? 0;
                if (!probe && outcome.retryable && retries + 1 < maxPasses) {
                  requeued.set(next.model, retries + 1);
                  failedAt.set(next.model, now());
                  queue.push(next.model);
                }
                // A failure frees a slot: try the next model now instead of waiting for the hedge.
                if (queue.length) launchNext();
                else failIfIdle();
                return;
              }
            }
          });
        }

        launchNext();
      });
    },
  };
}

/** First part of an error body, only to classify it (never logged). */
async function readErrorText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 2000);
  } catch {
    return "";
  }
}

/** Consume the error body so the connection can be reused (contents are not logged). */
async function drain(response: Response): Promise<void> {
  try {
    await response.arrayBuffer();
  } catch {
    /* ignore */
  }
}
