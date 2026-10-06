/**
 * "Learn more" lessons: verbatim al-Jamhara sections attached on top of a journey's fixed core
 * (verse → tafsir → hadith → seerah) when the person asks to learn or understand more.
 *
 * Synchronous, zero network: reads the committed snapshot and re-checks every record (approved
 * source, anchored entry and section, canonical URL, clean text shape, sha256). A record that fails
 * any check is dropped and reported in `rejected` (fail closed). Selection is deterministic and never
 * writes text: when nothing approved answers the requested part, `covered` is false.
 */
import { createHash } from "node:crypto";
import lessonsJson from "../snapshots/lessons.published.json";
import type { LessonAspect, LessonItem } from "../../../shared/experience/guidance";
import { normalizeArabic } from "../knowledge/arabicText";
import { isRegistrySourceApproved } from "../sourceRegistry";
import { lessonTextProblem } from "./jamharaExtract";
import {
  ASPECT_ANSWERED_BY,
  ASPECT_ORDER,
  JAMHARA_LESSON_ENTRIES,
  JAMHARA_SOURCE_ID,
  JAMHARA_SOURCE_NAME,
  MAX_LESSONS_PER_JOURNEY,
  MAX_LESSON_CHARS,
  MAX_PARTS_PER_SECTION,
  TOPIC_LESSON_SOURCES,
  jamharaEntryUrl,
  type TopicLessonSource,
} from "./lessonAnchors";
import { LESSON_SNAPSHOT_KIND, LESSON_SNAPSHOT_SCHEMA, type LessonSnapshotRecord } from "./lessonFormat";

export function lessonRecordId(entryId: number, aspect: LessonAspect, ordinal: number, part: number): string {
  return `jamhara-${entryId}-${aspect}-${ordinal}-${part}`;
}

/** Heading as printed: the card heading, plus the sub-heading when there is one. */
export function lessonTitleAr(card: string, sub: string): string {
  if (!sub) return card;
  if (!card || sub.startsWith(card)) return sub;
  return `${card} — ${sub}`;
}

export type StoredLesson = LessonSnapshotRecord;
export type LessonLoad = { records: StoredLesson[]; rejected: { id: string; reason: string }[] };

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const ASPECTS = new Set<string>(ASPECT_ORDER);

/** A hadith quotation or attribution inside a lesson section. */
const HADITH_MARK = /رواه|أخرجه|اخرجه|قال رسول الله|قال النبي|ﷺ:|ﷺ قال|عن النبي/;
/** «أخرجه X» / «رواه X» citations — X is the collection the section names. */
const HADITH_CITATION = /(?:أخرجه|اخرجه|رواه)\s+([^()،.؛:\n]{2,60})/g;
/**
 * Words quoted from the Prophet ﷺ without «رواه/أخرجه» — e.g. «فقال في مناجاته: «…»» after «ﷺ», or
 * «كان النبي صلى الله عليه وسلم يقول: «…»». Matched on text without tashkeel; such a quotation needs a
 * Sahihayn citation like any other.
 */
const PROPHET_QUOTE = /(?:ﷺ|صلى الله عليه وسلم|رسول الله|النبي|نبي الله)[^«»﴿﴾.]{0,80}«/;
const stripTashkeel = (text: string) => text.replace(/[\u064B-\u0652\u0670]/g, "");

/** Collections whose grade is established by the reference pack («الأحاديث الصحيحة من الصحيحين»). */
const SAHIHAYN = /^(?:البخاري|مسلم|الشيخان)(?:\s|$)/;

/**
 * sources.pdf: «لا ينسب حديث دون مصدر وحكم معتمد في البيانات». Al-Jamhara cites collections and numbers but
 * states no grades, so a section that quotes hadith is publishable only when every hadith it cites is in
 * al-Bukhari or Muslim; any other collection, or a quotation with no citation, drops the whole section.
 */
export function ungradedHadithProblem(body: string): string | null {
  if (!HADITH_MARK.test(body) && !PROPHET_QUOTE.test(stripTashkeel(body))) return null;
  const cited = [...body.matchAll(HADITH_CITATION)].map((m) => m[1]!.trim());
  if (!cited.length) return "quotes hadith with no citation (grade cannot be established)";
  const other = cited.find((c) => !SAHIHAYN.test(c));
  return other ? `quotes hadith outside the Sahihayn with no grade in the data (${other.slice(0, 40)})` : null;
}

function recordProblem(row: LessonSnapshotRecord): string | null {
  const entry = JAMHARA_LESSON_ENTRIES.find((e) => e.entryId === row.entryId);
  if (!entry) return "entry is not anchored";
  if (row.entryTitle !== entry.title) return "entry title differs from the anchor";
  if (row.url !== jamharaEntryUrl(row.entryId)) return "url is not the entry's canonical page";
  if (!ASPECTS.has(row.aspect)) return "unknown aspect";
  const anchors = entry.sections.filter((s) => s.aspect === row.aspect);
  const ordinal = Number(row.id.split("-")[3]);
  const anchor = anchors[ordinal - 1];
  if (!anchor || anchor.card !== row.card || anchor.sub !== row.sub) return "section is not anchored";
  if (row.id !== lessonRecordId(row.entryId, row.aspect, ordinal, row.part)) return "id does not match the anchor";
  if (row.title_ar !== lessonTitleAr(row.card, row.sub)) return "title_ar is not the printed heading";
  if (!Number.isInteger(row.part) || row.part < 1 || row.part > row.parts || row.parts > MAX_PARTS_PER_SECTION) {
    return "bad part numbering";
  }
  if (row.body_ar.length > MAX_LESSON_CHARS) return "body too long";
  const problem = lessonTextProblem(row.body_ar);
  if (problem) return `body: ${problem}`;
  if (sha256(row.body_ar) !== row.bodySha256) return "sha256 mismatch (text changed after capture)";
  const hadith = ungradedHadithProblem(row.body_ar);
  if (hadith) return hadith;
  if (!row.fetchedAt || !row.verifiedAt || row.requests.length < 2 || !row.verification_note) {
    return "missing double-fetch evidence";
  }
  return null;
}

export function loadLessonSnapshot(raw: unknown = lessonsJson): LessonLoad {
  const rejected: LessonLoad["rejected"] = [];
  const file = raw as { kind?: unknown; schema?: unknown; sourceId?: unknown; records?: unknown };
  if (!file || file.kind !== LESSON_SNAPSHOT_KIND || file.schema !== LESSON_SNAPSHOT_SCHEMA || !Array.isArray(file.records)) {
    return { records: [], rejected: [{ id: "*", reason: "not a lessons snapshot" }] };
  }
  if (file.sourceId !== JAMHARA_SOURCE_ID || !isRegistrySourceApproved(JAMHARA_SOURCE_ID)) {
    return { records: [], rejected: [{ id: "*", reason: "source is not approved in the registry" }] };
  }
  const records: StoredLesson[] = [];
  const seen = new Set<string>();
  for (const item of file.records as LessonSnapshotRecord[]) {
    const id = typeof item?.id === "string" ? item.id : "?";
    let reason: string | null;
    try {
      reason = seen.has(id) ? "duplicate id" : recordProblem(item);
    } catch {
      reason = "malformed record";
    }
    if (reason) {
      rejected.push({ id, reason });
      continue;
    }
    seen.add(id);
    records.push(item);
  }
  return { records, rejected };
}

let cache: LessonLoad | null = null;
export function publishedLessons(): LessonLoad {
  cache ??= loadLessonSnapshot();
  return cache;
}

/** Test seam. */
export function resetLessonCache(load?: LessonLoad) {
  cache = load ?? null;
}

/** Requested aspects, de-duplicated, in canonical order. */
export function canonicalFocus(focus: readonly LessonAspect[]): LessonAspect[] {
  const wanted = new Set(focus);
  return ASPECT_ORDER.filter((a) => wanted.has(a));
}

function activeSources(topicId: string, message: string): TopicLessonSource[] {
  const sources = TOPIC_LESSON_SOURCES[topicId as keyof typeof TOPIC_LESSON_SOURCES] ?? [];
  const text = `${normalizeArabic(message)} ${message.toLowerCase()}`;
  // When the person names a subject (e.g. du'a), only that subject's entry may answer: a neighbouring
  // concept's how-to is not an answer to "how do I make du'a?".
  const subject = sources.filter((s) => s.relation === "subject" && s.subject?.test(text));
  return subject.length ? subject : sources.filter((s) => s.relation !== "subject");
}

function toItem(row: StoredLesson, topicId: string): LessonItem {
  return {
    id: row.id,
    topicId,
    aspect: row.aspect,
    title_ar: row.title_ar,
    title_en: row.title_en,
    body_ar: row.body_ar,
    source: { name: JAMHARA_SOURCE_NAME, reference: `${row.entryTitle} — ${row.title_ar}`, url: row.url },
  };
}

/** Ritual acts whose performance (steps, validity) belongs to fiqh — normalized Arabic tokens. */
const RITUAL_PROCEDURE =
  /(?:^|\s)(?:و|ف|ب|ل|ك)?(?:ال)?(?:صلاه|صلوات|اصلي|نصلي|يصلي|تصلي|استخاره|وضوء|اتوضا|توضا|تيمم|غسل|اغتسل|صيام|صوم|اصوم|زكاه|حج|عمره|طواف|سجود السهو)(?=\s|$)/;
const RITUAL_PROCEDURE_EN = /\b(?:salah|salat|istikhara|wudu|ablution|fasting|zakat|hajj|umrah)\b/;

export type LessonSelection = { lessons: LessonItem[]; learning_request: { focus: LessonAspect[]; covered: boolean } };

/**
 * Up to 3 verbatim lessons for the requested aspects on this topic. Deterministic: one item per
 * requested aspect in canonical priority first, then the continuation of a section already shown,
 * then further items. `covered` is true only when every requested aspect got at least one item.
 * Returns null when nothing was asked (no `learning_request` then).
 */
export function selectLessons(input: {
  topicId: string;
  focus: readonly LessonAspect[] | null | undefined;
  message?: string;
  records?: readonly StoredLesson[];
}): LessonSelection | null {
  const focus = canonicalFocus(input.focus ?? []);
  if (!focus.length) return null;
  // The lessons are concept sections (meaning, virtue, means…), not the steps of a ritual: a request
  // about how to perform a prayer, fast, ablution… is honestly not covered here, whatever topic it reached.
  if (RITUAL_PROCEDURE.test(normalizeArabic(input.message ?? "")) || RITUAL_PROCEDURE_EN.test((input.message ?? "").toLowerCase())) {
    return { lessons: [], learning_request: { focus, covered: false } };
  }
  const records = input.records ?? publishedLessons().records;
  const sources = activeSources(input.topicId, input.message ?? "");

  const queues = new Map<LessonAspect, StoredLesson[]>();
  for (const aspect of focus) {
    const queue: StoredLesson[] = [];
    for (const source of sources) {
      for (const answering of ASPECT_ANSWERED_BY[aspect]) {
        if (source.relation === "related" && answering === "meaning") continue;
        queue.push(
          ...records
            .filter((r) => r.entryId === source.entryId && r.aspect === answering)
            .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true })),
        );
      }
    }
    queues.set(aspect, queue);
  }

  const chosen: StoredLesson[] = [];
  const answered = new Set<LessonAspect>();
  const take = (row: StoredLesson, aspect: LessonAspect) => {
    chosen.push(row);
    answered.add(aspect);
  };
  for (const aspect of focus) {
    if (chosen.length >= MAX_LESSONS_PER_JOURNEY) break;
    const next = queues.get(aspect)!.find((r) => !chosen.includes(r));
    if (next) take(next, aspect);
  }
  while (chosen.length < MAX_LESSONS_PER_JOURNEY) {
    const continuation = focus
      .flatMap((aspect) => queues.get(aspect)!.map((row) => ({ row, aspect })))
      .find(
        ({ row }) =>
          !chosen.includes(row) &&
          chosen.some((c) => c.entryId === row.entryId && c.card === row.card && c.sub === row.sub && c.part + 1 === row.part),
      );
    const fallback = focus
      .map((aspect) => ({ aspect, row: queues.get(aspect)!.find((r) => !chosen.includes(r)) }))
      .find((x) => x.row);
    const pick = continuation ?? (fallback?.row ? { row: fallback.row, aspect: fallback.aspect } : null);
    if (!pick) break;
    take(pick.row, pick.aspect);
  }

  const covered = chosen.length > 0 && focus.every((a) => answered.has(a));
  // Nothing answers what was asked about a named subject: offer that subject's own approved definition
  // as context (still covered:false) — never anything written to fill the gap.
  if (!chosen.length) {
    for (const source of sources.filter((s) => s.relation === "subject")) {
      const definition = records
        .filter((r) => r.entryId === source.entryId && r.aspect === "meaning")
        .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))[0];
      if (definition) chosen.push(definition);
    }
  }
  const lessons = chosen.map((row) => toItem(row, input.topicId));
  return { lessons, learning_request: { focus, covered } };
}
