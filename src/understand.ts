/**
 * Browser client for POST /api/understand (wire contract: shared/experience/api.ts).
 * The browser never authors religious text: it only shows what this endpoint returns.
 */
import type {
  AnalyzeResponse,
  JourneyResponse,
  KnowledgeAnswer,
  SourcePointer,
  UnderstandError,
  UnderstandRequestBody,
} from "../shared/experience/api";
import type { AnalyzeResult, GuidancePayload, Lang, LessonAspect, ReferralPayload } from "../shared/experience/guidance";

export const UNDERSTAND_URL = "/api/understand";
export const CLIENT_TIMEOUT_MS = 25_000;

export type ClientError = UnderstandError | "network";

/** What the experience should show next, already checked for shape. */
export type Outcome =
  | { kind: "topics"; analyze: AnalyzeResult }
  | { kind: "learning"; analyze: AnalyzeResult | null; payload: GuidancePayload }
  | { kind: "knowledge"; analyze: AnalyzeResult | null; answer: KnowledgeAnswer }
  /**
   * `referral` is null when the server only said `referral_required` (journey stage).
   * `pointer` names the approved source for general information in that domain (Level C/D).
   */
  | { kind: "referral"; referral: ReferralPayload | null; pointer?: SourcePointer }
  | { kind: "insufficient"; pointer?: SourcePointer }
  | { kind: "unclear" }
  | { kind: "error"; error: ClientError };

type Wire = AnalyzeResponse | JourneyResponse;

const LESSON_ASPECTS: readonly LessonAspect[] = ["meaning", "how", "etiquette", "virtues", "fruits", "evidence", "types", "examples"];

/**
 * What the person asked to learn beyond the core journey, as the analyze stage read it — passed back
 * as `focus` with the journey request. Only known aspects, each once; anything else is dropped.
 */
export function learningFocus(analyze: AnalyzeResult | null): LessonAspect[] {
  const raw: unknown = analyze?.learning_focus;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((a): a is LessonAspect => LESSON_ASPECTS.includes(a as LessonAspect)))];
}

/**
 * Builds the message the server reads: the person's words, with any picked "what I'm writing about"
 * hints appended after a neutral prefix. (The composer only sends when words were typed.)
 */
export function composeMessage(text: string, kinds: string[], lang: Lang, prefix: string): string {
  const body = text.trim();
  if (!kinds.length) return body;
  const list = kinds.join(lang === "ar" ? "، " : ", ");
  return body ? `${body}\n\n(${prefix} ${list})` : list;
}

/** POSTs one stage. Throws only on network failure or abort; HTTP errors come back as `{ ok:false }`. */
export async function postUnderstand(body: UnderstandRequestBody, signal: AbortSignal): Promise<Wire> {
  const res = await fetch(UNDERSTAND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch (error) {
    if (signal.aborted) throw error;
    data = null;
  }
  if (isObj(data) && typeof data.ok === "boolean") return data as Wire;
  const error: UnderstandError = res.status === 429 ? "rate" : res.status === 504 ? "timeout" : "upstream";
  return { ok: false, error };
}

/** Turns a wire response into the next screen. Anything malformed is an honest error, never a guess. */
export function interpret(stage: UnderstandRequestBody["stage"], res: Wire, prior: AnalyzeResult | null): Outcome {
  if (!res.ok) {
    switch (res.error) {
      case "insufficient_reference":
        return { kind: "insufficient", pointer: validPointer(res.pointer) };
      case "unclear":
        return { kind: "unclear" };
      case "referral_required":
        return { kind: "referral", referral: null, pointer: validPointer(res.pointer) };
      default:
        return { kind: "error", error: res.error ?? "upstream" };
    }
  }

  if ("referral" in res) {
    if (!isReferral(res.referral)) return invalid();
    // Self-harm goes to human help only — no source pointers on that screen.
    const pointer = res.referral.reason === "self_harm" ? undefined : validPointer(res.pointer);
    return { kind: "referral", referral: res.referral, pointer };
  }

  if (stage === "journey" || !("route" in res)) {
    return "payload" in res ? learning(prior, res.payload) : invalid();
  }

  const analyze = isAnalyze(res.analyze) ? res.analyze : null;
  switch (res.route) {
    case "topic_discovery": {
      if (!analyze) return invalid();
      const topics = analyze.suggested_topics.filter(
        (t) => isObj(t) && typeof t.id === "string" && typeof t.title === "string" && t.title.trim() !== "",
      );
      if (!topics.length) return { kind: "insufficient" };
      return { kind: "topics", analyze: { ...analyze, suggested_topics: topics } };
    }
    case "direct_learning":
      return learning(analyze, res.payload);
    case "knowledge":
      return isAnswer(res.answer) ? { kind: "knowledge", analyze, answer: res.answer } : invalid();
    default:
      return invalid();
  }
}

/** True when the payload carries at least one piece of verified catalog content to show. */
export function hasCatalogContent(p: GuidancePayload): boolean {
  return Boolean(p.content || p.quran_explanation || p.hadith || p.hadith_explanation || p.story);
}

function learning(analyze: AnalyzeResult | null, payload: unknown): Outcome {
  if (!isObj(payload)) return invalid();
  const p = payload as GuidancePayload;
  if (!hasCatalogContent(p)) return { kind: "insufficient" };
  return { kind: "learning", analyze, payload: p };
}

const invalid = (): Outcome => ({ kind: "error", error: "invalid" });

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isAnalyze(v: unknown): v is AnalyzeResult {
  return isObj(v) && Array.isArray(v.suggested_topics) && typeof v.level === "string";
}

function isReferral(v: unknown): v is ReferralPayload {
  return isObj(v) && (v.reason === "self_harm" || v.reason === "level_d" || v.reason === "level_c");
}

function isAnswer(v: unknown): v is KnowledgeAnswer {
  return (
    isObj(v) &&
    (v.kind === "glossary" || v.kind === "qa") &&
    typeof v.body_ar === "string" &&
    v.body_ar.trim() !== "" &&
    isObj(v.source) &&
    typeof v.source.name === "string"
  );
}

function validPointer(v: unknown): SourcePointer | undefined {
  if (!isObj(v) || !Array.isArray(v.sources)) return undefined;
  return v as SourcePointer;
}
