import type { JourneyBridges, Lang } from "../../shared/experience/guidance";

/**
 * Bridges — short product-copy lines that lead into each part of the journey. Curated per topic
 * (not model-written). Rules: gender-neutral Arabic («يمر بك»), each line only says what the next
 * item is about, no verses, hadith, rulings or claims about the Prophet ﷺ beyond naming the item.
 * The Seerah line is neutral because the scene may be the topic default or a context passage chosen
 * from the person's words; the event label itself is shown on the story card.
 */
type Line = { ar: string; en: string };
type TopicBridgeCopy = { quran: Line; hadith: Line };

const TAFSIR: Line = { ar: "ماذا نفهم من الآية؟", en: "What do we understand from the verse?" };
const SEERAH: Line = { ar: "موقف عاشه النبي ﷺ", en: "A moment the Prophet ﷺ lived through" };
const CONNECT = {
  ar: { title: "ما يمر بك اليوم… ليس خارج الرحلة.", points: ["ما أشعر به", "ما أتعلمه", "ما أستطيع أن أفعله الآن"] },
  en: {
    title: "What you are going through today… is not outside the journey.",
    points: ["What I feel", "What I learn", "What I can do now"],
  },
} as const;

const BY_TOPIC: Record<string, TopicBridgeCopy> = {
  patience: {
    quran: { ar: "آيةٌ عن الصبر وأجره", en: "A verse about patience and its reward" },
    hadith: { ar: "وفي السنة حديثٌ عن الصبر", en: "From the Sunnah, a hadith about patience" },
  },
  grief: {
    quran: { ar: "آيةٌ عمّا يُقال عند المصيبة", en: "A verse about what is said when calamity strikes" },
    hadith: { ar: "وفي السنة حديثٌ عن الحزن ودمع الفراق", en: "From the Sunnah, a hadith about grief and the tears of parting" },
  },
  anxiety: {
    quran: { ar: "شيء من القرآن يلامس ما تعيشه", en: "Something from the Qur'an that touches what you are living" },
    hadith: { ar: "وفي السنة حديثٌ عن الهمّ والحزن", en: "From the Sunnah, a hadith about worry and sorrow" },
  },
  hope: {
    quran: { ar: "آيةٌ عن رحمة الله وألّا نيأس منها", en: "A verse about God's mercy and not losing hope in it" },
    hadith: { ar: "وفي السنة حديثٌ عن حسن الظن بالله", en: "From the Sunnah, a hadith about expecting good from God" },
  },
  tawakkul: {
    quran: { ar: "آيةٌ عن التوكل على الله", en: "A verse about relying on God" },
    hadith: { ar: "وفي السنة حديثٌ عن الذين يتوكلون على ربهم", en: "From the Sunnah, a hadith about those who rely on their Lord" },
  },
  loss: {
    quran: { ar: "آيةٌ عن الابتلاء بالنقص وبشارة الصابرين", en: "A verse about being tested by loss, and glad tidings for the patient" },
    hadith: { ar: "وفي السنة حديثٌ عن فقد من نحب", en: "From the Sunnah, a hadith about losing someone dear" },
  },
  effort: {
    quran: { ar: "آيةٌ عن السعي", en: "A verse about striving" },
    hadith: { ar: "وفي السنة حديثٌ عن الحرص على ما ينفع", en: "From the Sunnah, a hadith about striving for what benefits you" },
  },
  nearness: {
    quran: { ar: "آيةٌ عن قرب الله ممن يدعوه", en: "A verse about God's nearness to whoever calls on Him" },
    hadith: { ar: "وفي السنة حديثٌ عن القرب من الله في السجود", en: "From the Sunnah, a hadith about nearness to God in prostration" },
  },
  amanah: {
    quran: { ar: "آيةٌ عن حفظ الأمانات والعهود", en: "A verse about keeping trusts and promises" },
    hadith: { ar: "وفي السنة حديثٌ عن المسؤولية", en: "From the Sunnah, a hadith about responsibility" },
  },
  gratitude: {
    quran: { ar: "آيةٌ عن الشكر", en: "A verse about gratitude" },
    hadith: { ar: "وفي السنة حديثٌ عن الشكر عند الخير", en: "From the Sunnah, a hadith about giving thanks when good comes" },
  },
};

const GENERIC: TopicBridgeCopy = {
  quran: { ar: "شيء من القرآن يلامس ما تعيشه", en: "Something from the Qur'an that touches what you are living" },
  hadith: { ar: "وفي السنة حديثٌ متصل بما يمر بك", en: "From the Sunnah, a hadith connected to what you are going through" },
};

export function topicBridges(topicId: string, lang: Lang): Required<JourneyBridges> {
  const copy = BY_TOPIC[topicId] ?? GENERIC;
  const l = lang === "en" ? "en" : "ar";
  const connect = CONNECT[l];
  return {
    quran: copy.quran[l],
    tafsir: TAFSIR[l],
    hadith: copy.hadith[l],
    seerah: SEERAH[l],
    connect: { title: connect.title, points: [connect.points[0], connect.points[1], connect.points[2]] },
  };
}

/** Topics with curated (non-generic) bridges — for tests. */
export const BRIDGED_TOPIC_IDS = Object.keys(BY_TOPIC);
