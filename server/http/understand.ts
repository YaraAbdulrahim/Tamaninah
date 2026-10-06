/**
 * POST /api/understand — framework-agnostic handler (web-standard Request → Response).
 *
 * Used by the Vite dev/preview middleware (server/understandPlugin.ts) and by the Netlify
 * Function (netlify/functions/understand.mts). Contract: shared/experience/api.ts.
 *
 * - POST only, JSON body ≤ 8 KB, message capped at 2000 chars, same-origin only (no CORS).
 * - Per-IP rate limit (20 requests / minute). In-memory, so on serverless it is best-effort:
 *   each warm function instance keeps its own window and cold starts reset it. Use Netlify's
 *   platform rate limiting / WAF for a hard limit.
 * - The analyze stage gets one shared deadline (ANALYZE_DEADLINE_MS from request start) across
 *   model fallbacks and JSON repair; journey never calls the model.
 * - Logs outcome, status and latency only — never the user's text.
 */
import type { UnderstandError, UnderstandResponse } from "../../shared/experience/api";
import type { ContentLevel, ConversationTurn, Lang } from "../../shared/experience/guidance";
import { parseLessonAspects } from "../../shared/experience/validate";
import {
  ANALYZE_DEADLINE_MS,
  createProvider,
  modeForEnv,
  runAnalyze,
  runJourney,
  type OrchestratorEnv,
} from "../ai/orchestrate";
import type { AIProvider } from "../ai/provider";
import type { KnowledgeBase } from "../content/knowledge/knowledgeBase";

export const MAX_BODY_BYTES = 8 * 1024;
export const MAX_MESSAGE_CHARS = 2000;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 20;
const MAX_TRACKED_CLIENTS = 5000;
const MAX_CONTEXT_TURNS = 4;

export type UnderstandEnv = OrchestratorEnv & {
  /** Override the analyze deadline (ms). Defaults to 18000 (Netlify synchronous functions allow 60 s). */
  AI_DEADLINE_MS?: string;
};

export type HandleUnderstandOptions = {
  /** Client IP from the platform (Netlify `context.ip`, Node socket). Falls back to headers. */
  clientIp?: string;
  /** Test seams. */
  provider?: AIProvider | null;
  knowledge?: KnowledgeBase;
  now?: () => number;
  rateLimiter?: RateLimiter;
};

type Hit = { at: number; count: number };

export class RateLimiter {
  private readonly hits = new Map<string, Hit>();
  constructor(
    private readonly max = RATE_LIMIT_MAX,
    private readonly windowMs = RATE_LIMIT_WINDOW_MS,
  ) {}

  /** Returns true when this request exceeds the limit. */
  hit(key: string, now = Date.now()): boolean {
    if (this.hits.size > MAX_TRACKED_CLIENTS) this.prune(now);
    const current = this.hits.get(key);
    if (!current || now - current.at > this.windowMs) {
      this.hits.set(key, { at: now, count: 1 });
      return false;
    }
    current.count += 1;
    return current.count > this.max;
  }

  private prune(now: number) {
    for (const [key, hit] of this.hits) {
      if (now - hit.at > this.windowMs) this.hits.delete(key);
    }
    // Still too many distinct clients inside one window: drop the oldest half.
    if (this.hits.size > MAX_TRACKED_CLIENTS) {
      const keys = [...this.hits.keys()].slice(0, Math.floor(this.hits.size / 2));
      for (const key of keys) this.hits.delete(key);
    }
  }
}

const defaultLimiter = new RateLimiter();

const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export async function handleUnderstand(
  req: Request,
  env: UnderstandEnv,
  options: HandleUnderstandOptions = {},
): Promise<Response> {
  const now = options.now ?? Date.now;
  const started = now();
  let stage = "-";

  const done = (status: number, body: UnderstandResponse | Record<string, never>, extra?: Record<string, string>) => {
    const outcome = "ok" in body ? (body.ok ? routeOf(body) : body.error) : "empty";
    console.info(`[understand] stage=${stage} outcome=${outcome} status=${status} latency_ms=${now() - started}`);
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { ...BASE_HEADERS, ...extra },
    });
  };
  const fail = (status: number, error: UnderstandError, extra?: Record<string, string>) =>
    done(status, { ok: false, error }, extra);

  try {
    if (req.method === "OPTIONS") return done(204, {}, { Allow: "POST" });
    if (req.method !== "POST") return fail(405, "method", { Allow: "POST" });
    if (isCrossOrigin(req)) return fail(403, "forbidden");

    const limiter = options.rateLimiter ?? defaultLimiter;
    if (limiter.hit(clientKey(req, options.clientIp), started)) {
      return fail(429, "rate", { "Retry-After": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) });
    }

    const raw = await readLimitedBody(req, MAX_BODY_BYTES);
    if (raw === null) return fail(400, "body");

    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail(400, "body");
      body = parsed as Record<string, unknown>;
    } catch {
      return fail(400, "body");
    }

    stage = body.stage === "journey" ? "journey" : "analyze";
    const message =
      (typeof body.message === "string" && body.message) || (typeof body.text === "string" && body.text) || "";
    const trimmed = message.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!trimmed) return fail(400, "text");

    const language: Lang = body.language === "en" || body.lang === "en" ? "en" : "ar";
    const context = parseContext(body.context);

    if (stage === "journey") {
      const topicId = typeof body.topicId === "string" ? body.topicId.trim().slice(0, 64) : "";
      const analyzeLevel = parseLevel(body.analyzeLevel);
      if (!topicId || !analyzeLevel) return fail(400, "body");
      // `focus` (analyze.learning_focus passed back): absent, or an array of known aspects. Anything else is rejected.
      const focus = parseLessonAspects(body.focus);
      if (!focus) return fail(400, "body");
      const result = await runJourney(
        { message: trimmed, language, context, topicId, analyzeLevel, focus },
        { name: options.provider?.name ?? modeForEnv(env) },
      );
      return done(result.ok ? 200 : statusFor(result.error), result);
    }

    // A null provider still runs the deterministic safety guards; the rest returns `unconfigured`.
    const provider = options.provider === undefined ? createProvider(env) : options.provider;

    const deadlineMs = Number(env.AI_DEADLINE_MS);
    const deadline = started + (Number.isFinite(deadlineMs) && deadlineMs > 0 ? deadlineMs : ANALYZE_DEADLINE_MS);
    const result = await runAnalyze({ message: trimmed, language, context }, provider, {
      deadline,
      knowledge: options.knowledge,
    });
    return done(result.ok ? 200 : statusFor(result.error), result);
  } catch {
    return fail(500, "upstream");
  }
}

export function statusFor(error: UnderstandError): number {
  switch (error) {
    case "timeout":
      return 504;
    case "unclear":
    case "insufficient_reference":
    case "referral_required":
      return 422;
    case "unconfigured":
      return 503;
    case "rate":
      return 429;
    case "text":
    case "body":
      return 400;
    case "method":
      return 405;
    case "forbidden":
      return 403;
    case "invalid":
    case "upstream":
    default:
      return 502;
  }
}

function routeOf(body: UnderstandResponse): string {
  if (!body.ok) return body.error;
  if ("referral" in body) return `referral_${body.referral.reason}`;
  if ("route" in body) return body.route === "knowledge" ? `knowledge_${body.answer.kind}` : body.route;
  return "journey_ok";
}

/** Same-origin only: reject browser requests that declare another origin. */
function isCrossOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return true;
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return origin === "null";
  try {
    const requestHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
    return new URL(origin).host !== requestHost;
  } catch {
    return true;
  }
}

function clientKey(req: Request, platformIp?: string): string {
  if (platformIp?.trim()) return platformIp.trim();
  const nf = req.headers.get("x-nf-client-connection-ip");
  if (nf?.trim()) return nf.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

/** Reads at most `limit` bytes; returns null when the body is larger (or unreadable). */
async function readLimitedBody(req: Request, limit: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
}

function parseContext(value: unknown): ConversationTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (turn): turn is ConversationTurn =>
        Boolean(turn) &&
        typeof turn === "object" &&
        ((turn as ConversationTurn).role === "user" || (turn as ConversationTurn).role === "companion") &&
        typeof (turn as ConversationTurn).text === "string",
    )
    .slice(-MAX_CONTEXT_TURNS)
    .map((turn) => ({ role: turn.role, text: turn.text.slice(0, 400) }));
}

function parseLevel(value: unknown): ContentLevel | null {
  return value === "A" || value === "B" || value === "C" || value === "D" ? value : null;
}
