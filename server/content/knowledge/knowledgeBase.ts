/**
 * Knowledge engine for the `knowledge` route — glossary terms from sources.pdf and
 * Bayyinat («بينات: أسئلة وأجوبة عن الإسلام») questions.
 *
 * The engine never produces religious text. It:
 * 1. pre-filters candidates lexically (normalized Arabic + English keywords) so the model
 *    can pick one id in the same analyze round-trip,
 * 2. resolves a picked id to a verbatim answer (glossary row / reviewed excerpt) or, when only
 *    the index knows the question, to a pointer at the exact Bayyinat question and page,
 * 3. builds «where to look» pointers from the PDF's approved-sources table.
 */
import type { KnowledgeAnswer, KnowledgeDomain, SourcePointer } from "../../../shared/experience/api";
import type { ContentLevel } from "../../../shared/experience/guidance";
import { TMN_BAYYINAT, TMN_CHALLENGE_REFERENCE, isAllowlistedSourceId } from "../sourceRegistry";
import { containsPhrase, contentTokens, expandStem, normalizeArabic, stemArabic, stemsMatch } from "./arabicText";
import {
  asContentLevel,
  asKnowledgeDomain,
  type ApprovedSourceRow,
  type BayyinatAnswerEntry,
  type BayyinatIndexEntry,
  type GlossaryRow,
  type KnowledgeSourceData,
} from "./knowledgeTypes";

export const DEFAULT_REFERENCE_TITLE_AR = "المرجعية والحزمة العلمية والبيانات";
export const DEFAULT_BAYYINAT_NAME = "بينات: أسئلة وأجوبة عن الإسلام";
export const DEFAULT_DICTIONARY_URL = "https://islamic-content.com/dictionary";
export const DEFAULT_CANDIDATE_LIMIT = 12;

export type KnowledgeCandidate = {
  id: string;
  kind: "glossary" | "qa";
  /** What the model sees: the glossary term (ar / en) or the Bayyinat question. */
  text: string;
  score: number;
  /** True when a reviewed verbatim answer exists (glossary rows always; qa only when curated + verified). */
  answerable: boolean;
};

export type KnowledgeResolution =
  | { kind: "answer"; answer: KnowledgeAnswer }
  /** A reviewed excerpt exists but its level needs a qualified human (C/D). */
  | { kind: "restricted"; level: ContentLevel; domain: KnowledgeDomain; pointer: SourcePointer | null }
  /** The question is in the Bayyinat index but no reviewed excerpt is curated yet. */
  | { kind: "index_only"; domain: KnowledgeDomain; pointer: SourcePointer }
  | { kind: "unknown" };

export type KnowledgeBase = {
  findCandidates(message: string, limit?: number): KnowledgeCandidate[];
  /** A clear "what does <term> mean / translate <term>" question about one glossary term. */
  explicitGlossaryMatch(message: string): GlossaryRow | null;
  resolve(id: string): KnowledgeResolution;
  pointerFor(domain: KnowledgeDomain | null | undefined): SourcePointer | null;
  /** PDF wording for the analyze prompt. */
  grounding: { levels?: unknown; scope?: unknown };
  stats: { glossary: number; bayyinatIndexed: number; bayyinatAnswerable: number; approvedDomains: number };
};

type BayyinatDoc = {
  id: string;
  number: number | null;
  question: string;
  index: BayyinatIndexEntry | null;
  answer: BayyinatAnswerEntry | null;
  questionStems: string[];
  sectionStems: string[];
  keywordsAr: string[];
  /** Stems of each Arabic keyword phrase (precomputed). */
  keywordsArStems: string[][];
  keywordsEn: string[];
  /** Light-stemmed English words from the curated English keywords. */
  enStems: Set<string>;
};

/** «يعني» is deliberately absent: it is everyday filler («يعني الإسلام دين إرهاب؟»), not a meaning question. */
const MEANING_CUES = new Set(
  [
    "معني", "معنا", "تعني", "تعريف", "عرف", "عرفني", "ترجم", "ترجمه", "ترجمة", "مقابل",
    "مفهوم", "مصطلح", "مقصود", "meaning", "mean", "means", "define", "definition", "translate",
    "translation", "term",
  ].map((w) => normalizeArabic(w)),
);
const CUE_WINDOW = 2;
/**
 * Words that frame a meaning / translation question without changing what it is about: «كلمة»,
 * the target language, "in Islam", and the audience («لشخص لم يسمع بالمصطلح من قبل» — PDF case 7).
 * Compared as stems.
 */
const TERM_FRAMING = new Set(
  [
    "كلمه", "لفظ", "لفظه", "انجليزيه", "انكليزيه", "عربيه", "لغه", "لغويا", "اصطلاحا", "شرعا", "اسلام",
    "شخص", "احد", "طفل", "يسمع", "سمع", "word", "into", "english", "arabic", "language", "someone",
    "person", "child", "heard",
  ].map((w) => stemArabic(normalizeArabic(w))),
);

const CONTEXT_PREPOSITIONS = new Set(["في", "عند", "in", "within"]);

function isTermFraming(stem: string): boolean {
  // Also with one proclitic letter («لشخص», «لطفل»), which the light stemmer keeps on short words.
  return TERM_FRAMING.has(stem) || (/^[وفبلك]../.test(stem) && TERM_FRAMING.has(stemArabic(stem.slice(1))));
}

/**
 * True when the question is about the glossary term itself, not about something the term only
 * introduces: «ما معنى حديث إنما الأعمال بالنيات؟» asks about a hadith, "what does islam mean by
 * jihad" asks about jihad. `other(i)`: token i is a content word that is not the term, a cue,
 * framing or a stopword.
 */
function asksAboutTerm(hit: { start: number; end: number; cue: number }, other: (i: number) => boolean, count: number) {
  const others = Array.from({ length: count }, (_v, i) => i).filter(other);
  // Not the head of a longer name («حديث جبريل», "sunnah prayer").
  if (other(hit.end + 1)) return false;
  // A term before its cue ("what does tawhid mean") must leave the cue ending the question.
  if (hit.start < hit.cue && others.some((i) => i > hit.cue)) return false;
  return others.length <= 1;
}

export function createKnowledgeBase(data: KnowledgeSourceData): KnowledgeBase {
  const referenceTitle = data.referenceTitleAr?.trim() || DEFAULT_REFERENCE_TITLE_AR;
  const approved = new Map<KnowledgeDomain, ApprovedSourceRow>();
  for (const row of data.approvedSources ?? []) {
    const domain = asKnowledgeDomain(row.domain);
    if (domain && !approved.has(domain)) approved.set(domain, row);
  }

  const glossary = (data.glossary ?? []).filter(
    (g) => g.id?.trim() && g.term_ar?.trim() && g.usage_ar?.trim(),
  );
  const glossaryById = new Map(glossary.map((g) => [g.id, g]));
  const glossaryTerms = glossary.map((g) => ({
    row: g,
    stems: contentTokensKeepAll(g.term_ar),
    english: g.term_en
      .split("/")
      .map((part) => normalizeArabic(part))
      .filter((part) => part.length >= 3),
  }));

  const bayyinatName = data.bayyinatIndex?.source?.name?.trim() || DEFAULT_BAYYINAT_NAME;
  const bayyinatSource = data.bayyinatIndex?.source ?? null;
  const docs = buildBayyinatDocs(data);
  const docsById = new Map(docs.map((d) => [d.id, d]));
  const idf = buildIdf(docs);
  const enDf = buildEnDf(docs);

  function pointerFor(domain: KnowledgeDomain | null | undefined): SourcePointer | null {
    if (!domain) return null;
    const row = approved.get(domain);
    if (!row) return null;
    return {
      domain,
      label_ar: row.label_ar,
      label_en: row.label_en,
      rule_ar: row.rule_ar,
      sources: dedupeSources(row.sources.map((s) => ({ name: s.name, url: absoluteUrl(s.url) }))),
    };
  }

  function bayyinatPageUrl(doc: BayyinatDoc): string {
    const filePage = doc.answer?.pdf_page_start ?? doc.index?.pdf_page;
    if (bayyinatSource?.file_url && filePage) return `${absoluteUrl(bayyinatSource.file_url)}#page=${filePage}`;
    return absoluteUrl(bayyinatSource?.url || "https://dawa.center/file/7937");
  }

  function bayyinatQuestionPointer(doc: BayyinatDoc): SourcePointer {
    const base = pointerFor("shubuhat");
    const page = doc.index?.page ?? doc.answer?.page_start;
    const label = [
      bayyinatName,
      doc.number !== null ? `المسألة ${doc.number}` : null,
      doc.question,
      page ? `ص ${page}` : null,
    ]
      .filter(Boolean)
      .join(" — ");
    return {
      domain: "shubuhat",
      label_ar: base?.label_ar ?? "الشبهات والأسئلة المتكررة",
      label_en: base?.label_en ?? "Common questions and doubts",
      rule_ar: base?.rule_ar ?? "",
      sources: dedupeSources([{ name: label, url: bayyinatPageUrl(doc) }, ...(base?.sources ?? [])]),
    };
  }

  function glossaryAnswer(row: GlossaryRow): KnowledgeAnswer {
    const dictionary = approved.get("terminology")?.sources.find((s) => /dictionary/i.test(s.url));
    return {
      kind: "glossary",
      id: row.id,
      level: "A",
      domain: "terminology",
      title_ar: row.term_ar.trim(),
      title_en: row.term_en.trim(),
      body_ar: row.usage_ar.trim(),
      term_en: row.term_en.trim(),
      source: {
        name: referenceTitle,
        reference: `نماذج لقاموس المصطلحات الأساسية — ص ${row.page}`,
        url: dictionary ? absoluteUrl(dictionary.url) : DEFAULT_DICTIONARY_URL,
      },
    };
  }

  function qaAnswer(doc: BayyinatDoc, answer: BayyinatAnswerEntry, level: ContentLevel, domain: KnowledgeDomain): KnowledgeAnswer {
    const start = answer.page_start;
    const end = answer.page_end && answer.page_end !== start ? `–${answer.page_end}` : "";
    const reference = doc.number !== null ? `المسألة ${doc.number} — ص ${start}${end}` : `ص ${start}${end}`;
    return {
      kind: "qa",
      id: doc.id,
      level,
      domain,
      title_ar: doc.question,
      title_en: doc.number !== null ? `${bayyinatName} — Q${doc.number}` : bayyinatName,
      body_ar: answer.excerpt_ar.trim(),
      source: { name: bayyinatName, reference, url: bayyinatPageUrl(doc) },
    };
  }

  function explicitGlossaryMatch(message: string): GlossaryRow | null {
    const tokens = normalizeArabic(message).split(" ").filter(Boolean);
    const isCue = tokens.map((t) => MEANING_CUES.has(t) || MEANING_CUES.has(stemArabic(t)));
    const cueAt = tokens.flatMap((_t, i) => (isCue[i] ? [i] : []));
    if (!cueAt.length) return null;
    const nearestCue = (i: number) => cueAt.reduce((c, d) => (Math.abs(d - i) < Math.abs(c - i) ? d : c));
    /** Content stem per token; null for stopwords. */
    const stems = tokens.map((t) => contentTokens(t)[0] ?? null);

    // The term must be the object of the meaning/translation cue: nearest term within the window wins.
    let best: { row: GlossaryRow; distance: number } | null = null;
    let tie = false;
    for (const term of glossaryTerms) {
      const occurrences: { start: number; end: number }[] = [];
      if (term.stems.length === 1) {
        tokens.forEach((tok, i) => {
          if (stemsMatch(stemArabic(tok), term.stems[0]!)) occurrences.push({ start: i, end: i });
        });
      }
      for (const phrase of term.english) {
        const words = phrase.split(" ");
        tokens.forEach((_tok, i) => {
          if (words.every((w, k) => tokens[i + k] === w)) occurrences.push({ start: i, end: i + words.length - 1 });
        });
      }
      const own = new Set<number>();
      for (const o of occurrences) for (let k = o.start; k <= o.end; k++) own.add(k);
      // «في الإسلام» / "in Islam" frames the question; it is not what the question asks about.
      const hit = occurrences
        .filter((o) => !CONTEXT_PREPOSITIONS.has(tokens[o.start - 1] ?? ""))
        .map((o) => ({ ...o, cue: nearestCue(o.start) }))
        .reduce<{ start: number; end: number; cue: number } | null>(
          (a, b) => (!a || Math.abs(b.cue - b.start) < Math.abs(a.cue - a.start) ? b : a),
          null,
        );
      if (!hit) continue;
      const distance = Math.abs(hit.cue - hit.start);
      if (distance > CUE_WINDOW) continue;
      const other = (i: number) => {
        const stem = stems[i] ?? null;
        return stem !== null && !own.has(i) && !isCue[i] && !isTermFraming(stem);
      };
      if (!asksAboutTerm(hit, other, tokens.length)) continue;
      if (!best || distance < best.distance) {
        best = { row: term.row, distance };
        tie = false;
      } else if (distance === best.distance && best.row.id !== term.row.id) {
        tie = true;
      }
    }
    return best && !tie ? best.row : null;
  }

  return {
    grounding: { levels: data.levels, scope: data.scope },
    stats: {
      glossary: glossary.length,
      bayyinatIndexed: docs.length,
      bayyinatAnswerable: docs.filter((d) => isAnswerable(d.answer)).length,
      approvedDomains: approved.size,
    },
    pointerFor,

    explicitGlossaryMatch,

    findCandidates(message, limit = DEFAULT_CANDIDATE_LIMIT) {
      const normalized = normalizeArabic(message);
      const stems = [...new Set(contentTokens(message))];
      const out: KnowledgeCandidate[] = [];

      const explicit = explicitGlossaryMatch(message);
      for (const term of glossaryTerms) {
        const arabicHit = term.stems.length > 0 && term.stems.every((ts) => stems.some((s) => stemsMatch(s, ts)));
        const englishHit = term.english.some((phrase) => containsPhrase(normalized, phrase));
        if (!arabicHit && !englishHit) continue;
        out.push({
          id: term.row.id,
          kind: "glossary",
          text: `${term.row.term_ar} (${term.row.term_en})`,
          score: explicit?.id === term.row.id ? 100 : 1.5,
          answerable: true,
        });
      }
      out.sort((a, b) => b.score - a.score);
      const glossaryCandidates = out.slice(0, 3);

      const scored: KnowledgeCandidate[] = [];
      if (stems.length || normalized) {
        const expansions = stems.map((s) => expandStem(s));
        const en = [...new Set(englishStems(message))];
        for (const doc of docs) {
          const score = scoreDoc(doc, stems, expansions, normalized, idf, en, enDf, docs.length);
          if (score <= 0) continue;
          scored.push({
            id: doc.id,
            kind: "qa",
            text: doc.question.slice(0, 220),
            score: Math.round(score * 100) / 100,
            answerable: isAnswerable(doc.answer),
          });
        }
      }
      return [...glossaryCandidates, ...scored]
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
        .slice(0, Math.max(1, limit));
    },

    resolve(id) {
      const key = id.trim();
      const row = glossaryById.get(key);
      if (row) {
        // Registry allowlist is authoritative: no approved source, no answer.
        if (!isAllowlistedSourceId(TMN_CHALLENGE_REFERENCE)) return { kind: "unknown" };
        return { kind: "answer", answer: glossaryAnswer(row) };
      }

      const doc = docsById.get(key);
      if (!doc) return { kind: "unknown" };
      const domain = asKnowledgeDomain(doc.answer?.domain) ?? "shubuhat";
      if (!isAnswerable(doc.answer) || !isAllowlistedSourceId(TMN_BAYYINAT)) {
        return { kind: "index_only", domain, pointer: bayyinatQuestionPointer(doc) };
      }
      const level = asContentLevel(doc.answer!.level) ?? "B";
      if (level === "C" || level === "D") {
        return { kind: "restricted", level, domain, pointer: bayyinatQuestionPointer(doc) };
      }
      return { kind: "answer", answer: qaAnswer(doc, doc.answer!, level, domain) };
    },
  };
}

function isAnswerable(answer: BayyinatAnswerEntry | null): boolean {
  return Boolean(answer && answer.verified === true && answer.excerpt_ar?.trim() && answer.page_start);
}

function contentTokensKeepAll(text: string): string[] {
  return normalizeArabic(text)
    .split(" ")
    .filter(Boolean)
    .map((t) => stemArabic(t));
}

function buildBayyinatDocs(data: KnowledgeSourceData): BayyinatDoc[] {
  const answers = new Map<string, BayyinatAnswerEntry>();
  for (const entry of data.bayyinatAnswers?.entries ?? []) {
    if (entry?.id?.trim()) answers.set(entry.id.trim(), entry);
  }
  const docs: BayyinatDoc[] = [];
  const seen = new Set<string>();
  const push = (index: BayyinatIndexEntry | null, answer: BayyinatAnswerEntry | null) => {
    const id = (index?.id ?? answer?.id ?? "").trim();
    const question = (index?.question_ar ?? answer?.question_ar ?? "").replace(/\s+/g, " ").trim();
    if (!id || !question || seen.has(id)) return;
    seen.add(id);
    const keywordsAr = (answer?.keywords_ar ?? []).map((k) => normalizeArabic(k)).filter(Boolean);
    const keywordsEn = (answer?.keywords_en ?? []).map((k) => normalizeArabic(k)).filter((k) => k.length >= 3);
    docs.push({
      id,
      number: typeof index?.number === "number" ? index.number : typeof answer?.number === "number" ? answer.number : null,
      question,
      index,
      answer,
      questionStems: [...new Set(contentTokens(question))],
      sectionStems: [...new Set(contentTokens(`${index?.section_ar ?? ""} ${index?.part_ar ?? ""}`))],
      keywordsAr,
      keywordsArStems: keywordsAr.map((k) => contentTokens(k)),
      keywordsEn,
      enStems: new Set((answer?.keywords_en ?? []).flatMap((k) => englishStems(k))),
    });
  };
  for (const entry of data.bayyinatIndex?.entries ?? []) push(entry, answers.get(entry.id?.trim()) ?? null);
  for (const answer of answers.values()) push(null, answer);
  return docs;
}

const EN_STOP = new Set(
  ("a an the is are was were be been do does did why what how who whom which when where to of in on at for and or " +
    "not no yes it its this that these those you your i me my we our they their he she his her can could will would should " +
    "about with from by as so if then than there here muslim muslims islam islamic say says said really true").split(" "),
);

/** Lowercase English words, minus stopwords, with light suffix stripping (prayer/prays/praying → pray). */
export function englishStems(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    if (raw.length < 3 || EN_STOP.has(raw)) continue;
    let w = raw;
    if (w.endsWith("ies") && w.length > 4) w = w.slice(0, -3) + "y";
    else if (w.endsWith("ing") && w.length > 5) w = w.slice(0, -3);
    else if (w.endsWith("ers") && w.length > 5) w = w.slice(0, -3);
    else if (w.endsWith("er") && w.length > 4) w = w.slice(0, -2);
    else if (w.endsWith("ed") && w.length > 4) w = w.slice(0, -2);
    else if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) w = w.slice(0, -1);
    if (w.length >= 3 && !EN_STOP.has(w)) out.push(w);
  }
  return out;
}

function buildEnDf(docs: BayyinatDoc[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const doc of docs) for (const w of doc.enStems) df.set(w, (df.get(w) ?? 0) + 1);
  return df;
}

function buildIdf(docs: BayyinatDoc[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const stem of new Set([...doc.questionStems, ...doc.keywordsArStems.flat()])) {
      df.set(stem, (df.get(stem) ?? 0) + 1);
    }
  }
  const n = Math.max(1, docs.length);
  const idf = new Map<string, number>();
  for (const [stem, count] of df) idf.set(stem, Math.log(1 + n / count));
  return idf;
}

function scoreDoc(
  doc: BayyinatDoc,
  stems: string[],
  expansions: string[][],
  normalized: string,
  idf: Map<string, number>,
  en: string[] = [],
  enDf: Map<string, number> = new Map(),
  docCount = 1,
): number {
  let score = 0;
  let matched = 0;
  // English word overlap with the curated English keywords («pray» ↔ «prayer»). Needs two shared
  // words, or one word that few entries use, so generic words alone never select an answer.
  const enHits = en.filter((w) => doc.enStems.has(w));
  const rareHit = enHits.some((w) => (enDf.get(w) ?? docCount) <= 3);
  if (enHits.length >= 2 || rareHit) {
    for (const w of enHits) score += 1.2 * Math.log(1 + docCount / (enDf.get(w) ?? docCount));
    matched += 1;
  }
  for (let i = 0; i < stems.length; i++) {
    const stem = stems[i]!;
    const q = doc.questionStems.find((d) => stemsMatch(stem, d));
    if (q) {
      score += idf.get(q) ?? 1;
      matched += 1;
      continue;
    }
    // Same idea, different wording (e.g. «تأليف» ↔ «مصدره البشر»): weaker credit.
    const related = expansions[i]!;
    const viaExpansion = related.length ? doc.questionStems.find((d) => related.some((r) => stemsMatch(r, d))) : undefined;
    if (viaExpansion) {
      score += 0.6 * (idf.get(viaExpansion) ?? 1);
      matched += 1;
      continue;
    }
    const s = doc.sectionStems.find((d) => stemsMatch(stem, d));
    if (s) score += 0.3 * (idf.get(s) ?? 1);
  }
  for (let k = 0; k < doc.keywordsAr.length; k++) {
    if (` ${normalized} `.includes(` ${doc.keywordsAr[k]} `)) {
      score += 2.5;
      matched += 1;
      continue;
    }
    const kwStems = doc.keywordsArStems[k]!;
    if (kwStems.length && kwStems.every((k) => stems.some((s) => stemsMatch(s, k)))) {
      score += 2;
      matched += 1;
    }
  }
  for (const kw of doc.keywordsEn) {
    if (` ${normalized} `.includes(` ${kw} `)) {
      score += 2.5;
      matched += 1;
    }
  }
  if (!matched) return 0;
  // Mild length normalization so very long questions do not win on volume alone.
  return score / Math.sqrt(1 + doc.questionStems.length / 10);
}

function absoluteUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
}

function dedupeSources(sources: { name: string; url: string }[]) {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = `${s.name}|${s.url}`;
    if (!s.url || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** An engine with no data — every lookup is empty; used until curated files exist and in some tests. */
export const EMPTY_KNOWLEDGE_BASE: KnowledgeBase = createKnowledgeBase({
  approvedSources: [],
  glossary: [],
  bayyinatIndex: null,
  bayyinatAnswers: null,
});
