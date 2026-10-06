/**
 * Screens of the experience section. Everything religious rendered here comes from the
 * /api/understand response (verified catalog, with its source); interface strings come from copy.ts.
 */
import { Fragment, useId, useState, type ReactNode } from "react";
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowSquareOut,
  BookOpenText,
  HeartStraight,
  Lifebuoy,
  PencilSimple,
  Quotes,
  Scales,
  Sparkle,
} from "@phosphor-icons/react";
import type { Copy, Lang } from "@/copy";
import { approvedSources, HELPLINE_URL } from "@/copy";
import type { KnowledgeAnswer, SourcePointer } from "../shared/experience/api";
import type {
  AnalyzeResult,
  ContentSource,
  LessonItem,
  ReferralPayload,
  SuggestedTopic,
} from "../shared/experience/guidance";
import type { ClientError } from "@/understand";

type Base = { t: Copy; ar: boolean };

/* ───────── text helpers ───────── */

const AR_CHARS = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
const LATIN_CHARS = /[A-Za-z]/g;

/** Language of a returned string, so mixed RTL/LTR content keeps its own direction and font. */
export function textLang(s: string): Lang {
  const a = s.match(AR_CHARS)?.length ?? 0;
  const l = s.match(LATIN_CHARS)?.length ?? 0;
  return a > 0 && a >= l ? "ar" : "en";
}

export const bidi = (s: string) => {
  const lang = textLang(s);
  return { lang, dir: lang === "ar" ? "rtl" : "ltr" } as const;
};

export const filled = (s: string | null | undefined): s is string => typeof s === "string" && s.trim() !== "";

/** Only http(s) links from the server are rendered as links. */
export const safeUrl = (u: string | undefined) => (u && /^https?:\/\//i.test(u) ? u : undefined);

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const arNum = (n: number) => String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);

/**
 * Splits a verse on the catalog's «۝» separators and numbers each āyah from the returned reference
 * (e.g. "94:5-6"). If the two don't line up exactly, the text is shown untouched.
 */
export function verseParts(arabic: string, reference: string): { text: string; n?: number }[] {
  const m = /^\s*\d+\s*:\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*$/.exec(reference);
  if (!m) return [{ text: arabic }];
  const from = Number(m[1]);
  const to = m[2] ? Number(m[2]) : from;
  const segs = arabic
    .split("۝")
    .map((s) => s.trim())
    .filter(Boolean);
  if (to < from || segs.length !== to - from + 1) return [{ text: arabic }];
  return segs.map((text, i) => ({ text, n: from + i }));
}

const Arrow = () => <ArrowLeft size={18} className="icon flip" aria-hidden="true" />;

/* ───────── shared pieces ───────── */

function ExternalLink({ href, className, children, t }: { href: string; className?: string; children: ReactNode; t: Copy }) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowSquareOut size={14} className="icon" aria-hidden="true" />
      <span className="sr-only">{t.newTab}</span>
    </a>
  );
}

/** Source line under every catalog card: what it is (place · reference) and where it comes from. */
function Ref({ parts, source, t }: { parts: (string | undefined)[]; source?: ContentSource; t: Copy }) {
  const what = [...new Set(parts.filter(filled).map((p) => p.trim()))];
  const url = safeUrl(source?.url);
  const name = source?.name;
  return (
    <div className="ref ref--meta">
      <BookOpenText size={20} className="icon" aria-hidden="true" />
      {what.length > 0 && (
        <span className="ref__what">
          {what.map((p, i) => (
            <Fragment key={i}>
              {i > 0 && " · "}
              <bdi {...bidi(p)}>{p}</bdi>
            </Fragment>
          ))}
        </span>
      )}
      {filled(name) && (
        <span className="ref__src">
          {t.source}:{" "}
          {url ? (
            <ExternalLink href={url} className="src-link" t={t}>
              <bdi>{name}</bdi>
            </ExternalLink>
          ) : (
            <bdi>{name}</bdi>
          )}
        </span>
      )}
    </div>
  );
}

/** The AI's reading of the person's words — always tagged as generated, never as source text. */
export function Understood({ text, t, rv, focus }: { text: string; t: Copy; rv: string; focus?: string }) {
  return (
    <div data-rv={rv} className="understood">
      <span aria-hidden="true" className="understood__dot" />
      <div className="stack4">
        <div className="understood__top">
          <h3 className="label--plain understood__h" data-focus={focus}>
            {t.understood}
          </h3>
          <span className="ai-tag">
            <Sparkle size={13} className="icon" aria-hidden="true" />
            <span>{t.aiReading}</span>
          </span>
        </div>
        <p {...bidi(text)}>{text}</p>
      </div>
    </div>
  );
}

/* ───────── 02 · thinking ───────── */

export function Thinking({ line }: { line: string }) {
  return (
    <div role="status" aria-live="polite" data-rv="thinking" data-focus="thinking" tabIndex={-1} className="thinking">
      <span aria-hidden="true" className="thinking__orb">
        <span data-a="think" />
      </span>
      <p>{line}</p>
    </div>
  );
}

/* ───────── topic discovery ───────── */

export function TopicChoice({ analyze, t, onPick }: Base & { analyze: AnalyzeResult; onPick: (topic: SuggestedTopic) => void }) {
  const reading = analyze.context_summary?.trim();
  return (
    <div className="result">
      {reading && <Understood text={reading} t={t} rv="topics" focus="topics" />}
      <div className="topics">
        <div data-rv="topics" className="stack4">
          <h3 className="topics__h" data-focus={reading ? undefined : "topics"}>
            {t.topicsTitle}
          </h3>
          <p className="topics__note">{t.topicsNote}</p>
        </div>
        <ul className="topics__list">
          {analyze.suggested_topics.map((tp) => (
            <li key={tp.id} data-rv="topics">
              <button type="button" className="topic" onClick={() => onPick(tp)}>
                <span className="topic__txt">
                  <span className="topic__t" {...bidi(tp.title)}>
                    {tp.title}
                  </span>
                  {filled(tp.reason) && (
                    <span className="topic__r" {...bidi(tp.reason)}>
                      {tp.reason}
                    </span>
                  )}
                </span>
                <Arrow />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───────── «لتتعلّم أكثر» (used by the staged journey in Journey.tsx) ───────── */

/** Bodies longer than this start folded, with «اقرأ المزيد». */
const LONG_LESSON = 420;

/** One verbatim section from an approved source, for what the person asked to learn. */
function LessonCard({ l, t, ar }: Base & { l: LessonItem }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const title = ((ar ? l.title_ar : l.title_en) || l.title_ar || l.title_en).trim();
  const long = l.body_ar.length > LONG_LESSON;
  return (
    <article className="card card--lesson rise">
      <div className="card__top">
        <h4 className="lesson__h" {...bidi(title)}>
          {title}
        </h4>
        <span className="badge badge--soft">
          <Quotes size={14} className="icon" aria-hidden="true" />
          <span>{t.lessonBadge}</span>
        </span>
      </div>
      <blockquote id={bodyId} {...bidi(l.body_ar)} className={long && !open ? "source-quote lesson__body is-folded" : "source-quote lesson__body"}>
        {l.body_ar}
      </blockquote>
      {long && (
        <button
          type="button"
          className="btn-link story-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          <span>{open ? t.readLess : t.readMore}</span>
        </button>
      )}
      {!ar && textLang(l.body_ar) === "ar" && <p className="note">{t.arabicOnly}</p>}
      <Ref parts={[l.source?.reference]} source={l.source} t={t} />
    </article>
  );
}

/** «لتتعلّم أكثر»: extra verbatim sections, after the core journey and clearly secondary to it. */
export function Lessons({ lessons, t, ar, headId: given }: Base & { lessons: LessonItem[]; headId?: string }) {
  const own = useId();
  const headId = given ?? own;
  return (
    <div className="lessons" role="group" aria-labelledby={headId}>
      <div className="lessons__head rise">
        <h3 id={headId} data-head="" tabIndex={-1} className="lessons__h">
          {t.lessonsTitle}
        </h3>
        <p className="note">{t.lessonsNote}</p>
      </div>
      {lessons.map((l, i) => (
        <LessonCard key={l.id || i} l={l} t={t} ar={ar} />
      ))}
    </div>
  );
}

export const isLesson = (l: LessonItem | null | undefined): l is LessonItem =>
  !!l && filled(l.body_ar) && (filled(l.title_ar) || filled(l.title_en)) && !!l.source && filled(l.source.name);

/* ───────── knowledge answer ───────── */

export function KnowledgeView({ analyze, answer: a, t, ar }: Base & { analyze: AnalyzeResult | null; answer: KnowledgeAnswer }) {
  const reading = analyze?.context_summary?.trim();
  const title = (ar ? a.title_ar : a.title_en) || a.title_ar || a.title_en;
  const url = safeUrl(a.source.url);
  return (
    <div className="result">
      {reading && <Understood text={reading} t={t} rv="knowledge" focus="knowledge" />}
      <article data-rv="knowledge" className="card card--verse card--know">
        <div className="card__top">
          <span className="label--plain">{a.kind === "glossary" ? t.knowGlossary : t.knowQa}</span>
          <span className="badge">
            <Quotes size={14} className="icon" aria-hidden="true" />
            <span>{t.sourceText}</span>
          </span>
        </div>
        {filled(title) && (
          <h3 className="card__h" data-focus={reading ? undefined : "knowledge"} {...bidi(title)}>
            {title}
          </h3>
        )}
        {a.kind === "glossary" && filled(a.term_en) && (
          <p className="term">
            <span className="label--plain">{t.termEn}</span>
            <span lang="en" dir="ltr" className="term__en">
              {a.term_en}
            </span>
          </p>
        )}
        <blockquote lang="ar" dir="rtl" className="source-quote">
          {a.body_ar}
        </blockquote>
        {a.kind === "qa" && <p className="note">{t.excerptNote}</p>}
        {!ar &&
          (filled(a.body_en) ? (
            <p lang="en" dir="ltr" className="card__p card__p--en">
              {a.body_en}
            </p>
          ) : (
            <p className="note">{t.arabicOnly}</p>
          ))}
        <Ref parts={[a.source.reference]} source={{ name: a.source.name }} t={t} />
        {url && (
          <ExternalLink href={url} className="src-link src-link--open" t={t}>
            <span>{t.openSource}</span>
          </ExternalLink>
        )}
      </article>
    </div>
  );
}

/** Where the approved sources say to look for this domain (label, the PDF's usage rule, links). */
function PointerBlock({ pointer, lead, t, ar }: Base & { pointer?: SourcePointer; lead: string }) {
  if (!pointer) return null;
  const label = (ar ? pointer.label_ar : pointer.label_en) || pointer.label_ar;
  const links = (pointer.sources ?? []).filter((s) => filled(s.name) && safeUrl(s.url));
  if (!filled(label) && !links.length) return null;
  return (
    <div className="pointer">
      <span className="label--plain">{lead}</span>
      {filled(label) && <strong className="pointer__t">{label}</strong>}
      {ar && filled(pointer.rule_ar) && (
        <p lang="ar" dir="rtl" className="pointer__rule">
          {pointer.rule_ar}
        </p>
      )}
      {links.length > 0 && (
        <ul className="pointer__links">
          {links.map((s) => (
            <li key={s.url}>
              <ExternalLink href={s.url} className="chip chip--link" t={t}>
                <bdi>{s.name}</bdi>
              </ExternalLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────── referral ───────── */

export function ReferralView({
  referral,
  pointer,
  t,
  ar,
}: Base & { referral: ReferralPayload | null; pointer?: SourcePointer }) {
  if (referral?.reason === "self_harm") {
    return (
      <div className="result">
        <article data-rv="referral" className="card card--care">
          <HeartStraight size={30} className="icon care__icon" aria-hidden="true" />
          <h3 className="care__h" data-focus="referral">
            {t.careTitle}
          </h3>
          {t.careBody.map((p) => (
            <p key={p} className="card__p">
              {p}
            </p>
          ))}
          <p className="care__action">{t.careAction}</p>
          <p className="card__p">{t.careEmergency}</p>
          <a className="btn-primary care__btn" href={HELPLINE_URL} target="_blank" rel="noopener noreferrer">
            <Lifebuoy size={20} className="icon" aria-hidden="true" />
            <span>{t.careHelpline}</span>
            <span className="sr-only">{t.newTab}</span>
          </a>
        </article>
      </div>
    );
  }
  const returned = referral?.message;
  const message = filled(returned) ? returned : t.referFallback;
  return (
    <div className="result">
      <article data-rv="referral" className="card card--story">
        <h3 className="card__h" data-focus="referral">
          {t.referTitle}
        </h3>
        <p className="card__p" {...bidi(message)}>
          {message}
        </p>
        <div className="refer-note">
          <Scales size={22} className="icon" aria-hidden="true" />
          <p>{t.referNote}</p>
        </div>
        <PointerBlock pointer={pointer} lead={t.pointerLeadRefer} t={t} ar={ar} />
      </article>
    </div>
  );
}

/* ───────── honest gaps and errors ───────── */

export function InsufficientView({ pointer, t, ar, onEdit }: Base & { pointer?: SourcePointer; onEdit: () => void }) {
  return (
    <div className="result">
      <article data-rv="insufficient" className="card card--story">
        <span className="label--plain">{t.insuffLabel}</span>
        <h3 className="card__h" data-focus="insufficient">
          {t.insuffTitle}
        </h3>
        <p className="card__p">{t.insuffBody}</p>
        <PointerBlock pointer={pointer} lead={t.pointerLead} t={t} ar={ar} />
        <div className="card__acts">
          <button type="button" className="btn-link" onClick={onEdit}>
            <span>{t.rephrase}</span>
          </button>
        </div>
      </article>
    </div>
  );
}

export function UnclearView({ t, onEdit }: Base & { onEdit: () => void }) {
  return (
    <div className="result">
      <article data-rv="unclear" className="card card--story">
        <h3 className="card__h" data-focus="unclear">
          {t.unclearTitle}
        </h3>
        <p className="card__p">{t.unclearBody}</p>
        <div className="card__acts">
          <button type="button" className="btn-primary" onClick={onEdit}>
            <span>{t.writeMore}</span>
            <PencilSimple size={18} className="icon" aria-hidden="true" />
          </button>
        </div>
      </article>
    </div>
  );
}

export function ErrorView({ error, t, onRetry }: Base & { error: ClientError; onRetry: () => void }) {
  return (
    <div className="result">
      <article data-rv="error" className="card card--story">
        <h3 className="card__h" data-focus="error">
          {t.errorTitle}
        </h3>
        <p className="card__p">{error === "rate" ? t.errorRate : t.errorBody}</p>
        <div className="card__acts">
          <button type="button" className="btn-primary" onClick={onRetry}>
            <span>{t.retry}</span>
            <ArrowClockwise size={18} className="icon" aria-hidden="true" />
          </button>
        </div>
      </article>
    </div>
  );
}

/* ───────── footer sheets ───────── */

export type SheetKind = "sources" | "privacy" | "terms";

export function SheetBody({ kind, t, ar }: Base & { kind: SheetKind }) {
  if (kind === "sources") {
    return (
      <>
        <p className="sheet__p">{t.sourcesIntro}</p>
        <ul className="sources">
          {approvedSources.map((s) => (
            <li key={s.en}>
              <strong>{ar ? s.ar : s.en}</strong>
              {(ar ? s.noteAr : s.noteEn) && <span className="sources__note">{ar ? s.noteAr : s.noteEn}</span>}
              <span className="sources__links">
                {s.links.map((l) => (
                  <ExternalLink key={l.url} href={l.url} className="src-link" t={t}>
                    <bdi lang="en" dir="ltr">
                      {l.label}
                    </bdi>
                  </ExternalLink>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </>
    );
  }
  const body = kind === "privacy" ? t.privacyBody : t.termsBody;
  return (
    <>
      {body.map((p) => (
        <p key={p} className="sheet__p">
          {p}
        </p>
      ))}
    </>
  );
}
