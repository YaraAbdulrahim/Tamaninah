/**
 * Topic → «موقف من السيرة» (story slot) anchors.
 *
 * Nothing here is displayed except `title` / `titleEn`: a short neutral label naming the event
 * (not religious text). The passage itself is only ever the text fetched from the approved page by
 * `server/scripts/snapshotContent.ts` between the two locators (matched without tashkeel) and
 * stored in snapshots/seerah.published.json. If a locator stops matching, the story is dropped.
 *
 * Sources (sources.pdf «السيرة والتاريخ»: sources of the first three centuries):
 *   - Sahih al-Bukhari (Shamela 1681) — narrations of Seerah events; graded by being in the Sahihayn.
 *   - Sirat Ibn Hisham (Shamela 23833, ed. al-Saqqa / al-Abyari / Shalabi) — a Seerah book; no hadith
 *     grade is asserted or shown for its passages.
 * Selection rule: an event whose link to the topic is explicit in the passage itself; prose only
 * (no poetry), no footnote markers, sentence boundaries, 1 paragraph.
 *
 * Each topic has one `default` passage and may have `context` passages with routing `tags` (plain
 * keywords, routing metadata only — never shown). At journey time the person's own words pick the
 * best-matching context passage deterministically (storySelection.ts), else the default.
 * `beatStarts` / `keyQuotes` are presentation locators: the beats and quotes shown are exact slices
 * of the stored passage, computed at load (presentation.ts); a locator that stops fitting drops the
 * field, never the story.
 */
export type SeerahSourceKey = "bukhari" | "ibn_hisham";

export type TopicSeerahAnchor = {
  topicId: string;
  storyId: string;
  source: SeerahSourceKey;
  /** Bukhari: hadith number (resolved to a page via ajax/specialnumber2id). */
  number?: number;
  /** Shamela page id, pinned so drift is detected. */
  shamelaPageId: number;
  /** Neutral event labels (Arabic / English) — not quotations. */
  title: string;
  titleEn: string;
  startLocator: string;
  endLocator: string;
  /** "default" = the topic's Seerah scene; "context" = chosen only when the person's words match `tags`. */
  role: "default" | "context";
  /** Routing keywords (Arabic, normalized at match time; English lower-case). Context passages only. */
  tags?: readonly string[];
  /** Presentation: where beats 2..n begin (2–4 beats in all). */
  beatStarts?: readonly string[];
  /** Presentation: up to two phrases to light up. */
  keyQuotes?: readonly { start: string; end: string }[];
  /** Why this event fits the topic — editorial note, never shown. */
  rationale: string;
};

export const TOPIC_SEERAH_ANCHORS: readonly TopicSeerahAnchor[] = [
  {
    topicId: "patience",
    storyId: "seerah-bukhari-1283",
    source: "bukhari",
    number: 1283,
    shamelaPageId: 2071,
    title: "موقف عند المقابر",
    titleEn: "At the graveyard",
    startLocator: "عن أنس بن مالك",
    endLocator: "عند الصدمة الأولى.»",
    role: "default",
    beatStarts: ["قالت: إليك عني", "ولم تعرفه", "فقال: إنما الصبر"],
    keyQuotes: [{ start: "اتقي الله", end: "واصبري" }, { start: "إنما الصبر", end: "الصدمة الأولى" }],
    rationale:
      "The Prophet tells a grieving woman to be patient; patience is named in the passage itself (Kitab al-Jana'iz).",
  },
  {
    topicId: "hope",
    storyId: "seerah-bukhari-3231",
    source: "bukhari",
    number: 3231,
    shamelaPageId: 5079,
    title: "يوم الطائف",
    titleEn: "The day of al-Ta'if",
    startLocator: "أن عائشة",
    endLocator: "لا يشرك به شيئا.»",
    role: "default",
    beatStarts: ["قال: لقد لقيت من قومك", "فرفعت رأسي", "فقال النبي"],
    keyQuotes: [{ start: "وأنا مهموم", end: "على وجهي" }, { start: "بل أرجو", end: "لا يشرك به شيئا" }],
    rationale:
      "His hardest day (rejected at al-Ta'if); offered the destruction of his rejecters, he answers with hope for their descendants.",
  },
  {
    topicId: "anxiety",
    storyId: "seerah-bukhari-3-fear",
    source: "bukhari",
    number: 3,
    shamelaPageId: 12,
    title: "أول نزول الوحي",
    titleEn: "The first revelation",
    startLocator: "فرجع بها رسول الله",
    endLocator: "وتعين على نوائب الحق.",
    role: "default",
    beatStarts: ["فقال لخديجة", "فقالت خديجة"],
    keyQuotes: [{ start: "لقد خشيت", end: "على نفسي" }, { start: "كلا والله", end: "ما يخزيك الله أبدا" }],
    rationale:
      "He returns trembling and afraid for himself; Khadija calms him. Fear and reassurance are explicit in the passage.",
  },
  {
    topicId: "tawakkul",
    storyId: "seerah-bukhari-4563",
    source: "bukhari",
    number: 4563,
    shamelaPageId: 6669,
    title: "حين خُوِّف المسلمون بالجموع",
    titleEn: "When the believers were warned of the gathered army",
    startLocator: "عن ابن عباس",
    endLocator: "ونعم الوكيل﴾».",
    role: "default",
    beatStarts: ["وقالها محمد"],
    keyQuotes: [{ start: "حسبنا الله", end: "ونعم الوكيل" }, { start: "وقالها محمد", end: "حين قالوا" }],
    rationale:
      "Ibn 'Abbas reports the Prophet's words of reliance on God when told an army had gathered against them (Kitab al-Tafsir).",
  },
  {
    topicId: "nearness",
    storyId: "seerah-bukhari-3653",
    source: "bukhari",
    number: 3653,
    shamelaPageId: 5576,
    title: "في الغار ليلة الهجرة",
    titleEn: "In the cave during the Hijra",
    startLocator: "عن أبي بكر",
    endLocator: "باثنين الله ثالثهما.»",
    role: "default",
    beatStarts: ["فقال: ما ظنك"],
    keyQuotes: [{ start: "ما ظنك يا أبا بكر", end: "الله ثالثهما" }],
    rationale: "Hidden in the cave, the Prophet reminds Abu Bakr that God is with them — God's closeness in a moment of danger.",
  },
  {
    topicId: "grief",
    storyId: "seerah-bukhari-4262",
    source: "bukhari",
    number: 4262,
    shamelaPageId: 6280,
    title: "نعي أمراء مؤتة",
    titleEn: "News of the commanders at Mu'tah",
    startLocator: "عن أنس",
    endLocator: "حتى فتح الله عليهم».",
    role: "default",
    beatStarts: ["فقال: أخذ الراية", "وعيناه تذرفان"],
    keyQuotes: [{ start: "وعيناه تذرفان", end: "وعيناه تذرفان" }],
    rationale: "He announces the deaths of Zayd, Ja'far and Ibn Rawaha with his eyes streaming — grief shown openly (Kitab al-Maghazi).",
  },
  {
    topicId: "loss",
    storyId: "seerah-ibn-hisham-1-416",
    source: "ibn_hisham",
    shamelaPageId: 439,
    title: "وفاة خديجة وأبي طالب",
    titleEn: "The deaths of Khadija and Abu Talib",
    startLocator: "قال ابن إسحاق: ثم إن خديجة بنت خويلد",
    endLocator: "إلى المدينة بثلاث سنين.",
    role: "default",
    beatStarts: ["فتتابعت", "وبهلك عمه", "وذلك قبل مهاجره"],
    keyQuotes: [{ start: "فتتابعت على رسول الله", end: "المصائب" }],
    rationale: "Losing in one year his wife and confidante and his uncle and protector; the passage names the successive calamities.",
  },
  {
    topicId: "effort",
    storyId: "seerah-ibn-hisham-2-216",
    source: "ibn_hisham",
    shamelaPageId: 953,
    title: "حفر الخندق",
    titleEn: "Digging the trench",
    startLocator: "فلما سمع بهم رسول الله",
    endLocator: "فدأب فيه ودأبوا.",
    role: "default",
    beatStarts: ["فعمل فيه رسول الله", "وعمل معه المسلمون"],
    keyQuotes: [{ start: "فعمل فيه رسول الله", end: "في الأجر" }, { start: "فدأب فيه", end: "ودأبوا" }],
    rationale: "The Prophet digs the trench with his companions, toiling with them — effort named in the passage.",
  },
  {
    topicId: "amanah",
    storyId: "seerah-ibn-hisham-1-485",
    source: "ibn_hisham",
    shamelaPageId: 508,
    title: "عليٌّ يؤدّي الودائع",
    titleEn: "'Ali returns the deposits",
    startLocator: "قال ابن إسحاق: ولم يعلم فيما بلغني",
    endLocator: "من صدقه وأمانته صلى الله عليه وسلم.",
    role: "default",
    beatStarts: ["أما علي فإن", "وكان رسول الله"],
    keyQuotes: [{ start: "لما يعلم من صدقه", end: "وأمانته" }],
    rationale:
      "At the Hijra the Prophet leaves 'Ali behind to return what people had entrusted to him, for his known honesty and trustworthiness.",
  },
  {
    topicId: "gratitude",
    storyId: "seerah-bukhari-4837",
    source: "bukhari",
    number: 4837,
    shamelaPageId: 7155,
    title: "قيام النبي ﷺ من الليل",
    titleEn: "The Prophet's night prayer",
    startLocator: "عن عائشة",
    endLocator: "قام فقرأ ثم ركع».",
    role: "default",
    beatStarts: ["فقالت عائشة", "قال: أفلا أحب", "فلما كثر لحمه"],
    keyQuotes: [{ start: "أفلا أحب", end: "عبدا شكورا" }],
    rationale: "Asked why he prays so long though forgiven, he answers that he loves to be a grateful servant — gratitude named in the passage.",
  },
  // ── context passages: chosen only when the person's words match the tags ──
  {
    topicId: "anxiety",
    storyId: "seerah-bukhari-2916",
    source: "bukhari",
    number: 2916,
    shamelaPageId: 4626,
    title: "حين رهن النبي ﷺ درعه",
    titleEn: "When the Prophet pawned his armour",
    startLocator: "عن عائشة",
    endLocator: "من شعير»",
    role: "context",
    tags: ["ديون", "مديون", "مديونه", "مديونيه", "قرض", "قروض", "سلفه", "اقساط", "قسط", "فلوس", "مال", "فقر", "رزق", "ايجار", "رهن", "debt", "loan", "money", "rent", "broke", "mortgage"],
    beatStarts: ["ودرعه مرهونة"],
    keyQuotes: [{ start: "ودرعه مرهونة", end: "من شعير" }],
    rationale:
      "Money worry and debt: the Prophet died with his armour pawned for barley (Kitab al-Jihad). Bare «دين» is not a tag — unvocalized it also means religion.",
  },
  {
    topicId: "patience",
    storyId: "seerah-bukhari-5648",
    source: "bukhari",
    number: 5648,
    shamelaPageId: 8447,
    title: "حين اشتدّ المرض على النبي ﷺ",
    titleEn: "When the Prophet was gravely ill",
    startLocator: "عن عبد الله قال",
    endLocator: "الشجرة ورقها.»",
    role: "context",
    tags: ["مرض", "مريض", "مريضه", "مرضت", "وجع", "اوجاع", "الم", "الام", "حمى", "مستشفى", "علاج", "سرطان", "كيماوي", "sick", "illness", "ill", "pain", "fever", "hospital", "disease", "cancer"],
    beatStarts: ["قال: أجل إني", "قلت: ذلك أن لك", "قال أجل، ذلك كذلك"],
    keyQuotes: [{ start: "إني أوعك", end: "رجلان منكم" }, { start: "كما تحط الشجرة", end: "ورقها" }],
    rationale: "Illness: the Prophet himself suffered severe fever and spoke of its reward (Kitab al-Marda).",
  },
  {
    topicId: "grief",
    storyId: "seerah-bukhari-1284",
    source: "bukhari",
    number: 1284,
    shamelaPageId: 2073,
    title: "حين احتُضر حفيد النبي ﷺ",
    titleEn: "When the Prophet's grandson lay dying",
    startLocator: "أسامة بن زيد",
    endLocator: "الرحماء.»",
    role: "context",
    tags: ["طفل", "طفلي", "طفلتي", "اطفال", "ابني", "ابنتي", "بنتي", "ولدي", "رضيع", "جنين", "اجهاض", "مولود", "child", "son", "daughter", "baby", "miscarriage", "infant"],
    beatStarts: ["فأرسلت إليه تقسم", "ففاضت عيناه", "فقال: هذه رحمة"],
    keyQuotes: [{ start: "إن لله ما أخذ", end: "وله ما أعطى" }, { start: "هذه رحمة", end: "في قلوب عباده" }],
    rationale: "Losing a child: the Prophet's tears over his daughter's dying son (Kitab al-Jana'iz).",
  },
  {
    topicId: "effort",
    storyId: "seerah-bukhari-2262",
    source: "bukhari",
    number: 2262,
    shamelaPageId: 3586,
    title: "النبي ﷺ يرعى الغنم بأجر",
    titleEn: "The Prophet tending sheep for wages",
    startLocator: "عن أبي هريرة",
    endLocator: "لأهل مكة.»",
    role: "context",
    tags: ["عمل", "شغل", "وظيفه", "دوام", "راتب", "مهنه", "مدير", "مديري", "اشتغل", "job", "work", "salary", "career", "boss", "wage"],
    beatStarts: ["فقال أصحابه", "فقال: نعم"],
    keyQuotes: [{ start: "كنت أرعاها", end: "لأهل مكة" }],
    rationale: "Work and earning a living: the Prophet herded sheep for the people of Makkah for wages (Kitab al-Ijarah).",
  },
  {
    topicId: "loss",
    storyId: "seerah-bukhari-5416",
    source: "bukhari",
    number: 5416,
    shamelaPageId: 8092,
    title: "ضيق العيش في بيت النبي ﷺ",
    titleEn: "Scarcity in the Prophet's household",
    startLocator: "عن عائشة",
    endLocator: "حتى قبض.»",
    role: "context",
    tags: ["فقر", "فلوس", "مال", "خساره", "خسرت", "خسران", "افلاس", "مفلس", "جوع", "رزق", "money", "poverty", "poor", "broke", "bankrupt", "hungry"],
    beatStarts: ["منذ قدم المدينة"],
    keyQuotes: [{ start: "ما شبع آل محمد", end: "ثلاث ليال تباعا" }],
    rationale: "Financial loss and hardship: the Prophet's family rarely had their fill (Kitab al-At'imah).",
  },
] as const;

/** The topic's default Seerah scene. */
export function getTopicSeerahAnchor(topicId: string): TopicSeerahAnchor | null {
  return TOPIC_SEERAH_ANCHORS.find((a) => a.topicId === topicId && a.role === "default") ?? null;
}

/** Every Seerah passage for the topic (default first, then context passages). */
export function listTopicSeerahAnchors(topicId: string): TopicSeerahAnchor[] {
  return TOPIC_SEERAH_ANCHORS.filter((a) => a.topicId === topicId).sort(
    (a, b) => Number(a.role === "context") - Number(b.role === "context"),
  );
}

export function getSeerahAnchorByStoryId(storyId: string): TopicSeerahAnchor | null {
  return TOPIC_SEERAH_ANCHORS.find((a) => a.storyId === storyId) ?? null;
}
