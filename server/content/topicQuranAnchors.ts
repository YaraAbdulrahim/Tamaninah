/**
 * Topic → Quran reference anchors (catalog contentId + surah:ayah).
 * Live ingest uses these; no per-topic hard-coded fetch branches.
 *
 * Only the *reference* is chosen here. The verse text and its English translation always come
 * from the Quranpedia API (npm run snapshot:quran → snapshots/quran.published.json); nothing in
 * this file is displayed as scripture.
 *
 * Selection rationale (one anchor per topic; the verse's own wording names the topic plainly —
 * descriptions below are editorial English notes, the Arabic is only ever the fetched text):
 * - patience 39:10 — the patient are paid their reward without measure.
 * - hope     39:53 — the explicit command not to despair of God's mercy.
 * - anxiety  2:286 — God does not burden a soul beyond its capacity.
 * - tawakkul 65:3  — whoever relies on God, He suffices him (al-Bukhari titles a chapter with it).
 * - grief    2:156 — what the patient say when a calamity strikes them.
 * - loss     2:155 — the test by fear, hunger and loss of wealth, lives and fruits (2:156 is
 *   already grief's anchor and content ids must stay unique per topic).
 * - effort   53:39 — a person has nothing but what he strives for.
 * - nearness 2:186 — when My servants ask about Me, I am near.
 * - amanah   23:8  — those who guard their trusts and their pledges.
 * - gratitude 14:7 — if you give thanks, I will surely increase you.
 */
export type TopicQuranAnchor = {
  topicId: string;
  contentId: string;
  surah: number;
  ayah: number;
  mushafId: number;
  /** Display surah label — not religious commentary. */
  placeAr: string;
  placeEn: string;
  /**
   * Presentation: the clause most tied to the topic, as start/end locators (matched without
   * tashkeel). The shown value is the exact slice of the fetched verse, computed at load.
   */
  highlight?: { start: string; end: string };
};

export const LIVE_TOPIC_QURAN_ANCHORS: readonly TopicQuranAnchor[] = [
  {
    topicId: "patience",
    contentId: "quran-zumar-10",
    surah: 39,
    ayah: 10,
    mushafId: 1,
    placeAr: "سورة الزمر",
    placeEn: "Surah Az-Zumar",
    highlight: { start: "إنما يوفى الصابرون", end: "بغير حساب" },
  },
  {
    topicId: "hope",
    contentId: "quran-zumar-53",
    surah: 39,
    ayah: 53,
    mushafId: 1,
    placeAr: "سورة الزمر",
    placeEn: "Surah Az-Zumar",
    highlight: { start: "لا تقنطوا", end: "من رحمة الله" },
  },
  {
    topicId: "anxiety",
    contentId: "quran-baqarah-286",
    surah: 2,
    ayah: 286,
    mushafId: 1,
    placeAr: "سورة البقرة",
    placeEn: "Surah Al-Baqarah",
    highlight: { start: "لا يكلف الله نفسا", end: "إلا وسعها" },
  },
  {
    topicId: "tawakkul",
    contentId: "quran-talaq-3",
    surah: 65,
    ayah: 3,
    mushafId: 1,
    placeAr: "سورة الطلاق",
    placeEn: "Surah At-Talaq",
    highlight: { start: "ومن يتوكل على الله", end: "فهو حسبه" },
  },
  {
    topicId: "grief",
    contentId: "quran-baqarah-156",
    surah: 2,
    ayah: 156,
    mushafId: 1,
    placeAr: "سورة البقرة",
    placeEn: "Surah Al-Baqarah",
    highlight: { start: "إنا لله", end: "راجعون" },
  },
  {
    topicId: "loss",
    contentId: "quran-baqarah-155",
    surah: 2,
    ayah: 155,
    mushafId: 1,
    placeAr: "سورة البقرة",
    placeEn: "Surah Al-Baqarah",
    highlight: { start: "ونقص من الأموال", end: "وبشر الصابرين" },
  },
  {
    topicId: "effort",
    contentId: "quran-najm-39",
    surah: 53,
    ayah: 39,
    mushafId: 1,
    placeAr: "سورة النجم",
    placeEn: "Surah An-Najm",
    highlight: { start: "ليس للإنسان", end: "ما سعى" },
  },
  {
    topicId: "nearness",
    contentId: "quran-baqarah-186",
    surah: 2,
    ayah: 186,
    mushafId: 1,
    placeAr: "سورة البقرة",
    placeEn: "Surah Al-Baqarah",
    highlight: { start: "فإني قريب", end: "إذا دعان" },
  },
  {
    topicId: "amanah",
    contentId: "quran-muminun-8",
    surah: 23,
    ayah: 8,
    mushafId: 1,
    placeAr: "سورة المؤمنون",
    placeEn: "Surah Al-Mu'minun",
    highlight: { start: "لأماناتهم", end: "راعون" },
  },
  {
    topicId: "gratitude",
    contentId: "quran-ibrahim-7",
    surah: 14,
    ayah: 7,
    mushafId: 1,
    placeAr: "سورة إبراهيم",
    placeEn: "Surah Ibrahim",
    highlight: { start: "لئن شكرتم", end: "لأزيدنكم" },
  },
] as const;

export function getTopicQuranAnchor(topicId: string): TopicQuranAnchor | null {
  return LIVE_TOPIC_QURAN_ANCHORS.find((a) => a.topicId === topicId) ?? null;
}

export function getTopicQuranAnchorByContentId(contentId: string): TopicQuranAnchor | null {
  return LIVE_TOPIC_QURAN_ANCHORS.find((a) => a.contentId === contentId) ?? null;
}
