/** Canonical JSON shapes. Validation lives in `shared/experience/validate.ts`. */

export const ANALYZE_SCHEMA_HINT = `{
  "context_summary": string,
  "level": "A"|"B"|"C"|"D",
  "safety": "safe"|"unclear"|"refer",
  "input_intent": "EXPERIENCE"|"FEELING"|"SITUATION"|"DIRECT_QUESTION"|"RELIGIOUS_RULING_QUESTION"|"GENERAL_ISLAMIC_LEARNING"|"OUT_OF_SCOPE",
  "recommended_path": "topic_discovery"|"direct_learning"|"referral"|"insufficient",
  "domain": "dawah"|"quran"|"tafseer"|"hadith"|"aqeeda"|"fiqh"|"seerah"|"shubuhat"|"terminology"|null,
  "knowledge_id": string|null,
  "suggested_topics": [{ "id": string, "reason": string }],
  "learning_focus": ("meaning"|"how"|"etiquette"|"virtues"|"fruits"|"evidence"|"types"|"examples")[]
}`;

export const AIResponseSchema = {
  analyze: ANALYZE_SCHEMA_HINT,
} as const;
