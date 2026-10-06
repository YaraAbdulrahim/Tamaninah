/**
 * The journey, told in stages. The person discovers the meaning step by step:
 *   their words → a verse (its clause lit) → what the tafsir understands → a hadith → a Seerah scene
 *   → to learn more → how it all connects → their own du‘a → the next step.
 *
 * Every religious text is rendered verbatim from the payload, with its source. The bridges are the
 * team's curated product copy (or neutral defaults from copy.ts). Everything is in the DOM, in order,
 * from the first frame; motion only decides WHEN a stage lights up (as it scrolls into view, or on
 * «تابع»), never what is there. Reduced motion, or no IntersectionObserver, shows every stage static.
 */
import { Fragment, useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowSquareOut, CaretDown, Info, LockSimple, SealCheck } from "@phosphor-icons/react";
import type { Copy } from "@/copy";
import { arNum, bidi, filled, Lessons, isLesson, safeUrl, textLang, Understood, verseParts } from "@/ExperienceViews";
import { prefersReducedMotion } from "@/motion";
import {
  contentChip,
  hadithChip,
  highlightOf,
  leadOf,
  litRuns,
  markPieces,
  seerahChip,
  storyBeats,
  tafsirChip,
  verseChip,
  verseRuns,
  type Piece,
} from "@/journeyText";
import type { AnalyzeResult, ContentSource, GuidancePayload, VerifiedContent, VerifiedStory } from "../shared/experience/guidance";

type Base = { t: Copy; ar: boolean };
type Vars = CSSProperties & Record<`--${string}`, string | number>;

const Arrow = () => <ArrowLeft size={18} className="icon flip" aria-hidden="true" />;

/** Lit pieces of a verbatim text: plain strings, and spans for the curated light. */
const Lit = ({ pieces, cls = "lit" }: { pieces: Piece[]; cls?: string }) => (
  <>
    {pieces.map((p, i) =>
      p.lit ? (
        <span key={i} className={cls}>
          {p.text}
        </span>
      ) : (
        <Fragment key={i}>{p.text}</Fragment>
      ),
    )}
  </>
);

/** The stage's heading: a fine gold thread comes down from what came before and ends in a node. */
function StageHead({ id, text, cls = "" }: { id: string; text: string; cls?: string }) {
  return (
    <div className={`st__head ${cls}`}>
      <span className="st__thread" aria-hidden="true">
        <span className="st__dot" />
      </span>
      <h3 id={id} data-head="" tabIndex={-1} className="bridge rise" style={{ "--d": ".3s" } as Vars} {...bidi(text)}>
        {text}
      </h3>
    </div>
  );
}

/**
 * The source of a text, as a small chip hanging from it on a gold thread: «البقرة 2:286 · Quranpedia».
 * Links to the exact source page when there is one; the full source name is its tooltip.
 */
function SourceChip({
  parts,
  source,
  verified,
  t,
  lead,
  dark,
  d,
}: Base & { parts: string[]; source?: ContentSource; verified?: boolean; lead?: ReactNode; dark?: boolean; d: string }) {
  if (!parts.length) return null;
  const url = safeUrl(source?.url);
  // An all-Arabic label («صحيح البخاري · 2916») reads right to left on the English page too.
  const arabicOnly = parts.filter((p) => /\p{L}/u.test(p)).every((p) => textLang(p) === "ar");
  const label = (
    <>
      {verified && (
        <>
          <SealCheck size={16} className="icon src-chip__seal" aria-hidden="true" />
          <span className="sr-only">{t.verifiedSource}: </span>
        </>
      )}
      <span className="src-chip__t" {...(arabicOnly ? { lang: "ar", dir: "rtl" } : {})}>
        {parts.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <>
                {" "}
                <span aria-hidden="true">·</span>{" "}
              </>
            )}
            <bdi {...bidi(p)}>{p}</bdi>
          </Fragment>
        ))}
      </span>
    </>
  );
  const full = filled(source?.name) ? source.name : undefined;
  return (
    <div className={dark ? "src-pin src-pin--dark rise" : "src-pin rise"} style={{ "--d": d } as Vars}>
      <span className="src-pin__thread" aria-hidden="true" />
      <div className="src-pin__row">
        {lead}
        {url ? (
          <a className="src-chip" href={url} target="_blank" rel="noopener noreferrer" title={full}>
            {label}
            <ArrowSquareOut size={14} className="icon" aria-hidden="true" />
            <span className="sr-only">{t.newTab}</span>
          </a>
        ) : (
          <span className="src-chip" title={full}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

/** «تابع»: moves to the next stage (it lights up, takes focus, and scrolls into view). Never automatic. */
function GoOn({ t, next, onGo, d = ".9s" }: { t: Copy; next: string; onGo: () => void; d?: string }) {
  return (
    <div className="go-on rise" style={{ "--d": d } as Vars}>
      <button type="button" className="go-on__btn" aria-describedby={next} onClick={onGo}>
        <span>{t.continueLabel}</span>
        <CaretDown size={16} className="icon" aria-hidden="true" />
      </button>
    </div>
  );
}

/* ───────── 2 · the verse: segment by segment, then its clause lights up ───────── */

/** The verse as āyāt (numbered from the reference), each cut into short runs, the curated clause lit. */
function verseLayout(c: VerifiedContent) {
  const hl = highlightOf(c);
  let k = 0;
  const parts = verseParts(c.arabic, c.reference ?? "").map((p) => {
    const runs = litRuns(verseRuns(p.text), hl).map((pieces) => ({ pieces, i: k++ }));
    return { runs, n: p.n };
  });
  return { parts, runs: k };
}

function VerseStage({ c, t, ar }: Base & { c: VerifiedContent }) {
  const { parts } = verseLayout(c);
  return (
    <figure className="vfield rise" style={{ "--d": ".25s" } as Vars}>
      <span className="vfield__light" aria-hidden="true" />
      <p lang="ar" dir="rtl" className="verse verse--runs">
        {parts.map((p, pi) => (
          <Fragment key={pi}>
            {pi > 0 && " "}
            {p.runs.map((r) => (
              <span key={r.i} className="vr" style={{ "--i": r.i } as Vars}>
                <Lit pieces={r.pieces} />
              </span>
            ))}
            {p.n !== undefined && (
              <>
                {" "}
                <span className="ayah">{arNum(p.n)}</span>
              </>
            )}
          </Fragment>
        ))}
      </p>
      {!ar && filled(c.translation) && (
        <p lang="en" dir="ltr" className="verse-en vfield__after">
          “{c.translation}”
        </p>
      )}
      <SourceChip parts={verseChip(c)} source={c.source} verified={c.verified} t={t} ar={ar} d="calc(1.5s + var(--n) * .28s)" />
    </figure>
  );
}

/* ───────── 3 · the tafsir: its opening first, the full excerpt on request ───────── */

function TafsirStage({ c, t, ar }: Base & { c: VerifiedContent }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const lead = leadOf(c);
  const translated = !ar && filled(c.translation);
  return (
    <div className="aside rise" style={{ "--d": ".35s" } as Vars}>
      <p id={id} className="aside__text" {...bidi(c.arabic)}>
        {lead && !open ? lead : c.arabic}
      </p>
      {lead && (
        <button type="button" className="disclose" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          <span>{open ? t.showLess : t.showFullTafsir}</span>
        </button>
      )}
      {translated && (
        <p lang="en" dir="ltr" className="aside__en">
          {c.translation}
        </p>
      )}
      {!ar && !translated && textLang(c.arabic) === "ar" && <p className="note">{t.arabicOnly}</p>}
      <SourceChip parts={tafsirChip(c)} source={c.source} verified={c.verified} t={t} ar={ar} d=".8s" />
    </div>
  );
}

/* ───────── 4 · the hadith: its focal line, the full verbatim text on request ───────── */

function HadithStage({ c, x, t, ar }: Base & { c: VerifiedContent; x?: VerifiedContent | null }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const hl = highlightOf(c);
  const excerpt = !!hl && hl.trim() !== c.arabic.trim() && !open;
  const grade = c.provenance?.hadith?.grade;
  const translated = !ar && filled(c.translation);
  return (
    <div className="hq-wrap rise" style={{ "--d": ".35s" } as Vars}>
      <blockquote id={id} className={excerpt ? "hq hq--focal" : "hq"} {...bidi(c.arabic)}>
        {excerpt ? (
          <>
            <span className="hq__cue" aria-hidden="true">
              …
            </span>
            <span className="sr-only">{t.excerpt} </span>
            <span className="hq__line">{hl}</span>
            <span className="hq__cue" aria-hidden="true">
              …
            </span>
          </>
        ) : (
          <Lit pieces={markPieces(c.arabic, [hl])} />
        )}
      </blockquote>
      {!!hl && hl.trim() !== c.arabic.trim() && (
        <button type="button" className="disclose" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          <span>{open ? t.showLess : t.showFullHadith}</span>
        </button>
      )}
      {translated && !excerpt && (
        <p lang="en" dir="ltr" className="aside__en">
          {c.translation}
        </p>
      )}
      {!ar && !translated && textLang(c.arabic) === "ar" && <p className="note">{t.arabicOnly}</p>}
      <SourceChip
        parts={hadithChip(c)}
        source={c.source}
        verified={c.verified}
        t={t}
        ar={ar}
        d=".75s"
        lead={
          filled(grade) && (
            <span className="grade-tag">
              <span className="sr-only">{t.grade}: </span>
              <bdi {...bidi(grade)}>{grade}</bdi>
            </span>
          )
        }
      />
      {filled(c.place) && (
        <p className="src-where rise" style={{ "--d": ".85s" } as Vars} {...bidi(c.place)}>
          {c.place}
        </p>
      )}
      {x && filled(x.arabic) && (
        <div className="hx rise" style={{ "--d": "1s" } as Vars}>
          <span className="label--plain">{t.hadithExplanation}</span>
          <p className="aside__text" {...bidi(x.arabic)}>
            {x.arabic}
          </p>
          {!ar && filled(x.translation) && (
            <p lang="en" dir="ltr" className="aside__en">
              {x.translation}
            </p>
          )}
          <SourceChip parts={contentChip(x)} source={x.source} verified={x.verified} t={t} ar={ar} d="1.1s" />
        </div>
      )}
    </div>
  );
}

/* ───────── 5 · the Seerah: a short scene, beat after beat, its key words lit ───────── */

/** A horizon, low hills, a path and a rising light — line-art only. No person, face or figure. */
function SeerahSky() {
  return (
    <div className="sky" aria-hidden="true">
      <span className="sky__light" />
      <svg className="sky__art" viewBox="0 0 960 240" preserveAspectRatio="xMidYMax slice" focusable="false">
        <path className="sky__hill sky__hill--far" pathLength={1} d="M0 196 C 120 168, 220 160, 330 176 S 560 150, 690 168 S 880 178, 960 160" />
        <path className="sky__hill" pathLength={1} d="M0 214 C 150 190, 260 196, 380 206 S 600 186, 740 198 S 900 210, 960 196" />
        <path className="sky__horizon" pathLength={1} d="M0 226 H 960" />
        <path className="sky__path" pathLength={1} d="M480 240 C 470 232, 452 226, 470 218 S 500 206, 486 196 S 474 186, 482 178" />
        <g className="sky__stars">
          <circle cx="170" cy="58" r="1.6" />
          <circle cx="292" cy="96" r="1.2" />
          <circle cx="642" cy="44" r="1.4" />
          <circle cx="770" cy="88" r="1.1" />
          <circle cx="842" cy="40" r="1.6" />
        </g>
      </svg>
    </div>
  );
}

function SeerahStage({
  s,
  t,
  ar,
  headId,
  bridge,
  on,
  order,
}: Base & { s: VerifiedStory; headId: string; bridge: string; on: (key: string) => string; order: (key: string) => number }) {
  const beats = storyBeats(s);
  const quotes = (s.key_quotes ?? []).filter(filled);
  const arabic = textLang([s.title, s.opening, ...beats].filter(filled).join(" ")) === "ar";
  return (
    <div className="seerah">
      <SeerahSky />
      <div className="seerah__in">
        <StageHead id={headId} text={bridge} cls="st__head--dark" />
        {filled(s.title) && (
          <h4 className="seerah__title rise" style={{ "--d": ".7s" } as Vars} {...bidi(s.title)}>
            {s.title}
          </h4>
        )}
        {filled(s.opening) && (
          <p className="seerah__aside rise" style={{ "--d": ".9s" } as Vars} {...bidi(s.opening)}>
            {s.opening}
          </p>
        )}
        <div className="beats">
          {beats.map((b, i) => (
            <p
              key={i}
              data-reveal={`beat-${i}`}
              className={`beat ${on(`beat-${i}`)}`}
              style={{ "--o": `${order(`beat-${i}`)}s` } as Vars}
              {...bidi(b)}
            >
              <span className="beat__node" aria-hidden="true" />
              <span className="beat__t">
                <Lit pieces={markPieces(b, quotes)} cls="kq" />
              </span>
            </p>
          ))}
        </div>
        {filled(s.takeaway) && (
          <p className="seerah__aside" {...bidi(s.takeaway)}>
            {s.takeaway}
          </p>
        )}
        {filled(s.keep) && (
          <p className="seerah__aside" {...bidi(s.keep)}>
            {s.keep}
          </p>
        )}
        {!ar && arabic && <p className="note note--dark">{t.arabicOnly}</p>}
        {/* No grade here: the Seerah scene names its book and number only. */}
        <SourceChip parts={seerahChip(s)} source={s.source} verified={s.verified} t={t} ar={ar} dark d={afterBeats(beats.length)} />
      </div>
    </div>
  );
}

/* ───────── 7 · connection: what I feel → what I learn → what I can do now ───────── */

function ConnectStage({ points, step }: { points: [string, string, string]; step: { title?: string; description?: string } | null }) {
  return (
    <ol className="connect rise" style={{ "--d": ".4s" } as Vars}>
      {points.map((p, i) => (
        <li key={i} className="cpoint" style={{ "--i": i } as Vars}>
          <span className="cpoint__dot" aria-hidden="true" />
          <span className="cpoint__t" {...bidi(p)}>
            {p}
          </span>
          {i === 2 && step && (
            <span className="cpoint__step">
              {filled(step.title) && <strong {...bidi(step.title)}>{step.title}</strong>}
              {filled(step.description) && <span {...bidi(step.description)}>{step.description}</span>}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/* ───────── 8 · the ending: their own du‘a — never sent, never stored ───────── */

function DuaStage({
  t,
  headId,
  related,
  onEnd,
  onRelated,
}: { t: Copy; headId: string; related?: { title: string }; onEnd: () => void; onRelated?: () => void }) {
  // Lives only here, in memory: no name, no form, no storage, no request ever reads it; cleared on leaving.
  const [dua, setDua] = useState("");
  const subId = useId();
  const privId = useId();
  const leave = (go: () => void) => {
    setDua("");
    go();
  };
  return (
    <>
      <p id={subId} className="dua__sub rise" style={{ "--d": ".3s" } as Vars}>
        {t.duaSub}
      </p>
      <div className="dua__box rise" style={{ "--d": ".5s", "--k": Math.min(1, dua.trim().length / 120) } as Vars}>
        <textarea
          className="dua__text"
          aria-labelledby={headId}
          aria-describedby={`${subId} ${privId}`}
          placeholder={t.duaPlaceholder}
          value={dua}
          onChange={(e) => setDua(e.target.value)}
          rows={5}
          autoComplete="off"
          spellCheck={false}
          dir={dua ? "auto" : undefined}
        />
      </div>
      <p id={privId} className="dua__privacy rise" style={{ "--d": ".65s" } as Vars}>
        <LockSimple size={16} className="icon" aria-hidden="true" />
        <span>{t.duaPrivacy}</span>
      </p>
      <div className="dua__next rise" style={{ "--d": ".8s" } as Vars}>
        <button type="button" className="btn-primary btn-primary--ring" onClick={() => leave(onEnd)}>
          <span>{t.endJourney}</span>
          <Arrow />
        </button>
        {related && onRelated && (
          <button type="button" className="btn-link dua__rel" onClick={() => leave(onRelated)}>
            <span>{t.nextPath}: </span>
            <bdi {...bidi(related.title)}>{related.title}</bdi>
          </button>
        )}
      </div>
    </>
  );
}

/* ───────── the staged journey ───────── */

const canStage = () => typeof IntersectionObserver === "function" && !prefersReducedMotion();

type Mode = "on" | "quick";
/** How a stage (or beat) lit: fully or at once, when (ms), and — for a beat — how long it waits (s). */
type Lit = { m: Mode; t: number; o: number };

/** A scene unfolds in order: its beats follow the title (~1 s after the scene lights), one after another. */
const BEAT_AFTER_SCENE = 1000;
const BEAT_STEP = 650;
/** …and its source arrives after the last beat. */
const afterBeats = (n: number) => `${((BEAT_AFTER_SCENE + n * BEAT_STEP) / 1000 + 0.4).toFixed(2)}s`;

export function GuidanceResult({
  analyze,
  payload,
  t,
  ar,
  onNext,
  onRestart,
  scrollTo,
}: Base & {
  analyze: AnalyzeResult | null;
  payload: GuidancePayload;
  /** Opens the next related topic's journey (null when there is no analyze reading to build on). */
  onNext: ((topicId: string) => void) | null;
  /** Back to «وش يشغلك اليوم؟», composer focused. */
  onRestart: () => void;
  /** Brings a stage into view (the page's smooth scroller when it runs). */
  scrollTo?: (el: HTMLElement) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const base = useId();
  const hid = (k: string) => `${base}-${k}`;
  const [staged] = useState(canStage);
  const [lit, setLit] = useState<Record<string, Lit>>({});

  const reading = [analyze?.context_summary, payload.heading, payload.context].find(filled)?.trim();
  const b = payload.bridges ?? {};
  const bridge = (v: string | undefined, d: string) => (filled(v) ? v.trim() : d);
  const cp = b.connect;
  const connect =
    cp && filled(cp.title) && Array.isArray(cp.points) && cp.points.length === 3 && cp.points.every(filled)
      ? { title: cp.title.trim(), points: cp.points }
      : { title: t.connectTitle, points: t.connectPoints };
  const step = payload.suggested_action;
  const showStep = step && (filled(step.title) || filled(step.description)) ? step : null;
  const related = onNext ? payload.related_topics?.find((r) => filled(r.id) && filled(r.title)) : undefined;
  const lessons = (payload.lessons ?? []).filter(isLesson);
  // The person asked to learn more, and the approved content does not reliably cover it: say so.
  const gap = payload.learning_request?.covered === false;
  const story = payload.story && storyBeats(payload.story).length ? payload.story : null;

  // The stages present, in order — each «تابع» leads to the next one.
  const keys = [
    reading && "you",
    payload.content && "verse",
    payload.quran_explanation && "tafsir",
    payload.hadith && "hadith",
    story && "seerah",
    (lessons.length > 0 || gap) && "more",
    "connect",
    "dua",
  ].filter((k): k is string => !!k);
  const nextOf = (k: string) => keys[keys.indexOf(k) + 1];

  const on = (k: string) => (!staged || lit[k] ? (lit[k]?.m === "quick" ? "is-on is-quick" : "is-on") : "");
  /** How long a beat waits once lit, so the scene keeps its order however fast it is scrolled into. */
  const order = (k: string) => lit[k]?.o ?? 0;
  const reveal = (ks: string[], mode: Mode) =>
    setLit((o) => {
      const fresh = ks.filter((k) => !o[k]);
      if (!fresh.length) return o;
      const now = performance.now();
      const n = { ...o };
      for (const k of fresh) {
        const beat = /^beat-(\d+)$/.exec(k);
        const scene = n.seerah?.t ?? now;
        const wait = beat && mode === "on" ? Math.max(0, scene + BEAT_AFTER_SCENE + Number(beat[1]) * BEAT_STEP - now) / 1000 : 0;
        n[k] = { m: mode, t: now, o: Math.round(wait * 100) / 100 };
      }
      return n;
    });

  // Each stage (and each Seerah beat) lights up once, when enough of it is in view to be read as it
  // appears: 40% of it, or — for a stage taller than that — 45% of the screen.
  useEffect(() => {
    const root = rootRef.current;
    if (!staged || !root) return;
    const enough = (e: IntersectionObserverEntry) =>
      e.isIntersecting &&
      e.intersectionRect.height >= Math.min(e.boundingClientRect.height * 0.4, window.innerHeight * 0.45) - 1;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter(enough).map((e) => e.target as HTMLElement);
        hit.forEach((el) => io.unobserve(el));
        if (hit.length) reveal(hit.map((el) => el.dataset.reveal!), "on");
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
    );
    root.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [staged]);

  // Keyboard and screen-reader users who move into a stage before it lit see it at once. (Stage headings
  // only take focus programmatically — on «تابع» or a new result — and those keep the full reveal.)
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!staged || target.hasAttribute("data-head")) return;
    const st = target.closest<HTMLElement>("[data-stage]");
    if (!st?.dataset.reveal || lit[st.dataset.reveal]) return;
    const inner = [...st.querySelectorAll<HTMLElement>("[data-reveal]")].map((el) => el.dataset.reveal!);
    reveal([st.dataset.reveal, ...inner], "quick");
  };

  const go = (k: string | undefined) => () => {
    const el = k ? rootRef.current?.querySelector<HTMLElement>(`[data-stage="${k}"]`) : null;
    if (!el || !k) return;
    reveal([k], "on");
    el.querySelector<HTMLElement>("[data-head]")?.focus({ preventScroll: true });
    if (scrollTo) scrollTo(el);
    else el.scrollIntoView?.({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  };

  const goOn = (k: string, d?: string) => {
    const n = nextOf(k);
    return n ? <GoOn t={t} next={hid(n)} onGo={go(n)} d={d} /> : null;
  };

  const stage = (k: string, children: ReactNode, extra = "", style?: Vars) => (
    <div
      data-stage={k}
      data-reveal={k === "you" ? undefined : k}
      className={`st st--${k} ${extra} ${k === "you" ? "is-on" : on(k)}`}
      style={style}
    >
      {children}
    </div>
  );

  return (
    <div ref={rootRef} className={staged ? "result jr jr--staged" : "result jr"} onFocus={onFocus}>
      {reading &&
        stage(
          "you",
          <>
            <Understood text={reading} t={t} rv="result" focus="result" />
            {goOn("you", "0s")}
          </>,
        )}

      {payload.content &&
        stage(
          "verse",
          <>
            <StageHead id={hid("verse")} text={bridge(b.quran, t.bridgeQuran)} />
            <VerseStage c={payload.content} t={t} ar={ar} />
            {goOn("verse", "calc(2.1s + var(--n) * .28s)")}
          </>,
          "st--peak",
          { "--n": verseLayout(payload.content).runs },
        )}

      {payload.quran_explanation &&
        stage(
          "tafsir",
          <>
            <StageHead id={hid("tafsir")} text={bridge(b.tafsir, t.bridgeTafsir)} />
            <TafsirStage c={payload.quran_explanation} t={t} ar={ar} />
            {goOn("tafsir", "1.1s")}
          </>,
        )}

      {payload.hadith &&
        stage(
          "hadith",
          <>
            <StageHead id={hid("hadith")} text={bridge(b.hadith, t.bridgeHadith)} />
            <HadithStage c={payload.hadith} x={payload.hadith_explanation} t={t} ar={ar} />
            {goOn("hadith", "1.1s")}
          </>,
        )}

      {story &&
        stage(
          "seerah",
          <>
            <SeerahStage
              key={story.story_id}
              s={story}
              t={t}
              ar={ar}
              headId={hid("seerah")}
              bridge={bridge(b.seerah, t.bridgeSeerah)}
              on={on}
              order={order}
            />
            {goOn("seerah", `calc(${afterBeats(storyBeats(story).length)} + .4s)`)}
          </>,
          "st--peak",
        )}

      {(lessons.length > 0 || gap) &&
        stage(
          "more",
          <>
            <span className="st__thread st__thread--quiet" aria-hidden="true">
              <span className="st__dot" />
            </span>
            {lessons.length > 0 && <Lessons lessons={lessons} t={t} ar={ar} headId={hid("more")} />}
            {gap && (
              <div role="note" className="gap-note rise" style={{ "--d": ".4s" } as Vars}>
                <Info size={20} className="icon" aria-hidden="true" />
                {lessons.length ? (
                  <p>{t.gapNote}</p>
                ) : (
                  <p id={hid("more")} data-head="" tabIndex={-1}>
                    {t.gapNote}
                  </p>
                )}
              </div>
            )}
            {goOn("more", ".8s")}
          </>,
        )}

      {stage(
        "connect",
        <>
          <StageHead id={hid("connect")} text={connect.title} cls="st__head--big" />
          <ConnectStage points={connect.points} step={showStep} />
          {goOn("connect", "2.2s")}
        </>,
      )}

      {stage(
        "dua",
        <>
          <StageHead id={hid("dua")} text={t.duaTitle} cls="st__head--big" />
          <DuaStage
            t={t}
            headId={hid("dua")}
            related={related}
            onEnd={onRestart}
            onRelated={related && onNext ? () => onNext(related.id) : undefined}
          />
        </>,
      )}
    </div>
  );
}
