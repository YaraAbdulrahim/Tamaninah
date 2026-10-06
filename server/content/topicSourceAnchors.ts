/**
 * Topic → tafsir excerpt and Sahihayn hadith anchors.
 *
 * Nothing here is displayed. Each anchor names *where* the text lives in an approved source and
 * gives two short locators (copied from the fetched page, matched without tashkeel) marking the
 * first and last words of the excerpt. `server/scripts/snapshotContent.ts` fetches the page,
 * slices the excerpt between the locators verbatim, fetches it a second time to confirm, and writes
 * the committed snapshots (snapshots/tafsir.published.json, snapshots/hadith.published.json).
 * If a locator stops matching, the item is dropped — it is never retyped by hand.
 *
 * Tafsir: «جامع البيان في تأويل آي القرآن» of Ibn Jarir al-Tabari (224–310 AH; the PDF's tafseer
 * row admits sources of the first three centuries), served by the Quranpedia API (book 4, ed.
 * Ahmad Shakir, Mu'assasat al-Risala 1420 AH). Every excerpt is Tabari's own gloss (or a report he
 * cites) on the topic's *exact* anchor verse, 1–3 paragraphs, cut at sentence boundaries.
 *
 * Hadith: Sahih al-Bukhari (Shamela 1681, al-Sultaniyya) and Sahih Muslim (Shamela 1727, ed.
 * Muhammad Fu'ad 'Abd al-Baqi). Grade «صحيح» rests on the PDF's hadith rule («الأحاديث الصحيحة من
 * الصحيحين»). Text starts at the Companion as printed (isnad above him omitted, never altered) and
 * ends with the matn.
 */
import { getTopicQuranAnchor } from "./topicQuranAnchors";

export const TAFSIR_TABARI_BOOK_ID = 4;

export type TopicTafsirAnchor = {
  topicId: string;
  contentId: string;
  surah: number;
  ayah: number;
  bookId: number;
  /** Ayat whose book pages must be fetched (the gloss may continue on a page Quranpedia files under the next ayah). */
  fetchAyat: readonly [number, number][];
  startLocator: string;
  endLocator: string;
  /**
   * Presentation: where the opening shown before «عرض التفسير كاملًا» ends (a sentence end inside
   * the excerpt). Absent → the excerpt's own end (one-sentence excerpts).
   */
  leadEnd?: string;
  /** Why this passage — editorial note, not shown. */
  rationale: string;
};

export type HadithCollectionKey = "bukhari" | "muslim";

export type TopicHadithSourceAnchor = {
  topicId: string;
  contentId: string;
  collection: HadithCollectionKey;
  /** Hadith number as printed (Bukhari: Fath al-Bari / ʿAbd al-Baqi numbering; Muslim: ʿAbd al-Baqi). */
  number: number;
  /** Shamela page id the number resolves to (ajax/specialnumber2id), pinned so drift is detected. */
  shamelaPageId: number;
  startLocator: string;
  endLocator: string;
  /** Presentation: the contiguous phrase that carries the meaning (locators; exact slice at load). */
  highlight?: { start: string; end: string };
  rationale: string;
};

export const TOPIC_TAFSIR_ANCHORS: readonly TopicTafsirAnchor[] = [
  {
    topicId: "patience",
    contentId: "tafsir-tabari-39-10",
    surah: 39,
    ayah: 10,
    bookId: TAFSIR_TABARI_BOOK_ID,
    fetchAyat: [[39, 10]],
    startLocator: "وقوله: (إنما يوفى الصابرون أجرهم بغير حساب) يقول تعالى ذكره:",
    endLocator: "ثوابهم بغير حساب.",
    rationale: "Tabari's gloss of the verse's closing clause: the reward of those who were patient, without reckoning.",
  },
  {
    topicId: "hope",
    contentId: "tafsir-tabari-39-53",
    surah: 39,
    ayah: 53,
    bookId: TAFSIR_TABARI_BOOK_ID,
    fetchAyat: [[39, 53]],
    startLocator: "وأولى الأقوال في ذلك بالصواب قول من قال: عنى تعالى ذكره بذلك جميع من أسرف",
    endLocator: "فلم يخصص به مسرفا دون مسرف.",
    rationale: "Tabari's preferred reading: the call not to despair addresses every one who wronged himself.",
  },
  {
    topicId: "anxiety",
    contentId: "tafsir-tabari-2-286",
    surah: 2,
    ayah: 286,
    bookId: TAFSIR_TABARI_BOOK_ID,
    fetchAyat: [[2, 286]],
    startLocator: "قال أبو جعفر: فتأويل الآية إذا: لا يكلف الله نفسا إلا ما يسعها",
    endLocator: "ولا بخطرة إن خطرت بقلبها.",
    rationale: "Tabari's summary of the verse: no soul is held to more than it can bear, nor to passing thoughts.",
  },
  {
    topicId: "tawakkul",
    contentId: "tafsir-tabari-65-3",
    surah: 65,
    ayah: 3,
    bookId: TAFSIR_TABARI_BOOK_ID,
    fetchAyat: [[65, 3]],
    startLocator: "وقوله: (ومن يتوكل على الله فهو حسبه)",
    endLocator: "توكل عليه العبد أو لم يتوكل عليه.",
    leadEnd: "فهو كافيه.",
    rationale: "Tabari's gloss of the reliance clause: God suffices whoever entrusts his affairs to Him.",
  },
  {
    topicId: "grief",
    contentId: "tafsir-tabari-2-156",
    surah: 2,
    ayah: 156,
    bookId: TAFSIR_TABARI_BOOK_ID,
    fetchAyat: [
      [2, 156],
      [2, 157],
    ],
    startLocator: "قال أبو جعفر: يعني تعالى ذكره: وبشر، يا محمد، الصابرين الذين يعلمون",
    endLocator: "تسليما لقضائي ورضا بأحكامي.",
    rationale: "Tabari's gloss of what the patient say at a calamity; the paragraph runs onto the page Quranpedia files under 2:157.",
  },
  {
    topicId: "loss",
    contentId: "tafsir-tabari-2-155",
    surah: 2,
    ayah: 155,
    bookId: TAFSIR_TABARI_BOOK_ID,
    fetchAyat: [[2, 155]],
    startLocator: "عن ابن عباس قوله:\"ولنبلونكم بشيء من الخوف والجوع\"، ونحو هذا، قال:",
    endLocator: "(مستهم البأساء والضراء وزلزلوا).",
    rationale: "The report Tabari cites from Ibn 'Abbas: God told the believers this world is a place of trial and gave glad tidings to the patient.",
  },
  {
    topicId: "effort",
    contentId: "tafsir-tabari-53-39",
    surah: 53,
    ayah: 39,
    bookId: TAFSIR_TABARI_BOOK_ID,
    fetchAyat: [[53, 39]],
    startLocator: "وإنما عني بقوله (ألا تزر وازرة وزر أخرى)",
    endLocator: "خيرا كان ذلك أو شرا.",
    rationale: "Tabari's gloss of the verse: each person is recompensed only by his own deeds.",
  },
  {
    topicId: "nearness",
    contentId: "tafsir-tabari-2-186",
    surah: 2,
    ayah: 186,
    bookId: TAFSIR_TABARI_BOOK_ID,
    fetchAyat: [[2, 186]],
    startLocator: "قال أبو جعفر: يعني تعالى ذكره: بذلك وإذا سألك يا محمد عبادي عني",
    endLocator: "وأجيب دعوة الداعي منهم.",
    rationale: "Tabari's opening gloss of the verse: God is near, hears their prayer and answers it.",
  },
  {
    topicId: "amanah",
    contentId: "tafsir-tabari-23-8",
    surah: 23,
    ayah: 8,
    bookId: TAFSIR_TABARI_BOOK_ID,
    fetchAyat: [[23, 8]],
    startLocator: "يقول تعالى ذكره: (والذين هم لأماناتهم) التي ائتمنوا عليها",
    endLocator: "ولكنهم يوفون بذلك كله.",
    rationale: "Tabari's gloss of the verse: they keep what was entrusted to them and their pledges.",
  },
  {
    topicId: "gratitude",
    contentId: "tafsir-tabari-14-7",
    surah: 14,
    ayah: 7,
    bookId: TAFSIR_TABARI_BOOK_ID,
    fetchAyat: [[14, 7]],
    startLocator: "وقوله: (لئن شكرتم لأزيدنكم)، يقول: لئن شكرتم ربكم",
    endLocator: "والخلاص من عذابهم.",
    rationale: "Tabari's gloss of the promise: thank your Lord and He will increase His favours upon you.",
  },
] as const;

export const TOPIC_HADITH_SOURCE_ANCHORS: readonly TopicHadithSourceAnchor[] = [
  {
    topicId: "patience",
    contentId: "hadith-bukhari-1469",
    collection: "bukhari",
    number: 1469,
    shamelaPageId: 2367,
    startLocator: "عن أبي سعيد الخدري",
    endLocator: "خيرا وأوسع من الصبر.»",
    highlight: { start: "ومن يتصبر", end: "من الصبر" },
    rationale: "Whoever strives to be patient is given patience; no gift is better or wider than patience (Kitab al-Zakat).",
  },
  {
    topicId: "grief",
    contentId: "hadith-bukhari-1303",
    collection: "bukhari",
    number: 1303,
    shamelaPageId: 2100,
    startLocator: "عن أنس بن مالك",
    endLocator: "يا إبراهيم لمحزونون.»",
    highlight: { start: "إن العين تدمع", end: "ما يرضى ربنا" },
    rationale: "The Prophet weeping at his son Ibrahim's death; grief of the heart without words that displease God (Kitab al-Jana'iz).",
  },
  {
    topicId: "loss",
    contentId: "hadith-bukhari-6424",
    collection: "bukhari",
    number: 6424,
    shamelaPageId: 9642,
    startLocator: "عن أبي هريرة أن رسول الله",
    endLocator: "إلا الجنة.»",
    highlight: { start: "ما لعبدي المؤمن", end: "إلا الجنة" },
    rationale: "Hadith qudsi on the believer who loses a loved one and bears it for God's sake.",
  },
  {
    topicId: "anxiety",
    contentId: "hadith-bukhari-5641",
    collection: "bukhari",
    number: 5641,
    shamelaPageId: 8439,
    startLocator: "عن أبي سعيد الخدري وعن أبي هريرة",
    endLocator: "من خطاياه.»",
    highlight: { start: "ما يصيب المسلم", end: "من خطاياه" },
    rationale: "No worry (hamm), grief or distress afflicts a Muslim without God expiating sins by it.",
  },
  {
    topicId: "hope",
    contentId: "hadith-bukhari-7405",
    collection: "bukhari",
    number: 7405,
    shamelaPageId: 11009,
    startLocator: "عن أبي هريرة",
    endLocator: "أتيته هرولة.»",
    highlight: { start: "أنا عند ظن عبدي بي", end: "وأنا معه إذا ذكرني" },
    rationale: "Hadith qudsi: God is as His servant expects Him to be, and draws nearer to whoever draws near (Kitab al-Tawhid).",
  },
  {
    topicId: "tawakkul",
    contentId: "hadith-bukhari-6472",
    collection: "bukhari",
    number: 6472,
    shamelaPageId: 9705,
    startLocator: "عن ابن عباس أن رسول الله",
    endLocator: "وعلى ربهم يتوكلون.»",
    highlight: { start: "يدخل الجنة من أمتي", end: "وعلى ربهم يتوكلون" },
    rationale: "Placed by al-Bukhari under the chapter titled with 65:3 itself (Kitab al-Riqaq); those who rely on their Lord.",
  },
  {
    topicId: "amanah",
    contentId: "hadith-bukhari-2554",
    collection: "bukhari",
    number: 2554,
    shamelaPageId: 4056,
    startLocator: "عن عبد الله",
    endLocator: "وكلكم مسؤول عن رعيته.»",
    highlight: { start: "كلكم راع فمسؤول", end: "عن رعيته" },
    rationale: "Everyone is a guardian answerable for what was entrusted to him; echoes the guarding of trusts in 23:8 (Kitab al-'Itq).",
  },
  {
    topicId: "nearness",
    contentId: "hadith-muslim-482",
    collection: "muslim",
    number: 482,
    shamelaPageId: 1030,
    startLocator: "عن أبي هريرة؛ أن رسول الله",
    endLocator: "فأكثروا الدعاء\".",
    highlight: { start: "أقرب ما يكون العبد", end: "فأكثروا الدعاء" },
    rationale: "The nearest a servant is to his Lord is in prostration, so supplicate much (Kitab al-Salah).",
  },
  {
    topicId: "effort",
    contentId: "hadith-muslim-2664",
    collection: "muslim",
    number: 2664,
    shamelaPageId: 6709,
    startLocator: "عن أبي هريرة، قال:",
    endLocator: "تفتح عمل الشيطان\".",
    highlight: { start: "احرص على ما ينفعك", end: "ولا تعجز" },
    rationale: "Strive for what benefits you, seek God's help and do not give up (Kitab al-Qadar).",
  },
  {
    topicId: "gratitude",
    contentId: "hadith-muslim-2999",
    collection: "muslim",
    number: 2999,
    shamelaPageId: 7432,
    startLocator: "عن صهيب، قال:",
    endLocator: "صبر. فكان خيرا له\".",
    highlight: { start: "إن أصابته سراء شكر", end: "فكان خيرا له" },
    rationale: "The believer's affair is all good: when good fortune comes he gives thanks, and that is good for him (Kitab al-Zuhd).",
  },
] as const;

export function getTopicTafsirAnchor(topicId: string): TopicTafsirAnchor | null {
  return TOPIC_TAFSIR_ANCHORS.find((a) => a.topicId === topicId) ?? null;
}

export function getTafsirAnchorByContentId(contentId: string): TopicTafsirAnchor | null {
  return TOPIC_TAFSIR_ANCHORS.find((a) => a.contentId === contentId) ?? null;
}

export function getTopicHadithSourceAnchor(topicId: string): TopicHadithSourceAnchor | null {
  return TOPIC_HADITH_SOURCE_ANCHORS.find((a) => a.topicId === topicId) ?? null;
}

export function getHadithSourceAnchorByContentId(contentId: string): TopicHadithSourceAnchor | null {
  return TOPIC_HADITH_SOURCE_ANCHORS.find((a) => a.contentId === contentId) ?? null;
}

/** A tafsir anchor must explain the very verse the topic's Quran slot shows. */
export function tafsirMatchesQuranAnchor(anchor: TopicTafsirAnchor): boolean {
  const quran = getTopicQuranAnchor(anchor.topicId);
  return Boolean(quran && quran.surah === anchor.surah && quran.ayah === anchor.ayah);
}
