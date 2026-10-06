import type { ContentType } from "../../shared/experience/guidance";

export type SourceRegistryStatus = "approved" | "deprecated" | "blocked";

export type SourceFamily = "quran" | "hadith" | "seerah" | "concept" | "tafsir" | "reference";

export type RegistrySource = {
  sourceId: string;
  name: string;
  domain: string;
  sourceFamily: SourceFamily;
  /** Catalog routing — not a live fetch URL unless a connector is wired. */
  referenceCatalog: string;
  allowedContentTypes: readonly ContentType[];
  description: string;
  status: SourceRegistryStatus;
  /** Registry approval for allowlist policy. */
  verificationStatus: "approved";
  referencePolicy: string;
  licenseNotes: string;
  notes: string;
};

/** Challenge allowlist — no ad-hoc religious sources at runtime. */
export const SOURCE_REGISTRY: readonly RegistrySource[] = [
  {
    sourceId: "tmn-src-quran-mushaf",
    name: "Quranpedia",
    domain: "quranpedia.net",
    sourceFamily: "quran",
    referenceCatalog: "quranpedia.net — mushaf & translations",
    allowedContentTypes: ["quran"],
    description: "Approved mushaf text and translations (Quranpedia catalog).",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy: "source_text requires internal_snapshot or live_api connector evidence with provenance.",
    licenseNotes: "Live API: see quranpedia.net/api-docs; dumps require attribution.",
    notes: "Legacy id; maps to Quranpedia in challenge docs.",
  },
  {
    sourceId: "tmn-src-hadith-dorar",
    name: "Dorar Hadith",
    domain: "dorar.net",
    sourceFamily: "hadith",
    referenceCatalog: "dorar.net/hadith",
    allowedContentTypes: ["hadith"],
    description: "Hadith encyclopedia routing (Dorar).",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy: "source_text only after snapshot match; no JSONP-as-external-proof in checkedAgainst.",
    licenseNotes: "Official search API is JSONP/HTML; prefer internal snapshot + review.",
    notes: "Edition cross-check: shamela.ws (reference).",
  },
  {
    sourceId: "tmn-src-hadith-bukhari-shamela",
    name: "صحيح البخاري (ط. السلطانية) — المكتبة الشاملة",
    domain: "shamela.ws",
    sourceFamily: "hadith",
    referenceCatalog: "shamela.ws/book/1681 — صحيح البخاري، ط السلطانية (بولاق 1311هـ) بترقيم محمد فؤاد عبد الباقي",
    /** "seerah": narrations of Seerah events (story slot), same verbatim rules and grade. */
    allowedContentTypes: ["hadith", "seerah"],
    description:
      "Approved edition of Sahih al-Bukhari on Shamela (PDF hadith row: «الطبعات المعتمدة لكتب السنة النبوية في المكتبة الشاملة»).",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy:
      "source_text only: verbatim from the edition page (Companion → end of matn), with كتاب/باب, number, edition, page URL and grade صحيح (in the Sahihayn). Snapshot via server/scripts/snapshotContent.ts.",
    licenseNotes: "Public library pages; a handful of hadith quoted with page links — no bulk copy.",
    notes: "Grade basis: sources.pdf «الأحاديث الصحيحة من الصحيحين».",
  },
  {
    sourceId: "tmn-src-hadith-muslim-shamela",
    name: "صحيح مسلم (ت. محمد فؤاد عبد الباقي) — المكتبة الشاملة",
    domain: "shamela.ws",
    sourceFamily: "hadith",
    referenceCatalog: "shamela.ws/book/1727 — صحيح مسلم، تحقيق محمد فؤاد عبد الباقي",
    allowedContentTypes: ["hadith"],
    description: "Approved edition of Sahih Muslim on Shamela (PDF hadith row).",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy:
      "source_text only: verbatim matn from the edition page; the editor's notes (hamesh) are never included. Grade صحيح (in the Sahihayn).",
    licenseNotes: "Public library pages; a handful of hadith quoted with page links — no bulk copy.",
    notes: "Grade basis: sources.pdf «الأحاديث الصحيحة من الصحيحين».",
  },
  {
    sourceId: "tmn-src-seerah-ibn-hisham-shamela",
    name: "السيرة النبوية لابن هشام (ت. السقا والأبياري وشلبي) — المكتبة الشاملة",
    domain: "shamela.ws",
    sourceFamily: "seerah",
    referenceCatalog: "shamela.ws/book/23833 — سيرة ابن هشام، ط مصطفى البابي الحلبي، الثانية 1375هـ",
    allowedContentTypes: ["seerah"],
    description:
      "Sirat Ibn Hisham (d. 213/218 AH) — a Seerah source of the first three centuries, admitted by the PDF's «السيرة والتاريخ» row.",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy:
      "source_text only: 1–3 verbatim prose paragraphs about the event, no poetry, no footnote markers. A Seerah book: no hadith grade is asserted or displayed.",
    licenseNotes: "Public library pages; short passages quoted with page links — no bulk copy.",
    notes: "Snapshot via server/scripts/snapshotContent.ts; no runtime fetch.",
  },
  {
    sourceId: "tmn-src-tafsir-tabari",
    name: "تفسير الطبري — جامع البيان في تأويل آي القرآن (Quranpedia)",
    domain: "quranpedia.net",
    sourceFamily: "tafsir",
    referenceCatalog: "api.quranpedia.net/v1/ayah/{surah}/{ayah}/book/4 — ت. أحمد شاكر، مؤسسة الرسالة 1420هـ",
    allowedContentTypes: ["tafsir"],
    description:
      "Tafsir of Ibn Jarir al-Tabari (d. 310 AH) — a source of the first three centuries, admitted by the PDF's tafseer row.",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy:
      "source_text only: 1–3 verbatim paragraphs explaining the topic's exact anchor verse, cut at sentence boundaries; Qur'anic words stay in their brackets so the mufassir's words are distinct (PDF rule).",
    licenseNotes: "Quranpedia API (read-only, no auth); short excerpts with a link back to the tafsir page.",
    notes: "Snapshot via server/scripts/snapshotContent.ts; no runtime fetch.",
  },
  {
    sourceId: "tmn-src-seerah-dorar",
    name: "Dorar History",
    domain: "dorar.net",
    sourceFamily: "seerah",
    referenceCatalog: "dorar.net/history",
    allowedContentTypes: ["seerah"],
    description: "Historical / seerah encyclopedia (Dorar).",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy: "Imported seerah text requires internal_snapshot; editorial narratives use concept source.",
    licenseNotes: "Web encyclopedia — ingest or snapshot; do not imply live Dorar verification without evidence.",
    notes: "",
  },
  {
    sourceId: "tmn-src-concept-dawa",
    name: "Dawa Center",
    domain: "dawa.center",
    sourceFamily: "concept",
    referenceCatalog: "dawa.center — digital dawah repository",
    allowedContentTypes: ["concept", "seerah"],
    description: "Reviewed concept copy and editorial learning narratives (not scripture imports).",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy: "reviewed_explanation + editorial_internal only when published.",
    licenseNotes: "Files and Q&A app — no public bulk API; prefer curated ingest.",
    notes: "Seerah slot = interactive learning narrative, not Dorar import.",
  },
  {
    sourceId: "tmn-src-islamic-content",
    name: "Islamic Content (Al-Jamhara)",
    domain: "islamic-content.com",
    sourceFamily: "concept",
    referenceCatalog: "islamic-content.com / dictionary",
    allowedContentTypes: ["concept"],
    description: "Terminology and simplified explanations (Al-Jamhara).",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy: "reviewed_explanation + editorial_internal for published concept items.",
    licenseNotes: "Developer API for some modules; dictionary often web-only.",
    notes: "",
  },
  {
    sourceId: "tmn-src-jamhara-encyclopedia",
    name: "موسوعة مفردات المحتوى الإسلامي: الجمهرة",
    domain: "islamic-content.com",
    sourceFamily: "reference",
    referenceCatalog: "islamic-content.com/t/{id} — concept pages (المصطلحات) and da'wah lesson pages",
    allowedContentTypes: [],
    description:
      "Named by sources.pdf («الموضوعات الدعوية والمحتوى الإسلامي»: «مرجعان شاملان») as a comprehensive approved reference for da'wah topics and terminology. Feeds the optional «تعلّم أكثر» lessons shown on top of a journey.",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy:
      "source_page only: printed sections copied verbatim (definitions, virtue, evidence, means, fruits, forms, examples, etiquette), each page fetched twice and re-checked at load (sha256). A garbled section is dropped, never repaired. Snapshot via server/scripts/snapshotLessons.ts; no runtime fetch.",
    licenseNotes: "Public encyclopedia pages; short sections quoted with a link to the entry page.",
    notes: "Lessons only (GuidancePayload.lessons) — never a journey slot. Entries/sections anchored in server/content/lessons/lessonAnchors.ts.",
  },
  {
    sourceId: "tmn-src-shamela-reference",
    name: "Shamela (reference)",
    domain: "shamela.ws",
    sourceFamily: "reference",
    referenceCatalog: "shamela.ws — hadith edition cross-check",
    allowedContentTypes: [],
    description: "Reference catalog for hadith editions — not a runtime content body source.",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy: "Attribution/edition notes only; no display without hadith source_text bundle.",
    licenseNotes: "Library site — use for edition verification metadata.",
    notes: "Allowlisted for citation metadata, not for AI-generated text.",
  },
  {
    sourceId: "tmn-src-challenge-reference",
    name: "المرجعية والحزمة العلمية والبيانات",
    domain: "sources.pdf (challenge reference, v. 1448/3/20)",
    sourceFamily: "reference",
    referenceCatalog: "sources.pdf — scope, content levels A–D, approved-sources table, glossary samples (p. 8)",
    allowedContentTypes: [],
    description:
      "The challenge's reference package. Defines scope, levels and the approved source per domain; its glossary sample rows (p. 8) are shown verbatim on the knowledge route.",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy:
      "Glossary rows and «قاعدة الاستخدام» rules are displayed verbatim with page reference; nothing is paraphrased or generated.",
    licenseNotes: "Provided to participants with the challenge; local file, no public URL.",
    notes: "Governs every other entry here. Transcribed in server/content/knowledge/sourcesPdf.ts.",
  },
  {
    sourceId: "tmn-src-bayyinat",
    name: "بينات: أسئلة وأجوبة عن الإسلام",
    domain: "dawa.center",
    sourceFamily: "reference",
    referenceCatalog: "dawa.center/file/7937 — مركز أصول، 1445هـ",
    allowedContentTypes: [],
    description:
      "The PDF's named primary source for common questions and doubts (الشبهات والأسئلة المتكررة). Question index plus reviewed verbatim excerpts.",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy:
      "Only excerpts marked verified by a curator are displayed, verbatim, with question number and page; index-only questions are pointers, never answers.",
    licenseNotes: "Published PDF on dawa.center; quote with attribution and page.",
    notes: "Knowledge route only (shared/experience/api.ts KnowledgeAnswer kind=qa).",
  },
  {
    sourceId: "tmn-src-tafseer-dorar",
    name: "الدرر السنية — موسوعة التفسير",
    domain: "dorar.net",
    sourceFamily: "reference",
    referenceCatalog: "dorar.net/tafseer",
    allowedContentTypes: [],
    description: "PDF-approved platform for tafseer (alongside sources from the first three centuries).",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy:
      "Pointer only until a reviewed ingest exists. PDF rule: explain the ayah while distinguishing the mufassir's words from the Qur'anic text.",
    licenseNotes: "Web encyclopedia — no runtime fetch; no tafseer text is displayed yet.",
    notes: "Used in insufficient_reference pointers for the tafseer domain.",
  },
  {
    sourceId: "tmn-src-aqeeda-dorar",
    name: "الدرر السنية — موسوعة العقيدة",
    domain: "dorar.net",
    sourceFamily: "reference",
    referenceCatalog: "dorar.net/aqeeda",
    allowedContentTypes: [],
    description: "PDF-approved platform for creed and introducing Islam.",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy: "Pointer only until a reviewed ingest exists.",
    licenseNotes: "Web encyclopedia — no runtime fetch; no creed text is displayed from it yet.",
    notes: "Used in insufficient_reference pointers for the aqeeda domain.",
  },
  {
    sourceId: "tmn-src-fiqh-dorar",
    name: "الدرر السنية — الموسوعة الفقهية",
    domain: "dorar.net",
    sourceFamily: "reference",
    referenceCatalog: "dorar.net/feqhia",
    allowedContentTypes: [],
    description: "PDF-approved platform for general fiqh (alongside approved books of the four schools).",
    status: "approved",
    verificationStatus: "approved",
    referencePolicy:
      "Pointer only. PDF rule: must not turn into a personal fatwa or automated independent weighing (ترجيح).",
    licenseNotes: "Web encyclopedia — no runtime fetch; the app shows no rulings.",
    notes: "Used in referral / insufficient_reference pointers for the fiqh domain.",
  },
] as const;

/** Registry ids the knowledge route depends on (fail closed if either is not approved). */
export const TMN_CHALLENGE_REFERENCE = "tmn-src-challenge-reference";
export const TMN_BAYYINAT = "tmn-src-bayyinat";

export const APPROVED_RELIGIOUS_SOURCE_IDS = SOURCE_REGISTRY.filter((s) => s.status === "approved").map(
  (s) => s.sourceId,
);

const byId = new Map(SOURCE_REGISTRY.map((entry) => [entry.sourceId, entry]));

export function getRegistrySource(sourceId: string | null | undefined): RegistrySource | null {
  if (!sourceId?.trim()) return null;
  return byId.get(sourceId.trim()) ?? null;
}

export function isRegistrySourceApproved(sourceId: string): boolean {
  const entry = getRegistrySource(sourceId);
  return entry?.status === "approved";
}

export function isAllowlistedSourceId(sourceId: string): boolean {
  return isRegistrySourceApproved(sourceId);
}

export function isContentTypeAllowedForSource(sourceId: string, contentType: ContentType): boolean {
  const entry = getRegistrySource(sourceId);
  if (!entry || entry.status !== "approved") return false;
  return entry.allowedContentTypes.includes(contentType);
}

/** Scripture-attribution sources must not carry published editorial copy (P1-B.1). */
export function isScriptureAttributionSource(sourceId: string): boolean {
  return (
    sourceId === "tmn-src-quran-mushaf" ||
    sourceId === "tmn-src-hadith-dorar" ||
    sourceId === "tmn-src-seerah-dorar" ||
    sourceId === "tmn-src-hadith-bukhari-shamela" ||
    sourceId === "tmn-src-hadith-muslim-shamela" ||
    sourceId === "tmn-src-seerah-ibn-hisham-shamela" ||
    sourceId === "tmn-src-tafsir-tabari"
  );
}

export function displayNameForSource(sourceId: string): string | null {
  return getRegistrySource(sourceId)?.name ?? null;
}
