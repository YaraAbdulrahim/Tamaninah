import { Fragment, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Words, type Mark } from "@/Words";
import { ArrowLeft, ChatCircleText, LockSimple, PencilSimple, SealCheck, ShieldCheck, Sparkle, Translate, X } from "@phosphor-icons/react";
import { chipList, copy, type Lang } from "@/copy";
import {
  gsap,
  prefersReducedMotion,
  sceneMotion,
  scrollToSection,
  ScrollTrigger,
  startSmoothScroll,
  type Smooth,
} from "@/motion";
import {
  CLIENT_TIMEOUT_MS,
  composeMessage,
  interpret,
  learningFocus,
  postUnderstand,
  type ClientError,
  type Outcome,
} from "@/understand";
import { GuidanceResult } from "@/Journey";
import {
  ErrorView,
  InsufficientView,
  KnowledgeView,
  ReferralView,
  SheetBody,
  Thinking,
  TopicChoice,
  UnclearView,
  type SheetKind,
} from "@/ExperienceViews";
import type { KnowledgeAnswer, SourcePointer, UnderstandRequestBody } from "../shared/experience/api";
import type { AnalyzeResult, GuidancePayload, ReferralPayload } from "../shared/experience/guidance";

/**
 * The experience state machine.
 *   empty ──send──▶ thinking(analyze) ──▶ topics ──pick──▶ thinking(journey) ──▶ result ──▶ done
 *                                     ├─▶ result (direct_learning)      result ──next path──▶ thinking(journey)
 *                                     ├─▶ knowledge
 *                                     ├─▶ referral (self_harm «أنت مهم» · level_d · level_c)
 *                                     └─▶ insufficient · unclear · error ──retry──▶ thinking
 * «عدّل» from any state aborts the request in flight and returns to empty with the words kept.
 */
type View =
  | { step: "empty" }
  | { step: "thinking"; phase: UnderstandRequestBody["stage"] }
  | { step: "topics"; analyze: AnalyzeResult }
  | { step: "result"; analyze: AnalyzeResult | null; payload: GuidancePayload }
  | { step: "knowledge"; analyze: AnalyzeResult | null; answer: KnowledgeAnswer }
  | { step: "referral"; referral: ReferralPayload | null; pointer?: SourcePointer }
  | { step: "insufficient"; pointer?: SourcePointer }
  | { step: "unclear" }
  | { step: "error"; error: ClientError };

type Step = View["step"];

/** Steps where the field behind the section settles after thinking. */
const SETTLED: ReadonlySet<Step> = new Set<Step>(["topics", "result", "knowledge", "referral", "insufficient", "unclear", "error"]);

function viewFor(out: Outcome): View {
  switch (out.kind) {
    case "topics":
      return { step: "topics", analyze: out.analyze };
    case "learning":
      return { step: "result", analyze: out.analyze, payload: out.payload };
    case "knowledge":
      return { step: "knowledge", analyze: out.analyze, answer: out.answer };
    case "referral":
      return { step: "referral", referral: out.referral, pointer: out.pointer };
    case "insufficient":
      return { step: "insufficient", pointer: out.pointer };
    case "unclear":
      return { step: "unclear" };
    case "error":
      return { step: "error", error: out.error };
  }
}

const radial = (stops: string) => `radial-gradient(circle,${stops})`;

// Hero: a field of lights at different depths
const heroOrbs: { depth: string; style: CSSProperties }[] = [
  { depth: "1", style: { width: "min(48vw,560px)", top: "-14%", insetInlineEnd: "-8%", background: radial("rgba(232,220,200,1) 0%,rgba(232,220,200,.4) 40%,rgba(232,220,200,0) 68%") } },
  { depth: ".6", style: { width: "min(36vw,420px)", bottom: "-12%", insetInlineStart: "-6%", background: radial("rgba(138,151,128,.32) 0%,rgba(138,151,128,0) 66%") } },
  { depth: ".8", style: { width: "min(26vw,320px)", top: "38%", insetInlineStart: "-8%", background: radial("rgba(232,220,200,.8) 0%,rgba(232,220,200,0) 66%") } },
  { depth: "1.4", style: { width: "min(18vw,220px)", top: "16%", insetInlineStart: "12%", background: radial("rgba(196,163,90,.3) 0%,rgba(196,163,90,0) 66%") } },
  { depth: "1.8", style: { width: 140, top: "64%", insetInlineEnd: "16%", background: radial("#FFFCF7 0%,rgba(243,227,190,.8) 26%,rgba(232,220,200,0) 66%") } },
  { depth: "2.2", style: { width: 92, top: "24%", insetInlineEnd: "28%", background: radial("rgba(196,163,90,.42) 0%,rgba(196,163,90,0) 66%") } },
  { depth: "2.6", style: { width: 62, bottom: "20%", insetInlineStart: "30%", background: radial("rgba(138,151,128,.5) 0%,rgba(138,151,128,0) 66%") } },
  { depth: "3", style: { width: 36, top: "13%", insetInlineStart: "44%", background: radial("#FFFCF7 0%,rgba(196,163,90,.6) 30%,rgba(196,163,90,0) 66%") } },
  { depth: "3.4", style: { width: 26, bottom: "30%", insetInlineEnd: "38%", background: radial("#FFFCF7 0%,rgba(196,163,90,.7) 30%,rgba(196,163,90,0) 66%") } },
];

const phraseOrbs = [
  radial("rgba(243,227,190,.95) 0%,rgba(232,220,200,.5) 36%,rgba(232,220,200,0) 68%"),
  radial("rgba(138,151,128,.38) 0%,rgba(138,151,128,.12) 40%,rgba(138,151,128,0) 68%"),
  radial("rgba(196,163,90,.4) 0%,rgba(196,163,90,.12) 40%,rgba(196,163,90,0) 68%"),
];

// Desktop rail: four stations evenly spaced along the curve M900 90 Q500 270 100 90 (viewBox 1000×260).
// x runs linearly with t (x = 900 − 800t), so equal steps in t are equal steps across; y = 90 + 360·t(1−t).
const stationPos: [string, string][] = [
  ["10%", "34.62%"],
  ["36.67%", "65.38%"],
  ["63.33%", "65.38%"],
  ["90%", "34.62%"],
];

// Story gateway: scattered lights [inline-start %, top %, size px, gradient]
const gatherLights: [string, string, number, string][] = [
  ["8%", "14%", 46, "#FFFCF7 0%,rgba(196,163,90,.55) 32%,rgba(196,163,90,0) 70%"],
  ["22%", "72%", 30, "rgba(138,151,128,.7) 0%,rgba(138,151,128,0) 70%"],
  ["36%", "9%", 18, "#FFFCF7 0%,rgba(196,163,90,.7) 34%,rgba(196,163,90,0) 70%"],
  ["64%", "12%", 38, "#FFFCF7 0%,rgba(243,227,190,.9) 30%,rgba(232,220,200,0) 70%"],
  ["84%", "26%", 58, "rgba(138,151,128,.55) 0%,rgba(138,151,128,0) 70%"],
  ["90%", "64%", 24, "#FFFCF7 0%,rgba(196,163,90,.6) 34%,rgba(196,163,90,0) 70%"],
  ["74%", "84%", 42, "#FFFCF7 0%,rgba(196,163,90,.5) 30%,rgba(196,163,90,0) 70%"],
  ["50%", "88%", 16, "rgba(138,151,128,.8) 0%,rgba(138,151,128,0) 70%"],
  ["12%", "46%", 26, "#FFFCF7 0%,rgba(196,163,90,.6) 34%,rgba(196,163,90,0) 70%"],
  ["30%", "30%", 14, "#FFFCF7 0%,rgba(196,163,90,.8) 40%,rgba(196,163,90,0) 70%"],
  ["72%", "46%", 20, "rgba(138,151,128,.7) 0%,rgba(138,151,128,0) 70%"],
  ["42%", "66%", 12, "#FFFCF7 0%,rgba(196,163,90,.8) 40%,rgba(196,163,90,0) 70%"],
];

// Closing: lights that settle around the invitation
const closingLights: CSSProperties[] = [
  { top: "22%", insetInlineStart: "24%", width: 40, height: 40, background: radial("#FFFCF7 0%,rgba(196,163,90,.5) 32%,rgba(196,163,90,0) 70%") },
  { top: "30%", insetInlineEnd: "22%", width: 56, height: 56, background: radial("rgba(138,151,128,.5) 0%,rgba(138,151,128,0) 70%") },
  { top: "62%", insetInlineStart: "18%", width: 28, height: 28, background: radial("#FFFCF7 0%,rgba(196,163,90,.6) 34%,rgba(196,163,90,0) 70%") },
  { top: "58%", insetInlineEnd: "26%", width: 22, height: 22, background: radial("#FFFCF7 0%,rgba(196,163,90,.7) 34%,rgba(196,163,90,0) 70%") },
  { top: "14%", insetInlineEnd: "42%", width: 18, height: 18, background: radial("rgba(138,151,128,.7) 0%,rgba(138,151,128,0) 70%") },
];

const lensBars: [string, boolean][] = [
  ["80%", false],
  ["100%", false],
  ["94%", true],
  ["60%", false],
];

const Arrow = () => <ArrowLeft size={18} className="icon flip" aria-hidden="true" />;

/** Phrases the signature moments decorate — looked up inside the copy, never written into it. */
const MARKS: Record<Lang, { lead: Mark[]; who: Mark[] }> = {
  ar: {
    lead: [{ text: "اسم الموضوع", kind: "underline" }],
    who: [
      { text: "مسلمًا", kind: "highlight" },
      { text: "شخصًا يتعرّف على الإسلام", kind: "highlight" },
    ],
  },
  en: {
    lead: [{ text: "topic’s name", kind: "underline" }],
    who: [
      { text: "a Muslim", kind: "highlight" },
      { text: "someone getting to know Islam", kind: "highlight" },
    ],
  },
};

/**
 * Hero «Teletype»: the H1's words as spans carrying their running index (`--i`) across both lines.
 * The effect itself is CSS only (.fx-typewriter); the text stays plain, selectable text.
 */
function typed(lines: [string, string]) {
  const all = lines.map((l) => l.split(" "));
  const n = all[0].length + all[1].length;
  let i = 0;
  const line = (words: string[]) =>
    words.map((w, j) => {
      const k = i++;
      return (
        <Fragment key={k}>
          {j > 0 && " "}
          <span
            className={k === 0 ? "tw tw--first" : k === n - 1 ? "tw tw--last" : "tw"}
            data-word={w}
            style={{ "--i": k } as CSSProperties}
          >
            <span className="tw__real">{w}</span>
          </span>
        </Fragment>
      );
    });
  return { n, first: line(all[0]), second: line(all[1]) };
}

/** «تجربة تعيشها. سؤال يشغلك. رغبة في الفهم.» → its three sentences, each keeping its period. */
const sentences = (s: string) => s.split(". ").map((x, i, all) => (i < all.length - 1 ? `${x}.` : x));

/** «01», «02» … — the journey is a real sequence; the list itself carries the order for assistive tech. */
const stationNum = (i: number) => String(i + 1).padStart(2, "0");

export default function App() {
  const [lang, setLang] = useState<Lang>("ar");
  const [view, setView] = useState<View>({ step: "empty" });
  const [line, setLine] = useState(0);
  const [text, setText] = useState("");
  const [chips, setChips] = useState<number[]>([]);
  const [sheet, setSheet] = useState<SheetKind | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const smRef = useRef<Smooth | null>(null);
  const bootedRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const humanInRef = useRef<HTMLDivElement>(null);
  /** The request in flight; replaced (and aborted) by a new send, «عدّل», or unmount. */
  const inflight = useRef<AbortController | null>(null);
  const lastReq = useRef<UnderstandRequestBody | null>(null);
  /** The analyze reading the journey stage builds on, and the message it was made from. */
  const analyzeRef = useRef<AnalyzeResult | null>(null);
  const sentRef = useRef("");

  const step = view.step;
  const t = copy[lang];
  const ar = lang === "ar";
  // Typed words are required; the kind chips only add a hint to them.
  const can = !!text.trim();
  const kinds = chips.map((i) => chipList[i][ar ? 0 : 1]);
  const words = text.trim() ? text : kinds.join(" · ");
  const thinkingLines = view.step === "thinking" && view.phase === "journey" ? t.thinkingJourney : t.thinkingAnalyze;
  const hero = typed([t.heroLine1, t.heroLine2]);

  // Smooth scroll. Reduced motion leaves everything in its final, static state.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const sm = startSmoothScroll();
    smRef.current = sm;
    bootedRef.current = true;
    let alive = true;
    document.fonts?.ready.then(() => alive && ScrollTrigger.refresh());
    return () => {
      alive = false;
      bootedRef.current = false;
      sm.kill();
      smRef.current = null;
    };
  }, []);

  // Scroll choreography — rebuilt per language, because the word spans it animates differ per language.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const mm = gsap.matchMedia(root);
    mm.add({ desk: "(min-width: 1024px)", mob: "(max-width: 1023.98px)" }, (c) =>
      sceneMotion(!!c.conditions?.desk, root),
    );
    return () => mm.revert();
  }, [lang]);

  // Leaving the page drops whatever is still in flight.
  useEffect(
    () => () => {
      inflight.current?.abort();
      inflight.current = null;
    },
    [],
  );

  // §02: the thinking line moves on while the server works, and rests on the last one.
  const thinkingPhase = view.step === "thinking" ? view.phase : null;
  useEffect(() => {
    if (!thinkingPhase) return;
    const n = (thinkingPhase === "journey" ? copy.ar.thinkingJourney : copy.ar.thinkingAnalyze).length;
    const id = setInterval(() => setLine((l) => Math.min(l + 1, n - 1)), 2400);
    return () => clearInterval(id);
  }, [thinkingPhase, view]);

  // Scene 2 (desktop): a short golden thread from the example sentence to each topic it could open.
  // Geometry comes from the real layout, so it follows the language, fonts and width.
  useEffect(() => {
    const host = humanInRef.current;
    if (!host) return;
    const layout = () => {
      const box = host.getBoundingClientRect();
      const phrases = host.querySelector<HTMLElement>(".human__phrases");
      const tags = host.querySelectorAll<HTMLElement>(".tag");
      const threads = host.querySelectorAll<SVGPathElement>(".threads path");
      if (!box.width || !phrases || !tags.length) return;
      const pr = phrases.getBoundingClientRect();
      const fs = parseFloat(getComputedStyle(phrases).fontSize) || 40;
      const cx = pr.left + pr.width / 2 - box.left;
      const y0 = pr.bottom - box.top - fs * 0.3; // just under the last line's letters
      tags.forEach((tag, i) => {
        const r = tag.getBoundingClientRect();
        const x1 = r.left + r.width / 2 - box.left;
        const y1 = r.top - box.top - 3;
        const x0 = cx + (x1 - cx) * 0.5;
        const my = (y0 + y1) / 2;
        const d = `M${x0.toFixed(1)} ${y0.toFixed(1)} C ${x0.toFixed(1)} ${my.toFixed(1)}, ${x1.toFixed(1)} ${my.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
        threads[i * 2]?.setAttribute("d", d);
        threads[i * 2 + 1]?.setAttribute("d", d);
      });
    };
    layout();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(layout) : null;
    ro?.observe(host);
    let alive = true;
    document.fonts?.ready.then(() => alive && layout());
    return () => {
      alive = false;
      ro?.disconnect();
    };
  }, [lang]);

  // Language: direction + document attributes, then re-measure the pinned scenes.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = ar ? "rtl" : "ltr";
    document.title = copy[lang].docTitle;
    if (!bootedRef.current) return;
    const id = setTimeout(() => ScrollTrigger.refresh(), 30);
    return () => clearTimeout(id);
  }, [lang, ar]);

  // The field behind the composer glows brighter as the person writes.
  const prevText = useRef(text);
  useEffect(() => {
    if (prevText.current === text) return;
    prevText.current = text;
    if (!bootedRef.current) return;
    const k = Math.min(1, text.trim().length / 140);
    gsap.to(rootRef.current!.querySelector('[data-a="xorb"]'), {
      opacity: 0.5 + 0.5 * k,
      scale: 0.9 + 0.25 * k,
      duration: 0.8,
      ease: "power3.out",
      overwrite: "auto",
    });
  }, [text]);

  // The examples fold away once the person writes; the page below moves, so re-measure the scenes.
  const hasText = text.trim() !== "";
  useEffect(() => {
    if (!bootedRef.current) return;
    const id = setTimeout(() => ScrollTrigger.refresh(), 30);
    return () => clearTimeout(id);
  }, [hasText]);

  // Each step of the experience settles in. Reduced motion (bootedRef false) skips every effect.
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const root = rootRef.current;
    if (!root) return;
    const live = bootedRef.current;
    const xorb = root.querySelector('[data-a="xorb"]');
    const orb = root.querySelector('[data-a="think"]');
    const undo: (() => void)[] = [];
    if (live && step === "thinking") {
      // The orb keeps breathing for as long as the server takes.
      if (orb) {
        const tw = gsap.fromTo(orb, { scale: 0.4, opacity: 0.5 }, { scale: 1.25, opacity: 1, duration: 1.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
        undo.push(() => tw.kill());
      }
      gsap.to(xorb, { scale: 0.7, opacity: 0.9, duration: 2.4, ease: "power2.inOut" });
    }
    if (live && SETTLED.has(step)) gsap.to(xorb, { scale: 1.1, opacity: 0.7, duration: 1.2, ease: "power3.out" });
    if (live && step === "empty") {
      const k = Math.min(1, text.trim().length / 140);
      gsap.to(xorb, { opacity: 0.5 + 0.5 * k, scale: 0.9 + 0.25 * k, duration: 0.8, ease: "power3.out", overwrite: "auto" });
    }
    const els = root.querySelectorAll(`[data-rv="${step}"]`);
    if (live && els.length) gsap.from(els, { opacity: 0, y: 12, duration: 0.6, stagger: 0.06, ease: "power3.out" });
    if (live) {
      const id = setTimeout(() => ScrollTrigger.refresh(), 30);
      undo.push(() => clearTimeout(id));
    }
    return () => undo.forEach((f) => f());
  }, [step]);

  // Focus follows the experience: each new state's heading or status takes focus and comes into view.
  useEffect(() => {
    if (step === "empty") return;
    const exp = rootRef.current?.querySelector("#experience");
    const el =
      exp?.querySelector<HTMLElement>(`[data-focus="${step}"]`) ?? exp?.querySelector<HTMLElement>(".result h3");
    if (!el) return;
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    const id = setTimeout(() => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return; // not laid out (tests)
      const vh = window.innerHeight;
      if (r.top >= 16 && r.top <= vh * 0.6) return;
      const sm = smRef.current;
      if (sm) sm.lenis.scrollTo(el, { offset: -Math.round(vh * 0.2), duration: 1 });
      else window.scrollTo({ top: r.top + window.scrollY - vh * 0.2, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }, 60);
    return () => clearTimeout(id);
  }, [step]);

  // Footer sheets open as a native modal dialog; the smooth scroller rests while one is open.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d || !sheet) return;
    if (!d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    }
    smRef.current?.lenis.stop();
  }, [sheet]);

  const onSheetClosed = () => {
    setSheet(null);
    smRef.current?.lenis.start();
  };

  const closeSheet = () => {
    const d = dialogRef.current;
    if (d && typeof d.close === "function" && d.open) d.close();
    else {
      d?.removeAttribute("open");
      onSheetClosed();
    }
  };

  const go = (sel: string, focusSel?: string | null) => () => scrollToSection(smRef.current, sel, focusSel);
  /** Hero and closing CTAs: to the composer, focused (or to the current state if one is showing). */
  const startHere = go("#experience", step === "empty" ? "#tm-text" : null);

  const onAnchor = (sel: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!smRef.current) return; // native jump when the smooth scroller is off
    e.preventDefault();
    scrollToSection(smRef.current, sel);
  };

  /** Sends one stage to the server; a newer send, «عدّل» or unmount makes this one stale. */
  const run = (req: UnderstandRequestBody) => {
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    lastReq.current = req;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, CLIENT_TIMEOUT_MS);
    setLine(0);
    setView({ step: "thinking", phase: req.stage });
    postUnderstand(req, ctrl.signal)
      .then((res) => interpret(req.stage, res, analyzeRef.current))
      .catch((): Outcome => ({ kind: "error", error: timedOut ? "timeout" : "network" }))
      .then((out) => {
        clearTimeout(timer);
        if (inflight.current !== ctrl) return;
        inflight.current = null;
        if (out.kind === "topics" || (out.kind === "learning" && out.analyze)) analyzeRef.current = out.analyze;
        if (out.kind === "knowledge") analyzeRef.current = out.analyze;
        setView(viewFor(out));
      });
  };

  const send = () => {
    if (!can || inflight.current) return;
    const message = composeMessage(text, kinds, lang, t.chipsPrefix);
    sentRef.current = message;
    analyzeRef.current = null;
    run({ stage: "analyze", message, language: lang });
  };

  const journey = (topicId: string) => {
    const analyze = analyzeRef.current;
    if (!analyze || inflight.current) return;
    const focus = learningFocus(analyze);
    run({
      stage: "journey",
      message: sentRef.current,
      language: lang,
      topicId,
      analyzeLevel: analyze.level,
      ...(focus.length ? { focus } : {}),
    });
  };

  const retry = () => {
    if (!lastReq.current || inflight.current) return;
    run({ ...lastReq.current, language: lang });
  };

  const onEdit = () => {
    inflight.current?.abort();
    inflight.current = null;
    setView({ step: "empty" });
    setTimeout(() => document.querySelector<HTMLTextAreaElement>("#tm-text")?.focus(), 60);
  };

  /**
   * «أختم رحلتي» ends the journey: back to «وش يشغلك اليوم؟», a fresh composer, focused.
   * (Whatever was written in the du‘a box is gone with the journey — it was never sent or stored.)
   */
  const restart = () => {
    inflight.current?.abort();
    inflight.current = null;
    setText("");
    setChips([]);
    setView({ step: "empty" });
    setTimeout(() => scrollToSection(smRef.current, "#experience", "#tm-text"), 60);
  };

  /** «تابع» in the journey: the next stage comes into view (smooth scroller when it runs). */
  const reach = (el: HTMLElement) => {
    const sm = smRef.current;
    const offset = -Math.round(window.innerHeight * 0.12);
    if (sm) {
      // The page may have just moved natively (a focused button scrolled into view) before the smooth
      // scroller heard of it: sync it first, so it glides from where the page really is.
      sm.lenis.scrollTo(window.scrollY, { immediate: true });
      sm.lenis.scrollTo(el, { offset, duration: 1.2 });
    } else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  const toggleChip = (i: number) =>
    setChips((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  /** An example fills the composer and puts the caret at its end, ready to edit or send. */
  const pickExample = (example: string) => {
    setText(example);
    setTimeout(() => {
      const ta = document.querySelector<HTMLTextAreaElement>("#tm-text");
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 0);
  };

  return (
    <div ref={rootRef} className="page" dir={ar ? "rtl" : "ltr"} lang={lang}>
      <a href="#main" className="skip">
        {t.skip}
      </a>

      <header className="header">
        <div className="header__in">
          <a href="#top" aria-label="طمأنينة | Tamaninah" className="brand">
            <span className="brand__mark">
              <span className="brand__halo" />
              <span className="brand__core" />
            </span>
            <span className="brand__ar">طمأنينة</span>
            <span className="brand__en">TAMANINAH</span>
          </a>
          <button type="button" className="lang-btn" onClick={() => setLang(ar ? "en" : "ar")}>
            <Translate size={18} className="icon" aria-hidden="true" />
            <span>{t.langLabel}</span>
          </button>
        </div>
      </header>

      <main id="main" tabIndex={-1} style={{ outline: "none" }}>
        {/* 1 · Hero */}
        <section id="top" className="hero" data-screen-label="01 Home">
          <div aria-hidden="true" className="fill">
            {heroOrbs.map((o, i) => (
              <div key={i} data-a="orb" data-depth={o.depth} className="orb" style={o.style} />
            ))}
          </div>
          <svg aria-hidden="true" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className="svg-fill">
            <defs>
              <filter id="v4b" x="-10%" y="-60%" width="120%" height="220%">
                <feGaussianBlur stdDeviation="10" />
              </filter>
              <radialGradient id="v4bead">
                <stop offset="0" stopColor="#FFFCF7" />
                <stop offset=".3" stopColor="#F3E3BE" />
                <stop offset=".6" stopColor="#C4A35A" stopOpacity=".35" />
                <stop offset="1" stopColor="#C4A35A" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path
              data-a="rib"
              pathLength={1}
              d="M1520 400 C 1200 360, 1000 660, 720 660 S 260 520, -80 740"
              style={{ fill: "none", stroke: "#C4A35A", strokeOpacity: 0.4, strokeWidth: 22, strokeLinecap: "round", filter: "url(#v4b)", strokeDasharray: "1 2", strokeDashoffset: 0 }}
            />
            <path
              data-a="rib"
              pathLength={1}
              d="M1520 400 C 1200 360, 1000 660, 720 660 S 260 520, -80 740"
              style={{ fill: "none", stroke: "#C4A35A", strokeWidth: 1.2, strokeLinecap: "round", strokeDasharray: "1 2", strokeDashoffset: 0 }}
            />
            <circle data-a="bead" className="bead" cx="1105" cy="515" r="34" fill="url(#v4bead)" />
            <circle data-a="bead" className="bead" cx="720" cy="660" r="44" fill="url(#v4bead)" />
            <circle data-a="bead" className="bead" cx="342" cy="617" r="30" fill="url(#v4bead)" />
          </svg>
          <div className="hero__copy">
            <h1 key={lang} className="hero__title fx-typewriter" style={{ "--n": hero.n } as CSSProperties}>
              <span>{hero.first}</span>{" "}
              <span>{hero.second}</span>
            </h1>
            <p data-a="h" className="hero__lead">
              {t.heroLead}
            </p>
            <div data-a="h" className="hero__actions">
              <button type="button" className="btn-primary btn-primary--ring" onClick={startHere}>
                <span>{t.heroCta}</span>
                <Arrow />
              </button>
              <button type="button" className="btn-link" onClick={go("#human")}>
                <span>{t.explore}</span>
              </button>
            </div>
          </div>
        </section>

        {/* 2 · Human start: each phrase lights its own orb (pinned on desktop) */}
        <section id="human" data-a="s2" className="human" data-screen-label="02 Human start">
          <svg aria-hidden="true" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className="svg-fill">
            <path
              data-a="s2-rib"
              pathLength={1}
              d="M1520 380 C 1240 300, 1100 560, 860 470 S 480 330, 300 500 S 40 560, -80 470"
              style={{ fill: "none", stroke: "#C4A35A", strokeWidth: 1.2, strokeLinecap: "round", strokeDasharray: "1 2", strokeDashoffset: 0 }}
            />
          </svg>
          <div ref={humanInRef} className="human__in">
            <div className="human__head">
              <h2 data-a="s2-lead" className="human__lead">
                <span aria-hidden="true" data-a="sweep" className="sweep" />
                <Words text={t.s2Lead} marks={MARKS[lang].lead} />
              </h2>
              <p data-a="s2-lead" className="human__body">
                {t.s2Body}
              </p>
              <p data-a="s2-lead" className="human__who">
                <Words text={t.s2Who} split={false} marks={MARKS[lang].who} />
              </p>
            </div>
            <p className="human__phrases">
              <span aria-hidden="true" data-a="ink" className="ink" />
              {t.phrases.map((p, i) => (
                <Fragment key={i}>
                  {i > 0 && " "}
                  <span data-a="ph" className="phrase">
                    <Words text={p} />
                    <span data-a="po" aria-hidden="true" className="phrase__orb" style={{ background: phraseOrbs[i] }} />
                  </span>
                </Fragment>
              ))}
            </p>
            <div data-a="s2-close" className="human__topics">
              <span id="s2-topics" data-a="s2-label" className="label">
                {t.s2TopicsLabel}
              </span>
              <ul className="tags" aria-labelledby="s2-topics">
                {t.s2Topics.map((topic) => (
                  <li key={topic} data-a="tag" className="tag">
                    <span aria-hidden="true" data-a="tag-dot" className="tag__dot" />
                    {topic}
                  </li>
                ))}
              </ul>
              <p data-a="s2-note" className="human__note">
                {t.s2TopicsNote}
              </p>
            </div>
            <svg aria-hidden="true" className="threads">
              {t.s2Topics.map((topic) => (
                <Fragment key={topic}>
                  <path data-a="thr" pathLength={1} className="thr" />
                  <path data-a="thr-spark" pathLength={1} className="thr-spark" />
                </Fragment>
              ))}
            </svg>
          </div>
        </section>

        {/* 3 · Journey: four lights along a gentle curve — a real sequence, numbered */}
        <section id="journey" className="journey" data-screen-label="03 Journey">
          <div className="wrap">
            <h2 data-a="rv" className="journey__title">
              {t.journeyTitle}
            </h2>

            <ol data-a="rail-d" className="rail-d rail-d--4">
              <svg aria-hidden="true" viewBox="0 0 1000 260" className="rail-d__svg">
                <defs>
                  <filter id="v4b2" x="-10%" y="-80%" width="120%" height="260%">
                    <feGaussianBlur stdDeviation="7" />
                  </filter>
                </defs>
                <path d="M900 90 Q500 270 100 90" style={{ fill: "none", stroke: "#E2D8C8", strokeWidth: 1.5 }} />
                <path
                  data-a="rail-line"
                  pathLength={1}
                  d="M900 90 Q500 270 100 90"
                  style={{ fill: "none", stroke: "#C4A35A", strokeOpacity: 0.5, strokeWidth: 12, strokeLinecap: "round", filter: "url(#v4b2)", strokeDasharray: "1 2", strokeDashoffset: 0 }}
                />
                <path
                  data-a="rail-line"
                  pathLength={1}
                  d="M900 90 Q500 270 100 90"
                  style={{ fill: "none", stroke: "#C4A35A", strokeWidth: 1.5, strokeLinecap: "round", strokeDasharray: "1 2", strokeDashoffset: 0 }}
                />
              </svg>
              {t.stations.map(([title, body], i) => (
                <li key={i} data-a="st" className="st-d" style={{ insetInlineStart: stationPos[i][0], top: stationPos[i][1] }}>
                  <span data-a="dot" className="st-d__glow" />
                  <span className="st-d__pin" />
                  <div data-a="lbl" className="st-d__lbl">
                    <span aria-hidden="true" className="st-num">
                      {stationNum(i)}
                    </span>
                    <strong>{title}</strong>
                    <span>{body}</span>
                  </div>
                </li>
              ))}
            </ol>

            <ol data-a="rail-m" className="rail-m">
              <span data-a="mline" aria-hidden="true" className="rail-m__line" />
              {t.stations.map(([title, body], i) => (
                <li key={i} data-a="st" className="st-m">
                  <span data-a="dot" className="st-m__glow" />
                  <div data-a="lbl" className="st-m__lbl">
                    <span aria-hidden="true" className="st-num">
                      {stationNum(i)}
                    </span>
                    <strong>{title}</strong>
                    <span>{body}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 4 · Story gateway: every light gathers into the topic, and the journey's four sources appear around it (pinned on desktop) */}
        <section id="story" data-a="s4" className="story" data-screen-label="04 Story gateway">
          {gatherLights.map(([start, top, size, stops], i) => (
            <div
              key={i}
              data-a="gl"
              aria-hidden="true"
              className="gl"
              style={{ insetInlineStart: start, top, width: size, height: size, background: radial(stops) }}
            />
          ))}
          <div className="story__in">
            <div data-a="disc" className="story__disc">
              <div data-a="bloom" className="story__bloom" />
              <div data-a="s4-text" className="story__text">
                <Sparkle size={26} className="icon" color="#8A9780" aria-hidden="true" />
                <h2 className="story__title">
                  <span>{t.storyLine1}</span>{" "}
                  <span>{t.storyLine2}</span>
                </h2>
              </div>
            </div>
            <ul className="story__items">
              {t.storyItems.map(([title, body]) => (
                <li key={title} data-a="s4-item" className="story__item">
                  <span aria-hidden="true" className="story__light" />
                  <h3 className="story__item-h">{title}</h3>
                  <p className="story__item-p">{body}</p>
                </li>
              ))}
            </ul>
            <p data-a="s4-item" className="story__foot">
              <SealCheck size={18} className="icon" aria-hidden="true" />
              <span>{t.storyFoot}</span>
            </p>
          </div>
        </section>

        {/* 5 · Trust: a lens of text, a thread, a source that lights */}
        <section id="trust" className="trust" data-screen-label="05 Trust">
          <div className="trust__in">
            <div data-a="trust-head" className="trust__head">
              <h2 className="trust__title words--lit">
                <Words text={t.trustTitle} node />
              </h2>
              <p data-a="trust-body" className="trust__body">
                {t.trustBody}
              </p>
            </div>
            <figure data-a="fig" className="trust__fig">
              <svg aria-hidden="true" viewBox="0 0 760 320" className="trust__svg">
                <path
                  data-a="thread"
                  pathLength={1}
                  d="M520 160 C 420 160, 380 250, 250 250"
                  style={{ fill: "none", stroke: "#C4A35A", strokeWidth: 1.5, strokeLinecap: "round", strokeDasharray: "1 2", strokeDashoffset: 0 }}
                />
              </svg>
              <div data-a="card" className="lens">
                {lensBars.map(([w, gold], i) => (
                  <span key={i} data-a="bar" className={gold ? "lens__bar lens__bar--gold" : "lens__bar"} style={{ width: w }} />
                ))}
              </div>
              <div data-a="src" className="src">
                <span data-a="srcglow" aria-hidden="true" className="src__glow" />
                <span data-a="src-seal" className="src__seal">
                  <SealCheck size={24} className="icon" color="#3E4A39" aria-hidden="true" />
                </span>
                <span className="src__txt">
                  <strong>{t.source}</strong>
                  <span>{t.verifiedCatalog}</span>
                </span>
              </div>
            </figure>
            <div data-a="ai-role" className="ai-role">
              <h3 data-a="ai-h" className="ai-role__h">
                {t.aiRoleTitle}
              </h3>
              <div className="ai-steps-wrap">
                <span aria-hidden="true" data-a="ai-line" className="ai-steps__line" />
                <ol className="ai-steps">
                  {t.aiRoleSteps.map((stepText, i) => (
                    <li key={stepText} data-a="ai-step" className="ai-steps__item">
                      <span aria-hidden="true" className="ai-steps__n">
                        {i + 1}
                      </span>
                      <span className="ai-steps__txt">{stepText}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <p data-a="ai-note" className="ai-role__note">
                <svg aria-hidden="true" className="seal">
                  <rect data-a="seal" x="0" y="0" width="100%" height="100%" rx="25" />
                </svg>
                <span data-a="ai-shield" className="ai-role__shield">
                  <ShieldCheck size={20} className="icon" aria-hidden="true" />
                </span>
                <strong>{t.aiRoleNote}</strong>
              </p>
            </div>
          </div>
        </section>

        {/* 6 · Experience: the field glows as you write */}
        <section id="experience" data-a="exp" className="exp" data-screen-label="06 Experience">
          <div className="exp__in">
            <div data-a="xorb" aria-hidden="true" className="exp__orb" />
            <div className="exp__head">
              <h2 id="tm-q" data-a="exp-q" className="exp__q">
                <Words text={t.question} />
              </h2>
              <p id="tm-sub" data-a="exp-sub" className="exp__sub">
                {t.questionSub}
              </p>
            </div>

            {view.step === "empty" && (
              <>
                <div className="composer" style={{ "--k": Math.min(1, text.trim().length / 140) } as CSSProperties}>
                  <textarea
                    id="tm-text"
                    aria-labelledby="tm-q"
                    aria-describedby="tm-sub tm-note"
                    className="composer__text"
                    value={text}
                    maxLength={2000}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder={t.placeholder}
                    rows={6}
                  />
                  {!hasText && (
                    <div className="composer__examples">
                      <span id="tm-examples" data-a="exp-cascade" className="label">
                        {t.examplesLabel}
                      </span>
                      <ul className="examples" aria-labelledby="tm-examples">
                        {t.examples.map((example) => (
                          <li key={example} data-a="exp-cascade">
                            <button type="button" className="example" onClick={() => pickExample(example)}>
                              <ChatCircleText size={18} className="icon" aria-hidden="true" />
                              <span>{example}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="composer__feel">
                    <span id="tm-kind" data-a="exp-cascade" className="label">
                      {t.kindLabel}
                    </span>
                    <div className="chips" role="group" aria-labelledby="tm-kind">
                      {chipList.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          data-a="exp-cascade"
                          className="chip"
                          aria-pressed={chips.includes(i)}
                          onClick={() => toggleChip(i)}
                        >
                          {c[ar ? 0 : 1]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="composer__foot composer__foot--hint">
                    {!can && (
                      <span id="tm-hint" className="composer__hint">
                        {t.sendHint}
                      </span>
                    )}
                    <button
                      type="button"
                      className={can ? "btn-primary composer__send is-ready" : "btn-primary composer__send"}
                      onClick={send}
                      disabled={!can}
                      aria-describedby={can ? undefined : "tm-hint"}
                      style={{ opacity: can ? 1 : 0.45 }}
                    >
                      <span>{t.sendLabel}</span>
                      <Arrow />
                    </button>
                  </div>
                </div>
                <div id="tm-note" className="assure">
                  <p data-a="assure" className="assure__item">
                    <span aria-hidden="true" data-a="assure-rule" className="assure__rule" />
                    <span aria-hidden="true" className="assure__icon">
                      <Sparkle size={16} className="icon" />
                    </span>
                    <span className="assure__txt">{t.aiNote}</span>
                  </p>
                  <p data-a="assure" className="assure__item">
                    <span aria-hidden="true" data-a="assure-rule" className="assure__rule" />
                    <span aria-hidden="true" className="assure__icon">
                      <LockSimple size={16} className="icon" />
                    </span>
                    <span className="assure__txt">{t.privacyNote}</span>
                  </p>
                </div>
              </>
            )}

            {view.step !== "empty" && (
              <figure className="words">
                <figcaption className="words__cap">
                  <span className="label--plain">{t.yourWords}</span>
                  <button type="button" className="edit-btn" onClick={onEdit}>
                    <PencilSimple size={15} className="icon" aria-hidden="true" />
                    <span>{t.edit}</span>
                  </button>
                </figcaption>
                <blockquote dir="auto" className="words__quote">
                  {words}
                </blockquote>
                {text.trim() !== "" && kinds.length > 0 && (
                  <ul className="words__tags" aria-label={t.kindLabel}>
                    {kinds.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
              </figure>
            )}

            {view.step === "thinking" && <Thinking line={thinkingLines[Math.min(line, thinkingLines.length - 1)]} />}

            {view.step === "topics" && <TopicChoice analyze={view.analyze} t={t} ar={ar} onPick={(tp) => journey(tp.id)} />}

            {view.step === "result" && (
              <GuidanceResult
                analyze={view.analyze}
                payload={view.payload}
                t={t}
                ar={ar}
                onNext={view.analyze ? journey : null}
                onRestart={restart}
                scrollTo={reach}
              />
            )}

            {view.step === "knowledge" && <KnowledgeView analyze={view.analyze} answer={view.answer} t={t} ar={ar} />}

            {view.step === "referral" && <ReferralView referral={view.referral} pointer={view.pointer} t={t} ar={ar} />}

            {view.step === "insufficient" && <InsufficientView pointer={view.pointer} t={t} ar={ar} onEdit={onEdit} />}

            {view.step === "unclear" && <UnclearView t={t} ar={ar} onEdit={onEdit} />}

            {view.step === "error" && <ErrorView error={view.error} t={t} ar={ar} onRetry={retry} />}
          </div>
        </section>

        {/* 7 · Closing: lights settle around the invitation */}
        <section id="begin" data-a="s7" className="closing" data-screen-label="07 Closing">
          <div aria-hidden="true" className="fill">
            {closingLights.map((s, i) => (
              <span key={i} data-a="cl" className="cl" style={s} />
            ))}
          </div>
          <div className="closing__in">
            <span aria-hidden="true" data-a="dawn" className="closing__dawn" />
            <h2 data-a="c" className="closing__title">
              <Words text={t.closing} />
            </h2>
            <div className="closing__lead">
              <p className="closing__nodes">
                <span aria-hidden="true" data-a="c-thread" className="closing__thread" />
                {sentences(t.closingLead).map((line, i) => (
                  <Fragment key={line}>
                    {i > 0 && " "}
                    <span data-a="c-node" className="cnode">
                      <span aria-hidden="true" className="cnode__dot" />
                      <span className="cnode__t">{line}</span>
                    </span>
                  </Fragment>
                ))}
              </p>
              <p data-a="c" className="closing__body">
                {t.closingBody}
              </p>
            </div>
            <div data-a="c" className="closing__cta">
              <span aria-hidden="true" className="closing__halo" />
              <button type="button" className="btn-primary btn-primary--ring btn-primary--wide" onClick={startHere}>
                <span>{t.closingCta}</span>
                <Arrow />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer__in">
          <span className="footer__brand">
            طمأنينة <span>| Tamaninah</span>
          </span>
          <nav aria-label={ar ? "روابط التذييل" : "Footer"}>
            <ul>
              <li>
                <a href="#journey" onClick={onAnchor("#journey")}>
                  {t.footerAbout}
                </a>
              </li>
              {(
                [
                  ["sources", t.footerSources],
                  ["privacy", t.footerPrivacy],
                  ["terms", t.footerTerms],
                ] as [SheetKind, string][]
              ).map(([kind, label]) => (
                <li key={kind}>
                  <button type="button" className="footer__btn" aria-haspopup="dialog" onClick={() => setSheet(kind)}>
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>

      <dialog
        ref={dialogRef}
        className="sheet"
        aria-labelledby="sheet-h"
        data-lenis-prevent=""
        onClose={onSheetClosed}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeSheet(); // backdrop
        }}
      >
        {sheet && (
          <div className="sheet__in">
            <div className="sheet__top">
              <h2 id="sheet-h" className="sheet__h">
                {sheet === "sources" ? t.sourcesTitle : sheet === "privacy" ? t.privacyTitle : t.termsTitle}
              </h2>
              <button type="button" className="sheet__close" onClick={closeSheet} aria-label={t.close}>
                <X size={20} className="icon" aria-hidden="true" />
              </button>
            </div>
            <SheetBody kind={sheet} t={t} ar={ar} />
          </div>
        )}
      </dialog>
    </div>
  );
}
