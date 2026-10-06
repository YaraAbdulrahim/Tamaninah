import type { ContentLevel } from "../../shared/experience/guidance";

/** Backend guard for personal fatwa / individual worship validity — not prompt-only. */
const levelDPatterns =
  /هل\s+(زواجي|صلاتي|صيامي|حجي|نذري|طلاقي)\s|هل\s+يجب\s+علي|هل\s+يجوز\s+لي|هل\s+صحيح\s+أن\s+أ|في\s+حالتي\s|حالتي\s+الشرع|فتوى|حكم\s+شرعي\s+لي|is my (marriage|prayer|fast|worship) valid|should i (do|break|continue)|in my case.*(halal|haram|valid)/i;

/** Sensitive / disputed matters — escalates to C; not every C case uses referral. */
const levelCPatterns =
  /مسألة\s+خلافية|محل\s+اختلاف|اختلاف\s+العلماء|الفرق\s+بين\s+المذاهب|disputed\s+issue|scholars\s+disagree|controversial\s+in\s+islam|(?:كل|جميع)\s+(?:المسلمين|العلماء|الفقهاء)\s+(?:يتفقون|متفقون|اتفقوا|مجمعون|أجمعوا)|(?:do|does)\s+(?:all|every)\s+(?:muslims?|scholars?)\s+agree|is\s+there\s+(?:a\s+)?consensus/i;

/** Explicit C cases that need a qualified human — not a catch-all for all level C. */
const levelCReferralPatterns =
  /أي\s+مذهب\s+أتبع|أي\s+قول\s+أصح\s+في\s+الخلاف|which\s+madhhab\s+is\s+correct|who\s+is\s+right\s+among\s+scholars|فتاوى\s+متعارضة\s+في\s+حالتي/i;

const LEVEL_RANK: Record<ContentLevel, number> = { A: 0, B: 1, C: 2, D: 3 };

export function detectLevelD(message: string): boolean {
  return levelDPatterns.test(message.trim());
}

export function detectLevelC(message: string): boolean {
  return levelCPatterns.test(message.trim());
}

export function requiresLevelCReferral(message: string): boolean {
  return levelCReferralPatterns.test(message.trim());
}

export function escalateLevel(current: ContentLevel, floor: ContentLevel): ContentLevel {
  return LEVEL_RANK[floor] > LEVEL_RANK[current] ? floor : current;
}

/** Server-side level: never trust the client to downgrade below topic, content, or message guards. */
export function authoritativeJourneyLevel(input: {
  message: string;
  clientLevel: ContentLevel;
  topicLevel: ContentLevel;
  contentLevel: ContentLevel | null;
}): ContentLevel {
  if (detectLevelD(input.message)) return "D";
  let level = input.clientLevel;
  level = escalateLevel(level, input.topicLevel);
  if (input.contentLevel) level = escalateLevel(level, input.contentLevel);
  if (detectLevelC(input.message)) level = escalateLevel(level, "C");
  return level;
}

export function authoritativeAnalyzeLevel(message: string, modelLevel: ContentLevel): ContentLevel {
  if (detectLevelD(message)) return "D";
  let level = modelLevel;
  if (detectLevelC(message)) level = escalateLevel(level, "C");
  return level;
}

export function blocksNormalJourney(level: ContentLevel): boolean {
  return level === "D";
}

export function allowsTopicDiscovery(level: ContentLevel, safety: "safe" | "unclear" | "refer"): boolean {
  if (level === "D" || level === "C" || safety === "refer") return false;
  return true;
}

/** Level B/C journeys require catalog reference metadata — not model prose. */
export function requiresReferenceForLevel(journeyLevel: ContentLevel): boolean {
  return journeyLevel === "B" || journeyLevel === "C";
}

/** Whether a catalog record may be shown for this journey level. */
export function contentPermittedForLevel(recordLevel: ContentLevel, journeyLevel: ContentLevel): boolean {
  if (LEVEL_RANK[recordLevel] > LEVEL_RANK[journeyLevel]) return false;
  if (journeyLevel === "C" && recordLevel !== "C") return false;
  return true;
}

/** Level C journeys need topic and primary content explicitly classified as C in the catalog. */
export function levelCJourneyEligible(topicLevel: ContentLevel, contentLevel: ContentLevel): boolean {
  return topicLevel === "C" && contentLevel === "C";
}
