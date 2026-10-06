import type {

  ActionType,

  AnalyzeDraft,

  AnalyzeSafety,

  ContentLevel,

  InputIntent,

  LearningStep,

  LessonAspect,

  ModelDraft,

  RecommendedPath,

  SuggestedAction,

  SuggestedTopic,

  TopicId,

} from "./guidance";

import type { KnowledgeDomain } from "./api";
import { getPublishedTopic, publishedTopicIds } from "../../server/content/topics";



const catalogTopicIds = publishedTopicIds() as TopicId[];



const actions: ActionType[] = ["quran", "dua", "charity", "reach_out", "prayer"];

const levels: ContentLevel[] = ["A", "B", "C", "D"];

const analyzeSafety: AnalyzeSafety[] = ["safe", "unclear", "refer"];

const inputIntents: InputIntent[] = [
  "EXPERIENCE",
  "FEELING",
  "SITUATION",
  "DIRECT_QUESTION",
  "RELIGIOUS_RULING_QUESTION",
  "GENERAL_ISLAMIC_LEARNING",
  "OUT_OF_SCOPE",
];

const knowledgeDomains: KnowledgeDomain[] = [
  "dawah",
  "quran",
  "tafseer",
  "hadith",
  "aqeeda",
  "fiqh",
  "seerah",
  "shubuhat",
  "terminology",
];

/** Every aspect a person may ask to learn (contract: shared/experience/guidance.ts LessonAspect). */
export const LESSON_ASPECTS: readonly LessonAspect[] = [
  "meaning",
  "how",
  "etiquette",
  "virtues",
  "fruits",
  "evidence",
  "types",
  "examples",
];

/** Most aspects the model may flag for one message (the journey shows at most 3 lessons). */
export const MAX_LEARNING_FOCUS = 3;

/**
 * Strict parse of a focus list (HTTP body `focus`): absent → []; anything that is not an array of
 * known aspects (or longer than the enum) → null. Duplicates collapse; order is canonical.
 */
export function parseLessonAspects(value: unknown): LessonAspect[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > LESSON_ASPECTS.length) return null;
  if (!value.every((v) => typeof v === "string" && (LESSON_ASPECTS as readonly string[]).includes(v))) return null;
  return LESSON_ASPECTS.filter((a) => value.includes(a));
}

/** Lenient read of the model's learning_focus: unknown values are dropped, at most 3 kept. */
function modelLearningFocus(value: unknown): LessonAspect[] {
  if (!Array.isArray(value)) return [];
  const known = value.filter((v): v is LessonAspect => typeof v === "string" && (LESSON_ASPECTS as readonly string[]).includes(v));
  return [...new Set(known)].slice(0, MAX_LEARNING_FOCUS);
}

const recommendedPaths: RecommendedPath[] = [
  "topic_discovery",
  "direct_learning",
  "referral",
  "insufficient",
];



export function parseModelJson(content: string): unknown {

  const trimmed = content.trim().replace(/^```json\s*|\s*```$/g, "");

  try {

    return JSON.parse(trimmed) as unknown;

  } catch {

    return null;

  }

}



export function validateAnalyze(raw: unknown): AnalyzeDraft | null {

  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;



  const level = asEnum(data.level, levels) ?? "B";

  const safety = asEnum(data.safety, analyzeSafety) ?? "safe";

  const contextSummary = clean(data.context_summary, 320) || clean(data.context, 320);

  if (!contextSummary && safety !== "unclear") return null;



  if (rawSuggestedTopicsContainScripture(data.suggested_topics)) return null;

  const suggested = validateSuggestedTopics(data.suggested_topics).slice(0, 4);

  let inputIntent = asEnum(data.input_intent, inputIntents);
  if (!inputIntent) {
    inputIntent = inferInputIntent(suggested.length, contextSummary);
  }

  let recommendedPath = asEnum(data.recommended_path, recommendedPaths);
  if (!recommendedPath) {
    recommendedPath =
      inputIntent === "DIRECT_QUESTION" || inputIntent === "RELIGIOUS_RULING_QUESTION"
        ? "direct_learning"
        : inputIntent === "OUT_OF_SCOPE"
          ? "insufficient"
          : "topic_discovery";
  }

  // How many topics an experience needs is a routing decision (server side, after the
  // ready-topic filter) — rejecting here would only burn a JSON-repair round-trip.

  if (looksLikeScripture(contextSummary + suggested.map((t) => t.title + (t.reason ?? "")).join(" "))) {

    return null;

  }

  return {

    context_summary: contextSummary,

    level,

    safety,

    suggested_topics: suggested,

    input_intent: inputIntent,

    recommended_path: recommendedPath,

    knowledge_id: cleanId(data.knowledge_id),

    domain: asEnum(data.domain, knowledgeDomains),

    learning_focus: modelLearningFocus(data.learning_focus),

  };

}

function inferInputIntent(topicCount: number, summary: string): InputIntent {
  if (/حكم|يجوز|يحرم|halal|haram|ruling|fatwa|في حالتي/i.test(summary)) {
    return "RELIGIOUS_RULING_QUESTION";
  }
  if (/معنى|what is|what does|meaning of|explain/i.test(summary)) {
    return "DIRECT_QUESTION";
  }
  if (topicCount >= 2) return "EXPERIENCE";
  if (topicCount === 1) return "DIRECT_QUESTION";
  return "GENERAL_ISLAMIC_LEARNING";
}



function rawSuggestedTopicsContainScripture(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title : "";
    const reason = typeof row.reason === "string" ? row.reason : "";
    if (looksLikeScripture(title + reason)) return true;
  }
  return false;
}

function validateSuggestedTopics(raw: unknown): SuggestedTopic[] {

  if (!Array.isArray(raw)) return [];

  const out: SuggestedTopic[] = [];

  for (const item of raw) {

    if (!item || typeof item !== "object") continue;

    const row = item as Record<string, unknown>;

    const id =
      typeof row.id === "string"
        ? row.id.trim()
        : typeof row.topicId === "string"
          ? row.topicId.trim()
          : "";

    if (!getPublishedTopic(id)) continue;

    const topic = getPublishedTopic(id)!;

    const title = clean(row.title, 80) || topic.title.ar;

    let reason = clean(row.reason, 180) || undefined;

    if (looksLikeScripture(title + (reason ?? ""))) continue;

    // A reason is a neutral link to the user's words — never a ruling. Drop it, keep the topic.
    if (reason && looksLikeRuling(reason)) reason = undefined;

    if (out.some((t) => t.id === id)) continue;

    out.push({ id, title, reason });

  }

  return out;

}



/**
 * @deprecated Legacy ModelDraft parser — not used in production runtime (journey prose removed).
 * Kept for unit tests only; analyze/journey use AnalyzeDraft paths in server orchestration.
 */
export function validateAnalysis(raw: unknown): ModelDraft | null {
  return readDraft(raw, { requireProse: false });
}

/**
 * @deprecated Legacy ModelDraft parser — not used in production runtime.
 * Kept for unit tests in `understand.test.ts` only.
 */
export function validateDraft(raw: unknown): ModelDraft | null {
  return readDraft(raw, { requireProse: true });
}



export function isCompleteDraft(draft: ModelDraft) {

  return (

    !draft.unclear &&

    !draft.safety.requires_human_support &&

    draft.response.length > 0 &&

    Boolean(draft.remember) &&

    Boolean(draft.suggested_action.title)

  );

}



function readDraft(raw: unknown, options: { requireProse: boolean }): ModelDraft | null {

  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;



  const safetyRaw = asObject(data.safety);

  const level = asEnum(safetyRaw?.level, ["normal", "emotional_distress", "high_risk", "self_harm_risk"] as const) ?? "normal";

  const requires =

    safetyRaw?.requires_human_support === true || level === "self_harm_risk" || level === "high_risk";



  const emotion = asObject(data.emotional_state);

  const primary = clean(emotion?.primary, 80) || "unspecified";

  const secondary = asStringArray(emotion?.secondary).slice(0, 3);

  const confidence = clampNumber(emotion?.confidence, 0, 1, 0.5);



  const response = asStringArray(data.response)

    .map((line) => clean(line, 420))

    .filter(Boolean)

    .slice(0, 4);

  const remember = clean(data.remember, 220);

  const heading = clean(data.heading, 140);

  const userNeed = clean(data.user_need, 180);

  const situation = clean(data.context, 280) || clean(data.situation, 280);

  const topicRaw = typeof data.topic_id === "string" ? data.topic_id : "";

  const topic = asEnum(topicRaw, catalogTopicIds);

  const action = validateAction(data.suggested_action);

  const learningPath = validateLearningPath(data.learning_path);

  const reflection = clean(data.reflection_question, 220);



  if (requires) {

    return {

      heading: "",

      emotional_state: { primary, secondary, confidence },

      context: situation,

      user_need: userNeed || "human_support",

      response: [],

      remember: "",

      topic_id: topic ?? "patience",

      suggested_action: action ?? defaultAction(),

      learning_path: [],

      reflection_question: "",

      safety: { level, requires_human_support: true },

      unclear: false,

    };

  }



  if (data.unclear === true) {

    return {

      heading,

      emotional_state: { primary, secondary, confidence },

      context: situation,

      user_need: userNeed,

      response: [],

      remember: "",

      topic_id: topic ?? "patience",

      suggested_action: action ?? defaultAction(),

      learning_path: [],

      reflection_question: "",

      safety: { level, requires_human_support: false },

      unclear: true,

    };

  }



  if (!topic) return null;



  const unclear = data.unclear === true || confidence < 0.35;

  if (!unclear && options.requireProse) {

    if (!action || response.length === 0 || !remember) return null;

    if (looksLikeScripture(response.join(" ") + remember + heading)) return null;

  }



  if (looksLikeScripture(response.join(" ") + remember + heading + situation)) return null;



  return {

    heading,

    emotional_state: { primary, secondary, confidence },

    context: situation,

    user_need: userNeed,

    response,

    remember,

    topic_id: topic,

    suggested_action: action ?? defaultAction(),

    learning_path: learningPath,

    reflection_question: reflection,

    safety: { level, requires_human_support: false },

    unclear,

  };

}



function validateAction(raw: unknown): SuggestedAction | null {

  const data = asObject(raw);

  if (!data) return null;

  const type = asEnum(data.type, actions);

  const title = clean(data.title, 80);

  const description = clean(data.description, 280);

  if (!type || !title || !description) return null;

  if (looksLikeScripture(title + description)) return null;

  return { type, title, description };

}



function validateLearningPath(raw: unknown): LearningStep[] {

  if (!Array.isArray(raw)) return [];

  const steps: LearningStep[] = [];

  for (const item of raw.slice(0, 3)) {

    if (typeof item === "string") {

      const title = clean(item, 80);

      if (title && !looksLikeScripture(title)) steps.push({ title, description: "" });

      continue;

    }

    const data = asObject(item);

    if (!data) continue;

    const title = clean(data.title, 80);

    const description = clean(data.description, 180);

    if (!title || looksLikeScripture(title + description)) continue;

    steps.push({ title, description });

  }

  return steps;

}



function defaultAction(): SuggestedAction {

  return {

    type: "reach_out",

    title: "تواصل مع أحد تثق فيه",

    description: "مو كل شيء لازم تحمله لحالك.",

  };

}



/** Ruling / fatwa language the model must never produce in its own words. */
function looksLikeRuling(text: string) {
  return /(?:^|[\s،,.])(?:حرام|حلال|محرم|محرّم|مكروه|واجب عليك|يجب عليك|لا يجوز|يجوز لك|فرض عليك|جائز|باطل|فتوى|halal|haram|forbidden|obligatory|impermissible|permissible|invalid marriage|you must)(?=$|[\s،,.؟?!])/i.test(
    text,
  );
}

function cleanId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(id) ? id : null;
}

function looksLikeScripture(text: string) {

  return /﴿|قال الله|قال رسول|صحيح البخاري|صحيح مسلم|رواه |\d+:\d+/.test(text);

}



function asObject(value: unknown) {

  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;

}



function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {

  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : null;

}



function asStringArray(value: unknown): string[] {

  if (!Array.isArray(value)) return typeof value === "string" ? [value] : [];

  return value.filter((item): item is string => typeof item === "string");

}



function clean(value: unknown, max: number) {

  if (typeof value !== "string") return "";

  return value.replace(/\s+/g, " ").trim().slice(0, max);

}



function clampNumber(value: unknown, min: number, max: number, fallback: number) {

  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(number)) return fallback;

  return Math.min(max, Math.max(min, number));

}



/** Re-export for tests */

export { looksLikeScripture, looksLikeRuling };

