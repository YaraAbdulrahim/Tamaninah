import type { AnalyzeResponse, JourneyResponse, SourcePointer } from "../../shared/experience/api";
import type {
  GuidanceRequest,
  JourneyRequest,
  LessonAspect,
  ReferralPayload,
  TopicId,
} from "../../shared/experience/guidance";
import { parseModelJson, validateAnalyze } from "../../shared/experience/validate";
import { getDefaultKnowledgeBase } from "../content/knowledge/knowledgeData";
import type { KnowledgeBase, KnowledgeCandidate } from "../content/knowledge/knowledgeBase";
import {
  authoritativeJourneyLevel,
  blocksNormalJourney,
  detectLevelD,
  levelCJourneyEligible,
  requiresLevelCReferral,
} from "../content/levelGuard";
import { detectLearningFocus } from "../content/lessons/learningFocus";
import { isOutOfProductScope } from "../content/scopeGuard";
import { resolveTopicLearningPack, topicLearningPolicyError } from "../content/topicLearning";
import { readyTopicIds } from "../content/topicPackReadiness";
import { getPublishedTopic, topicMetaForModel } from "../content/topics";
import { guessDomain, resolveAnalyzeRoute, type ReferralReason } from "./analyzeRouting";
import { mockProvider } from "./mockProvider";
import { DEFAULT_BUDGET_MS, MIN_ATTEMPT_MS, createOpenAIProvider, parseModelList } from "./openaiProvider";
import { buildRepositoryJourneyPayload } from "./orchestratePayload";
import { JSON_REPAIR_PROMPT, analyzeSystemPrompt, analyzeUserPrompt } from "./prompts";
import {
  isTimeoutError,
  type AIProvider,
  type ChatMessage,
  type ProviderMode,
} from "./provider";

export type OrchestratorEnv = {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  /** One model or a comma-separated fallback list, tried in order. */
  AI_MODEL?: string;
  /**
   * Sent as `reasoning_effort` only when set (e.g. "low" for Gemini); unset/"none"/"off"/"" sends
   * nothing — models such as gpt-4o-mini reject the parameter.
   */
  AI_REASONING_EFFORT?: string;
  /** Start the next model when the current one has not answered after this long (ms, default 2500). */
  AI_HEDGE_AFTER_MS?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  AI_MOCK?: string;
  MODE?: string;
};

export type AnalyzeOrchestratorResult = AnalyzeResponse;
export type JourneyOrchestratorResult = JourneyResponse;

export type AnalyzeOptions = {
  /** Absolute epoch-ms deadline for the whole analyze stage (all model calls included). */
  deadline?: number;
  knowledge?: KnowledgeBase;
  readyTopicIds?: readonly string[];
};

const localDanger =
  /أنتحر|انتحار|أقتل نفسي|أنهي حياتي|ما أبغى أعيش|أبغى أموت|أتمنى أموت|أذي نفسي|أؤذي نفسي|أجرح نفسي|kill myself|end my life|suicide|self.?harm|hurt myself|want to die|better off without me|no point (?:in )?(?:going on|living|being alive)|don'?t want to (?:live|be alive|exist) anymore|الكل بيرتاح مني|الكل بيرتاحون مني|أحسن لهم بدوني|ما له داعي أعيش|مالي داعي أعيش|ما فيه فايدة أعيش/i;

export const DEFAULT_MODEL = "gpt-4o-mini";
/** Netlify synchronous functions are budgeted at 10 s — the analyze stage must settle within 9 s. */
export const ANALYZE_DEADLINE_MS = DEFAULT_BUDGET_MS;

function apiKeyFor(env: OrchestratorEnv): string {
  return (env.AI_API_KEY || env.OPENAI_API_KEY || "").trim();
}

function mockOptedIn(env: OrchestratorEnv): boolean {
  return env.AI_MOCK === "true" || env.AI_MOCK === "1";
}

export function createProvider(env: OrchestratorEnv): AIProvider | null {
  const key = apiKeyFor(env);
  if (key) {
    const effortRaw = (env.AI_REASONING_EFFORT ?? "").trim().toLowerCase();
    const hedge = Number(env.AI_HEDGE_AFTER_MS);
    return createOpenAIProvider({
      apiKey: key,
      baseUrl: (env.AI_BASE_URL || env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
      models: parseModelList(env.AI_MODEL || env.OPENAI_MODEL, DEFAULT_MODEL),
      reasoningEffort: ["", "none", "off", "false", "0"].includes(effortRaw) ? null : effortRaw,
      hedgeAfterMs: Number.isFinite(hedge) && hedge > 0 ? hedge : undefined,
    });
  }
  if (mockOptedIn(env)) return mockProvider;
  return null;
}

/**
 * Response `mode` for repository-only stages (journey): mock only when the mock is the configured
 * provider — the same decision as `createProvider`, without building one.
 */
export function modeForEnv(env: OrchestratorEnv): ProviderMode {
  return !apiKeyFor(env) && mockOptedIn(env) ? "mock" : "live";
}

/**
 * Analyze stage. Deterministic guards (self-harm, Level D, out-of-scope, explicit Level C) run
 * first and need no model — so they still work when `provider` is null (no AI key configured),
 * in which case anything that needs understanding returns `unconfigured`.
 */
export async function runAnalyze(
  request: GuidanceRequest,
  provider: AIProvider | null,
  options: AnalyzeOptions = {},
): Promise<AnalyzeOrchestratorResult> {
  const started = Date.now();
  const deadline = options.deadline ?? started + ANALYZE_DEADLINE_MS;
  const knowledge = options.knowledge ?? getDefaultKnowledgeBase();
  const message = request.message.trim().slice(0, 2000);
  const context = normalizeContext(request);
  const mode: ProviderMode = provider?.name ?? "live";

  // Deterministic guards first — no model call for danger or personal rulings. Only the user's own
  // turns count: companion text (e.g. a helpline message that names suicide) is not a danger signal.
  const userContext = context
    .filter((t) => t.role === "user")
    .map((t) => t.text)
    .join(" ");
  if (localDanger.test(message) || (userContext && localDanger.test(userContext))) {
    log("safety", started);
    return { ok: true, mode, referral: referralPayload(request.language, message, "self_harm") };
  }
  if (detectLevelD(message)) {
    log("level_d", started);
    const pointer = knowledge.pointerFor(levelDDomain(message));
    return withPointer({ ok: true, mode, referral: referralPayload(request.language, message, "level_d") }, pointer);
  }
  if (isOutOfProductScope(message)) {
    log("insufficient", started);
    return { ok: false, error: "insufficient_reference" };
  }
  if (requiresLevelCReferral(message)) {
    log("referral", started);
    const pointer = knowledge.pointerFor(guessDomain(message));
    return withPointer({ ok: true, mode, referral: referralPayload(request.language, message, "level_c") }, pointer);
  }
  if (isTooThin(message)) {
    log("unclear", started);
    return { ok: false, error: "unclear" };
  }

  if (!provider) {
    log("unconfigured", started);
    return { ok: false, error: "unconfigured" };
  }

  const ready = options.readyTopicIds ?? readyTopicIds();
  const candidates: KnowledgeCandidate[] = safeCandidates(knowledge, message);

  try {
    const messages: ChatMessage[] = [
      { role: "system", content: analyzeSystemPrompt(knowledge.grounding) },
      {
        role: "user",
        content: analyzeUserPrompt({
          message,
          language: request.language,
          context,
          topics: topicMetaForModel(ready),
          knowledgeCandidates: candidates,
        }),
      },
    ];

    const draft = await completeAnalyze(provider, messages, deadline);
    if (!draft) {
      log("invalid", started);
      return { ok: false, error: "invalid" };
    }

    const resolved = resolveAnalyzeRoute(message, draft, request.language, {
      readyTopicIds: ready,
      knowledge,
      candidates,
    });

    switch (resolved.kind) {
      case "unclear":
        log("unclear", started);
        return { ok: false, error: "unclear" };
      case "insufficient":
        log("insufficient", started);
        return withErrorPointer({ ok: false, error: "insufficient_reference" }, resolved.pointer);
      case "referral":
        log(`referral_${resolved.reason}`, started);
        return withPointer(
          {
            ok: true,
            mode,
            referral: referralPayload(request.language, draft.context_summary, resolved.reason),
          },
          resolved.pointer,
        );
      case "knowledge":
        log(`knowledge_${resolved.answer.kind}`, started);
        return { ok: true, mode, route: "knowledge", analyze: resolved.analyze, answer: resolved.answer };
      case "direct_learning":
        log("direct_learning", started);
        return {
          ok: true,
          mode,
          route: "direct_learning",
          analyze: resolved.analyze,
          payload: resolved.payload,
        };
      case "topic_discovery":
        log("analyze_ok", started);
        return { ok: true, mode, route: "topic_discovery", analyze: resolved.analyze };
    }
  } catch (error) {
    return failFromError(error, started);
  }
}

/**
 * Journey request plus `focus` — what the person asked to learn (analyze.learning_focus passed back by
 * the browser, already enum-validated by the HTTP handler). When absent or empty, the deterministic
 * learning cues run on the message instead.
 */
export type JourneyRunRequest = JourneyRequest & { focus?: readonly LessonAspect[] };

/** Journey is repository-only: it never calls the model. `provider` only supplies the response mode. */
export async function runJourney(
  request: JourneyRunRequest,
  provider: { name: string },
): Promise<JourneyOrchestratorResult> {
  const started = Date.now();
  const mode: ProviderMode = provider.name === "mock" ? "mock" : "live";
  const message = request.message.trim().slice(0, 2000);
  if (localDanger.test(message)) return { ok: false, error: "referral_required" };
  if (requiresLevelCReferral(message)) return { ok: false, error: "referral_required" };

  const topic = getPublishedTopic(request.topicId);
  if (!topic) {
    log("journey_insufficient", started);
    return { ok: false, error: "insufficient_reference" };
  }

  let effectiveLevel = authoritativeJourneyLevel({
    message,
    clientLevel: request.analyzeLevel,
    topicLevel: topic.level,
    contentLevel: null,
  });
  if (blocksNormalJourney(effectiveLevel)) return { ok: false, error: "referral_required" };

  if (topicLearningPolicyError(request.topicId, effectiveLevel)) {
    log("journey_insufficient", started);
    return { ok: false, error: "insufficient_reference" };
  }
  let learning = resolveTopicLearningPack(request.topicId, effectiveLevel, request.language);
  if (learning.error || !learning.pack?.quran) {
    log("journey_insufficient", started);
    return { ok: false, error: "insufficient_reference" };
  }

  const refinedLevel = authoritativeJourneyLevel({
    message,
    clientLevel: request.analyzeLevel,
    topicLevel: topic.level,
    contentLevel: learning.pack.quran.level,
  });
  if (refinedLevel !== effectiveLevel) {
    effectiveLevel = refinedLevel;
    if (blocksNormalJourney(effectiveLevel)) return { ok: false, error: "referral_required" };
    const again = resolveTopicLearningPack(request.topicId, effectiveLevel, request.language);
    if (again.error || !again.pack?.quran) {
      log("journey_insufficient", started);
      return { ok: false, error: "insufficient_reference" };
    }
    learning = again;
  }

  const pack = learning.pack!;
  if (effectiveLevel === "C" && !levelCJourneyEligible(topic.level, pack.quran!.level)) {
    log("journey_insufficient", started);
    return { ok: false, error: "insufficient_reference" };
  }

  log("journey_ok", started);
  const focus = request.focus?.length ? [...request.focus] : detectLearningFocus(message);
  return {
    ok: true,
    mode,
    payload: buildRepositoryJourneyPayload(topic.id as TopicId, pack, effectiveLevel, request.language, { focus, message }),
  };
}

/** Same verified repository path as journey — no model religious text. */
export async function runDirectLearning(
  request: JourneyRunRequest,
  provider: { name: string },
): Promise<JourneyOrchestratorResult> {
  return runJourney(request, provider);
}

async function completeAnalyze(provider: AIProvider, messages: ChatMessage[], deadline: number) {
  const first = await provider.complete(messages, { temperature: 0.2, deadline });
  let parsed = validateAnalyze(parseModelJson(first));
  if (parsed) return parsed;

  // One repair attempt, only if the shared deadline still leaves room for a call. Otherwise the
  // model did answer, just not validly: that is `invalid`, not `timeout`.
  if (deadline - Date.now() < MIN_ATTEMPT_MS) return null;
  const repaired = await provider.complete(
    [
      ...messages,
      { role: "assistant", content: first.slice(0, 1500) },
      { role: "user", content: JSON_REPAIR_PROMPT },
    ],
    { temperature: 0.1, deadline },
  );
  parsed = validateAnalyze(parseModelJson(repaired));
  return parsed;
}

function safeCandidates(knowledge: KnowledgeBase, message: string): KnowledgeCandidate[] {
  try {
    return knowledge.findCandidates(message);
  } catch {
    return [];
  }
}

function levelDDomain(message: string) {
  const domain = guessDomain(message);
  return domain === "terminology" || domain === "dawah" ? "fiqh" : domain;
}

function withPointer(
  result: { ok: true; mode: ProviderMode; referral: ReferralPayload },
  pointer: SourcePointer | null | undefined,
): AnalyzeOrchestratorResult {
  return pointer ? { ...result, pointer } : result;
}

function withErrorPointer(
  result: { ok: false; error: "insufficient_reference" },
  pointer: SourcePointer | null | undefined,
): AnalyzeOrchestratorResult {
  return pointer ? { ...result, pointer } : result;
}

/**
 * Too little to understand (e.g. «هممم», "hmm", "..."): ask for a few more words instead of
 * guessing topics. Repeated letters collapse first, so «هممم» counts as two letters; a single
 * real word such as «حزين» still passes.
 */
export function isTooThin(message: string): boolean {
  const letters = (message.normalize("NFKC").match(/[\p{L}]/gu) ?? []).join("").toLowerCase();
  const collapsed = letters.replace(/(.)\1+/g, "$1");
  return collapsed.length < 3;
}

function normalizeContext(request: GuidanceRequest) {
  return (request.context ?? []).slice(-4).map((turn) => ({
    role: turn.role,
    text: turn.text.slice(0, 400),
  }));
}

function referralPayload(
  language: "ar" | "en",
  contextSummary: string,
  reason: ReferralReason,
): ReferralPayload {
  const ar =
    reason === "self_harm"
      ? "ما كتبته يحتاج دعمًا بشريًا الآن. طمأنينة لا تقدّم علاجًا ولا تستبدل خط المساعدة أو شخصًا تثق به."
      : reason === "level_c"
        ? "سؤالك يمس مسألة خلافية أو تحتاج تفصيلًا من أهل العلم. طمأنينة لا تختار بين الأقوال — للموضوعات الحساسة، تواصل مع عالم أو مركز شرعي موثوق."
        : "سؤالك يمس حكمًا شرعيًا شخصيًا على حالتك. طمأنينة تقدّم معلومات عامة وموثّقة فقط — للحكم على واقعة فردية، تواصل مع عالم أو مركز شرعي موثوق.";
  const en =
    reason === "self_harm"
      ? "What you wrote needs human support now. Tamaninah is not therapy and cannot replace a helpline or someone you trust."
      : reason === "level_c"
        ? "Your question touches a disputed or specialist matter. Tamaninah does not choose between scholarly views — for sensitive topics, please turn to a qualified scholar or trusted centre."
        : "Your question touches a personal religious ruling about your situation. Tamaninah offers general, sourced information only — for an individual ruling, please turn to a qualified scholar or trusted centre.";
  return {
    kind: "referral",
    reason,
    level: reason === "level_c" ? "C" : "D",
    context_summary: contextSummary.slice(0, 320),
    message: language === "en" ? en : ar,
  };
}

function failFromError(error: unknown, started: number): AnalyzeOrchestratorResult {
  const timeout = isTimeoutError(error);
  log(timeout ? "timeout" : "upstream", started);
  return { ok: false, error: timeout ? "timeout" : "upstream" };
}

/** Outcome + latency only — never user text. */
function log(outcome: string, started: number) {
  console.info(`[guidance] outcome=${outcome} latency_ms=${Date.now() - started}`);
}
