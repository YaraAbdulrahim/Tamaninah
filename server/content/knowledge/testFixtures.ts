/**
 * TEST FIXTURES ONLY — small knowledge data in the curator's schema so engine/route tests do not
 * depend on the curated files. Glossary and rule strings are copied from sources.pdf; Bayyinat
 * questions are real index questions; every Bayyinat *excerpt* here is a synthetic marker string,
 * never religious content.
 */
import { createKnowledgeBase, type KnowledgeBase } from "./knowledgeBase";
import type { KnowledgeSourceData } from "./knowledgeTypes";

export const FIXTURE_EXCERPT = "[FIXTURE] مقتطف اختبار — ليس نصًا من الكتاب";

export const knowledgeFixtureData: KnowledgeSourceData = {
  referenceTitleAr: "المرجعية والحزمة العلمية والبيانات",
  levels: [{ level: "A", name_ar: "معلومات أصلية مستقرة" }],
  scope: { excluded_ar: "إصدار الفتوى الشخصية المستقلة" },
  approvedSources: [
    {
      domain: "dawah",
      label_ar: "الموضوعات الدعوية والمحتوى الإسلامي",
      label_en: "Da'wah topics and Islamic content",
      content_ar: "المستودع الدعوي الرقمي",
      rule_ar: "مرجعان شاملان",
      sources: [
        { name: "المستودع الدعوي الرقمي", url: "https://dawa.center" },
        { name: "موسوعة الجمهرة", url: "islamic-content.com" },
      ],
    },
    {
      domain: "quran",
      label_ar: "القرآن الكريم",
      label_en: "The Qur'an",
      content_ar: "النص القرآني بالرسم والنص المعتمد",
      rule_ar: "أهمية التأكد من موثوقية نقل الآيات.",
      sources: [{ name: "Quranpedia", url: "https://quranpedia.net" }],
    },
    {
      domain: "hadith",
      label_ar: "الحديث النبوي",
      label_en: "Prophetic hadith",
      content_ar: "الأحاديث الصحيحة من الصحيحين",
      rule_ar: "لا ينسب حديث دون مصدر وحكم معتمد في البيانات.",
      sources: [
        { name: "الدرر السنية — الموسوعة الحديثية", url: "https://dorar.net/hadith" },
        { name: "المكتبة الشاملة", url: "https://shamela.ws" },
      ],
    },
    {
      domain: "fiqh",
      label_ar: "الفقه العام",
      label_en: "General fiqh",
      content_ar: "أي كتاب معتمد في الفقه على أحد المذاهب الفقهية الأربعة",
      rule_ar: "لا تتحول إلى فتوى شخصية أو ترجيح آلي مستقل.",
      sources: [{ name: "الدرر السنية — الموسوعة الفقهية", url: "https://dorar.net/feqhia" }],
    },
    {
      domain: "shubuhat",
      label_ar: "الشبهات والأسئلة المتكررة",
      label_en: "Common questions and doubts",
      content_ar: "بينات: أسئلة وأجوبة عن الإسلام",
      rule_ar: "تعد مصدرًا أساسيًا للحلول الحوارية في الشبهات",
      sources: [{ name: "بينات: أسئلة وأجوبة عن الإسلام", url: "https://dawa.center/file/7937" }],
    },
    {
      domain: "terminology",
      label_ar: "الترجمة والمصطلحات",
      label_en: "Translation and terminology",
      content_ar: "موسوعة الجمهرة - مفردات المحتوى الإسلامي",
      rule_ar: "يقدم على الترجمة التلقائية في المصطلحات الشرعية الحساسة.",
      sources: [{ name: "موسوعة الجمهرة — القاموس", url: "https://islamic-content.com/dictionary" }],
    },
  ],
  glossary: [
    {
      id: "gl-islam",
      term_ar: "الإسلام",
      term_en: "Islam",
      usage_ar: "دين الاستسلام لله بالتوحيد والانقياد له بالطاعة، ويشرح بحسب السياق ولا يختزل في معنى ثقافي عام.",
      page: 8,
    },
    {
      id: "gl-tawhid",
      term_ar: "التوحيد",
      term_en: "Tawhid / Oneness of God",
      usage_ar:
        "يفضل إبقاء المصطلح مع شرح معناه إفراد الله بالربوبية والألوهية ووصفه بما جاء الوحي به من أسمائه الحسنى؛ ولا يختزل في ترجمة قد توحي بمجرد الوحدانية العددية.",
      page: 8,
    },
    {
      id: "gl-fatwa",
      term_ar: "الفتوى",
      term_en: "Fatwa",
      usage_ar: "جواب شرعي يصدره مؤهل في واقعة أو سؤال؛ ولا يساوى بالمعلومة العامة.",
      page: 8,
    },
  ],
  bayyinatIndex: {
    source: {
      name: "بينات: أسئلة وأجوبة عن الإسلام",
      publisher: "مركز أصول",
      year: "1445",
      url: "https://dawa.center/file/7937",
      file_url: "https://dawa.center/file/7937/download",
    },
    entries: [
      { id: "byn-0004", number: 4, part_ar: "أولًا: الإيمان بالله", section_ar: "توحيد الربوبية", question_ar: "كيف نجيب على سؤال: من خلق الله؟", page: 40, pdf_page: 41 },
      { id: "byn-0009", number: 9, part_ar: "أولًا: الإيمان بالله", section_ar: "توحيد الألوهية", question_ar: "لماذا يعبد المسلمون الكعبة، والحجر الأسود؟", page: 65, pdf_page: 66 },
      { id: "byn-0026", number: 26, part_ar: "ثالثًا: الإيمان بالكتب", section_ar: "شبهات حول إلهية القرآن", question_ar: "ادعاء أن القرآن وثيقة قديمة.", page: 133, pdf_page: 134 },
      { id: "byn-0027", number: 27, part_ar: "ثالثًا: الإيمان بالكتب", section_ar: "شبهات حول إلهية القرآن", question_ar: "ادعاء أن القرآن مصدره البشر.", page: 137, pdf_page: 138 },
      { id: "byn-0056", number: 56, part_ar: "ثالثًا: الإيمان بالكتب", section_ar: "شبهات حول القراءات", question_ar: "هل تعدد القراءات القرآنية يدل على وقوع الاختلاف في القرآن الكريم؟", page: 266, pdf_page: 267 },
    ],
  },
  bayyinatAnswers: {
    entries: [
      {
        id: "byn-0009",
        question_ar: "لماذا يعبد المسلمون الكعبة، والحجر الأسود؟",
        excerpt_ar: FIXTURE_EXCERPT,
        page_start: 65,
        page_end: 66,
        pdf_page_start: 66,
        domain: "shubuhat",
        level: "B",
        keywords_ar: ["الكعبة", "الحجر الأسود"],
        keywords_en: ["kaaba", "black stone"],
        verified: true,
        verification_note: "fixture",
      },
      {
        id: "byn-0004",
        question_ar: "كيف نجيب على سؤال: من خلق الله؟",
        excerpt_ar: FIXTURE_EXCERPT,
        page_start: 40,
        domain: "aqeeda",
        level: "B",
        keywords_ar: ["من خلق الله"],
        keywords_en: ["who created god"],
        verified: false,
        verification_note: "fixture: pending review — must not be shown",
      },
      {
        id: "byn-0056",
        question_ar: "هل تعدد القراءات القرآنية يدل على وقوع الاختلاف في القرآن الكريم؟",
        excerpt_ar: FIXTURE_EXCERPT,
        page_start: 266,
        domain: "quran",
        level: "C",
        keywords_ar: ["القراءات"],
        keywords_en: ["qiraat"],
        verified: true,
        verification_note: "fixture: level C",
      },
    ],
  },
};

export function fixtureKnowledgeBase(): KnowledgeBase {
  return createKnowledgeBase(knowledgeFixtureData);
}
