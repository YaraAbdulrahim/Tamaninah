/**
 * Text as words, for the signature entrances. Splits on spaces only — Arabic letters stay joined inside
 * each word — and keeps the real spaces between them, so the text reads, wraps and selects exactly as
 * plain text does and screen readers hear the same sentence. Marked phrases (found by substring, so the
 * copy itself never changes) are grouped in one unbreakable span with a hand-drawn underline or a
 * highlight band. Every decoration is aria-hidden and starts in its final state; motion.ts animates from it.
 */
import { Fragment, type ReactNode } from "react";

export type Mark = { text: string; kind: "underline" | "highlight" };

type Props = {
  text: string;
  marks?: Mark[];
  /** false: keep plain text runs (only the marks become spans). */
  split?: boolean;
  /** A small gold node under each word («كل كلمة لها مصدر»). */
  node?: boolean;
};

/** A gentle hand-drawn stroke, drawn from the start of the reading direction (flipped in LTR by CSS). */
const UNDERLINE = "M197 9 C 166 4, 132 12, 98 8 S 40 4, 3 10";

export function Words({ text, marks = [], split = true, node = false }: Props) {
  // Where each mark sits, widened to whole words (so trailing punctuation never wraps away from it);
  // a mark that is not found simply isn't drawn.
  const spans = marks
    .map((m) => ({ kind: m.kind, found: text.indexOf(m.text), len: m.text.length }))
    .filter((m) => m.found >= 0)
    .map((m) => {
      const start = text.lastIndexOf(" ", m.found - 1) + 1;
      const next = text.indexOf(" ", m.found + m.len);
      const end = next < 0 ? text.length : next;
      return { kind: m.kind, start, end, text: text.slice(start, end) };
    })
    .sort((a, b) => a.start - b.start);

  const word = (w: string, key: number) => (
    <span key={key} className="w">
      <span className="w__i">{w}</span>
      {node && (
        <>
          <span aria-hidden="true" className="w__glow" />
          <span aria-hidden="true" className="w__node" />
        </>
      )}
    </span>
  );

  /** A run of text (no marks inside): split into word spans with real spaces, or left as one text node. */
  const run = (s: string, base: number): ReactNode => {
    if (!split) return s;
    const parts = s.split(" ");
    return parts.map((w, i) => (
      <Fragment key={base + i}>
        {i > 0 && " "}
        {w && word(w, base + i)}
      </Fragment>
    ));
  };

  const out: ReactNode[] = [];
  let at = 0;
  spans.forEach((m, k) => {
    if (m.start < at) return; // overlapping marks: keep the first
    if (m.start > at) out.push(<Fragment key={`t${k}`}>{run(text.slice(at, m.start), at * 100)}</Fragment>);
    out.push(
      <span key={`m${k}`} className={`mk mk--${m.kind}`}>
        {m.kind === "highlight" && <span aria-hidden="true" data-a="mk-bg" className="mk__bg" />}
        {run(m.text, m.start * 100)}
        {m.kind === "underline" && (
          <svg aria-hidden="true" viewBox="0 0 200 14" preserveAspectRatio="none" className="mk__line">
            <path data-a="mk-line" pathLength={1} d={UNDERLINE} />
          </svg>
        )}
      </span>,
    );
    at = m.end;
  });
  if (at < text.length) out.push(<Fragment key="tail">{run(text.slice(at), at * 100)}</Fragment>);
  return <>{out}</>;
}
