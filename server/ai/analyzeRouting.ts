import type { KnowledgeAnswer, KnowledgeDomain, SourcePointer } from "../../shared/experience/api";
import type {
  AnalyzeDraft,
  AnalyzeResult,
  ContentLevel,
  GuidancePayload,
  InputIntent,
  Lang,
  LessonAspect,
  RecommendedPath,
  SuggestedTopic,
} from "../../shared/experience/guidance";
import { normalizeArabic } from "../content/knowledge/arabicText";
import {
  EMPTY_KNOWLEDGE_BASE,
  type KnowledgeBase,
  type KnowledgeCandidate,
} from "../content/knowledge/knowledgeBase";
import {
  authoritativeAnalyzeLevel,
  blocksNormalJourney,
  detectLevelD,
  escalateLevel,
  levelCJourneyEligible,
  requiresLevelCReferral,
} from "../content/levelGuard";
import { detectLearningFocus, mergeLearningFocus } from "../content/lessons/learningFocus";
import { isOutOfProductScope } from "../content/scopeGuard";
import { resolveTopicLearningPack } from "../content/topicLearning";
import { readyTopicIds } from "../content/topicPackReadiness";
import { getPublishedTopic } from "../content/topics";
import { buildRepositoryJourneyPayload } from "./orchestratePayload";

export type ReferralReason = "level_d" | "level_c" | "self_harm";

export type ResolvedAnalyzeRoute =
  | { kind: "topic_discovery"; analyze: AnalyzeResult }
  | { kind: "direct_learning"; analyze: AnalyzeResult; payload: GuidancePayload; topicId: string }
  | { kind: "knowledge"; analyze: AnalyzeResult; answer: KnowledgeAnswer }
  | { kind: "referral"; reason: ReferralReason; pointer?: SourcePointer }
  | { kind: "insufficient"; pointer?: SourcePointer }
  | { kind: "unclear" };

export type RouteContext = {
  /** Topics whose verified pack is ready — the only ones the user may be offered. */
  readyTopicIds?: readonly string[];
  knowledge?: KnowledgeBase;
  /** The candidate list sent to the model — a picked knowledge_id must be one of these. */
  candidates?: readonly KnowledgeCandidate[];
};

const EXPERIENTIAL_INTENTS: InputIntent[] = ["EXPERIENCE", "FEELING", "SITUATION"];
const QUESTION_INTENTS: InputIntent[] = ["DIRECT_QUESTION", "RELIGIOUS_RULING_QUESTION"];

/**
 * Domains whose questions ask for a specific text, ruling or historical fact. A topic learning
 * journey is never an answer to them (e.g. "give me a hadith proving X" must not be met with a
 * patience journey that looks like the requested proof) — no catalog match means an honest
 * insufficient_reference with the PDF's approved source for the domain.
 */
const EVIDENCE_DOMAINS: ReadonlySet<KnowledgeDomain> = new Set(["hadith", "quran", "tafseer", "fiqh", "seerah"]);

/** Explicit requests for proof text ("أعطني حديثًا يثبت…", "give me a verse that proves…"). */
const EVIDENCE_REQUEST =
  /(?:أعطني|اعطني|عطني|هات|أريد|اريد|أبغى|ابغى|أبي|ابي|اذكر|أذكر)\s+(?:لي\s+)?(?:حديث|حديثا|حديثًا|آية|اية|آيه|دليل|دليلا|دليلًا)|(?:حديث|آية|دليل)\S*\s+(?:يثبت|يدل|تثبت|تدل)|(?:give|show|quote)\s+(?:me\s+)?(?:a\s+)?(?:hadith|verse|proof|evidence)|(?:hadith|verse)\s+(?:that\s+)?(?:proves?|shows?)/i;

function readySuggestions(draft: AnalyzeDraft, ready: ReadonlySet<string>, lang: Lang): SuggestedTopic[] {
  const out: SuggestedTopic[] = [];
  for (const topic of draft.suggested_topics) {
    if (!ready.has(topic.id) || out.some((t) => t.id === topic.id)) continue;
    const catalog = getPublishedTopic(topic.id);
    if (!catalog) continue;
    // Title is always the server catalog title in the request language — never model text.
    out.push({
      id: topic.id,
      title: lang === "en" ? catalog.title.en : catalog.title.ar,
      ...(topic.reason ? { reason: topic.reason } : {}),
    });
  }
  return out.slice(0, 4);
}

function toAnalyzeResult(
  draft: AnalyzeDraft,
  level: ContentLevel,
  topics: SuggestedTopic[],
  path: RecommendedPath = draft.recommended_path,
  focus: readonly LessonAspect[] = [],
): AnalyzeResult {
  return {
    context_summary: draft.context_summary,
    level,
    safety: draft.safety,
    suggested_topics: topics,
    input_intent: draft.input_intent,
    recommended_path: path,
    ...(focus.length ? { learning_focus: [...focus] } : {}),
  };
}

/**
 * Ruling words, matched as whole normalized tokens (optionally with و/ف/ب/ل/ك and ال) — a bare
 * substring «حكم» would also hit «الحكمة» (wisdom) and «محكمة» (court).
 */
const FIQH_TOKENS = new Set(
  ["حكم", "أحكام", "يجوز", "تجوز", "حلال", "حرام", "فتوى", "فتاوى", "زواج", "طلاق", "صلاة", "صيام", "زكاة"].map((w) =>
    normalizeArabic(w),
  ),
);
const FIQH_PROCLITICS = ["وبال", "وال", "فال", "بال", "كال", "لل", "ال", "و", "ف", "ب", "ل", "ك"];

function hasFiqhToken(message: string): boolean {
  return normalizeArabic(message)
    .split(" ")
    .some((t) => FIQH_TOKENS.has(t) || FIQH_PROCLITICS.some((p) => t.startsWith(p) && FIQH_TOKENS.has(t.slice(p.length))));
}

/**
 * Qur'an words as whole tokens (with the same proclitics) — a bare substring «آية» would also hit
 * «نهاية», «هداية» and «بداية».
 */
const QURAN_TOKENS = new Set(["آية", "آيات", "سورة", "سور", "القرآن", "قرآن", "مصحف"].map((w) => normalizeArabic(w)));

function hasQuranToken(message: string): boolean {
  return normalizeArabic(message)
    .split(" ")
    .some((t) => QURAN_TOKENS.has(t) || FIQH_PROCLITICS.some((p) => t.startsWith(p) && QURAN_TOKENS.has(t.slice(p.length))));
}

/** Lexical fallback when the model leaves `domain` empty for a question. */
export function guessDomain(message: string): KnowledgeDomain {
  const m = message.toLowerCase();
  if (/ترجم|ترجمة|مصطلح|بالإنجليزي|بالانجليزي|translate|translation|\bterm\b/.test(m)) return "terminology";
  if (/حديث|أحاديث|احاديث|hadith|sunnah/.test(m)) return "hadith";
  if (/تفسير|tafsir|tafseer|exegesis/.test(m)) return "tafseer";
  if (hasQuranToken(m) || /quran|qur'an|\bverses?\b|\bsurah\b/.test(m)) return "quran";
  if (/سيرة|غزوة|الصحابة|seerah|sirah|battle of/.test(m)) return "seerah";
  if (hasFiqhToken(m) || /\b(?:halal|haram|rulings?|permissible|marriage|divorce)\b/.test(m)) return "fiqh";
  if (/توحيد|عقيدة|العقيدة|إيمان|ايمان|creed|aqeed|aqid|tawhid/.test(m)) return "aqeeda";
  if (/شبهة|شبهات|لماذا يعبد|بالسيف|doubt|why do muslims|why does islam/.test(m)) return "shubuhat";
  return "dawah";
}

function tryDirectLearning(
  draft: AnalyzeDraft,
  level: ContentLevel,
  lang: Lang,
  topics: SuggestedTopic[],
  extra: { focus: LessonAspect[]; message: string },
): ResolvedAnalyzeRoute | null {
  const topicId = topics[0]?.id;
  if (!topicId) return null;
  const topic = getPublishedTopic(topicId);
  if (!topic || blocksNormalJourney(level)) return null;

  const learning = resolveTopicLearningPack(topicId, level, lang);
  if (learning.error || !learning.pack?.quran) return null;
  if (level === "C" && !levelCJourneyEligible(topic.level, learning.pack.quran.level)) return null;

  return {
    kind: "direct_learning",
    analyze: toAnalyzeResult(draft, level, topics, "direct_learning", extra.focus),
    topicId,
    payload: buildRepositoryJourneyPayload(topic.id as GuidancePayload["topic_id"], learning.pack, level, lang, extra),
  };
}

/**
 * Prophets, the Messenger ﷺ and the Companions, as whole normalized tokens (with و/ف/ب/ل/ك and ال) or as
 * honorific phrases. The model's free text (the reading and topic reasons) must not bring them in on its own:
 * «يبحث الرسول عن معنى التوكل» is a slip that reads as a claim about the Prophet ﷺ.
 */
const SACRED_TOKENS = new Set(["رسول", "رسل", "نبي", "انبياء", "نبينا", "صحابه", "صحابي", "صحابيه"]);
const SACRED_PHRASES = /ﷺ|صلى الله عليه|عليه السلام|عليهم السلام|رضي الله|\b(?:prophets?|messengers?|companions)\b/iu;

export function mentionsSacredFigure(text: string): boolean {
  if (SACRED_PHRASES.test(text)) return true;
  return normalizeArabic(text)
    .split(" ")
    .some((t) => SACRED_TOKENS.has(t) || FIQH_PROCLITICS.some((p) => t.startsWith(p) && SACRED_TOKENS.has(t.slice(p.length))));
}

/** Drop model free text that names sacred figures the person's own message did not mention. */
export function sanitizeModelText(message: string, draft: AnalyzeDraft): AnalyzeDraft {
  if (mentionsSacredFigure(message)) return draft;
  return {
    ...draft,
    context_summary: mentionsSacredFigure(draft.context_summary) ? "" : draft.context_summary,
    suggested_topics: draft.suggested_topics.map((t) => {
      if (!t.reason || !mentionsSacredFigure(t.reason)) return t;
      const { reason: _dropped, ...rest } = t;
      return rest;
    }),
  };
}

/** Server-side route after the model draft + level guards (authoritative). */
export function resolveAnalyzeRoute(
  message: string,
  rawDraft: AnalyzeDraft,
  lang: Lang,
  context: RouteContext = {},
): ResolvedAnalyzeRoute {
  const draft = sanitizeModelText(message, rawDraft);
  const knowledge = context.knowledge ?? EMPTY_KNOWLEDGE_BASE;
  const candidates = context.candidates ?? [];
  const ready = new Set(context.readyTopicIds ?? readyTopicIds());

  if (isOutOfProductScope(message)) return { kind: "insufficient" };
  if (draft.safety === "unclear") return { kind: "unclear" };

  const experiential = EXPERIENTIAL_INTENTS.includes(draft.input_intent);
  const question = QUESTION_INTENTS.includes(draft.input_intent);
  const domain: KnowledgeDomain | null = draft.domain ?? (experiential ? null : guessDomain(message));
  const pointer = (d: KnowledgeDomain | null) => knowledge.pointerFor(d) ?? undefined;

  const level = authoritativeAnalyzeLevel(message, draft.level);
  /** Level from deterministic message guards only (independent of the model's opinion). */
  const guardLevel = authoritativeAnalyzeLevel(message, "A");
  // Lived experiences keep flowing to topics even when phrased as "I need proof that…".
  const evidenceRequest = !experiential && EVIDENCE_REQUEST.test(message);
  // What the person asked to learn on top of a journey: deterministic cues first, then the model's.
  const focus = mergeLearningFocus(detectLearningFocus(message), draft.learning_focus);
  const learning = { focus, message };

  // A lived experience the model flags for a human, with no ruling cue in the person's own words, is a
  // wellbeing referral — it must never land on the fatwa branch just because the model also said "D".
  if (experiential && draft.safety === "refer" && !detectLevelD(message) && guardLevel !== "D") {
    return { kind: "referral", reason: "self_harm" };
  }
  // Level D — personal ruling / fatwa: no independent answer, general pointer + referral.
  if (detectLevelD(message) || level === "D") {
    return { kind: "referral", reason: "level_d", pointer: pointer(domain && domain !== "terminology" ? domain : "fiqh") };
  }
  // The model flagged a need for a human without a ruling question: for a lived experience that
  // means human support (wellbeing), never a fatwa referral.
  if (draft.safety === "refer") {
    if (experiential) return { kind: "referral", reason: "self_harm" };
    if (level === "C") return { kind: "referral", reason: "level_c", pointer: pointer(domain) };
    return { kind: "referral", reason: "level_d", pointer: pointer(domain ?? "fiqh") };
  }
  if (requiresLevelCReferral(message)) {
    return { kind: "referral", reason: "level_c", pointer: pointer(domain) };
  }
  if (draft.input_intent === "OUT_OF_SCOPE") return { kind: "insufficient" };

  const topics = readySuggestions(draft, ready, lang);

  // Knowledge route — only ids the server itself offered, resolved to verbatim source text.
  const offered = new Set(candidates.map((c) => c.id));
  let pickedId = draft.knowledge_id && offered.has(draft.knowledge_id) ? draft.knowledge_id : null;
  if (!pickedId && !experiential) {
    const explicit = knowledge.explicitGlossaryMatch(message);
    if (explicit && offered.has(explicit.id)) pickedId = explicit.id;
  }
  if (pickedId) {
    const resolution = knowledge.resolve(pickedId);
    if (resolution.kind === "answer") {
      // A reviewed verbatim excerpt is "an answer restricted to approved material" — allowed by the
      // PDF even for Level C. So the curated entry level and the deterministic message guards
      // decide; a model-only "C" does not hide approved text. Guard-detected C still refers.
      const answerLevel = escalateLevel(guardLevel, resolution.answer.level);
      if (answerLevel === "C" || answerLevel === "D") {
        return { kind: "referral", reason: "level_c", pointer: pointer(resolution.answer.domain) };
      }
      return {
        kind: "knowledge",
        analyze: toAnalyzeResult(draft, answerLevel, topics, "direct_learning"),
        answer: resolution.answer,
      };
    }
    if (resolution.kind === "restricted") {
      return { kind: "referral", reason: "level_c", pointer: resolution.pointer ?? pointer(resolution.domain) };
    }
    if (resolution.kind === "index_only") {
      if (level === "C") return { kind: "referral", reason: "level_c", pointer: resolution.pointer };
      return { kind: "insufficient", pointer: resolution.pointer };
    }
  }

  // Questions: Level C states the difference and refers; otherwise a ready topic or an honest pointer.
  const wantsDirect = question || draft.recommended_path === "direct_learning";
  if (question || evidenceRequest || (wantsDirect && !experiential)) {
    const evidenceDomain: KnowledgeDomain | null = evidenceRequest
      ? /حديث|hadith/i.test(message)
        ? "hadith"
        : /آية|اية|آيه|verse/i.test(message)
          ? "quran"
          : domain
      : domain;
    if (level === "C") return { kind: "referral", reason: "level_c", pointer: pointer(evidenceDomain) };
    if (evidenceRequest || (evidenceDomain && EVIDENCE_DOMAINS.has(evidenceDomain))) {
      return { kind: "insufficient", pointer: pointer(evidenceDomain) };
    }
    return tryDirectLearning(draft, level, lang, topics, learning) ?? { kind: "insufficient", pointer: pointer(domain) };
  }

  if (level === "C") return { kind: "insufficient", pointer: pointer(domain) };

  if (wantsDirect) {
    const direct = tryDirectLearning(draft, level, lang, topics, learning);
    if (direct) return direct;
  }

  if (!topics.length) return { kind: "insufficient", pointer: pointer(domain) };

  return { kind: "topic_discovery", analyze: toAnalyzeResult(draft, level, topics, "topic_discovery", focus) };
}

export function inferRecommendedPath(intent: InputIntent, topicCount: number): RecommendedPath {
  if (intent === "RELIGIOUS_RULING_QUESTION") return "direct_learning";
  if (intent === "DIRECT_QUESTION" || topicCount === 1) return "direct_learning";
  if (intent === "OUT_OF_SCOPE") return "insufficient";
  return "topic_discovery";
}
