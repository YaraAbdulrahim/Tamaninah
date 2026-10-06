import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Lenis smooth scroll driven by the GSAP ticker so ScrollTrigger stays in lockstep. */
export function startSmoothScroll() {
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  const tick = (t: number) => lenis.raf(t * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return {
    lenis,
    kill() {
      gsap.ticker.remove(tick);
      lenis.destroy();
    },
  };
}

export type Smooth = ReturnType<typeof startSmoothScroll>;

/** Scroll to a section, then optionally focus an element inside it. */
export function scrollToSection(sm: Smooth | null, sel: string, focusSel?: string | null) {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) return;
  const focus = () => {
    const f = focusSel ? document.querySelector<HTMLElement>(focusSel) : null;
    if (f) f.focus({ preventScroll: true });
  };
  if (sm) {
    // Start from where the page really is (it may have moved natively, or changed height, a moment ago).
    sm.lenis.scrollTo(window.scrollY, { immediate: true });
    sm.lenis.scrollTo(el, { duration: 1.4, onComplete: focus });
  } else {
    const reduced = prefersReducedMotion();
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: reduced ? "auto" : "smooth" });
    setTimeout(focus, reduced ? 0 : 700);
  }
}

/**
 * All scroll choreography. Desktop pins scenes 2 and 4 and scrubs them; mobile plays each once on enter
 * with lighter effects (no blur filters). The signature moments share one vocabulary — words rising out
 * of their own light, a gold thread that draws, nodes that ignite — and every one animates FROM the final
 * state the CSS already holds, so reduced motion (which never calls this) is simply the finished page.
 */
export function sceneMotion(desk: boolean, root: HTMLElement) {
  const D = (s: string, scope: ParentNode = root) => [...scope.querySelectorAll<HTMLElement>(`[data-a="${s}"]`)];
  const Q = (s: string, scope: ParentNode = root) => [...scope.querySelectorAll<HTMLElement>(s)];
  const draw = { strokeDashoffset: 1.05 };
  const rtl = () => getComputedStyle(root).direction === "rtl";
  /** Blur only where it is affordable. */
  const blur = (px: number) => (desk ? { filter: `blur(${px}px)` } : {});
  const unblur = (els: Element[]) => () => desk && gsap.set(els, { clearProps: "filter" });
  const cleanups: (() => void)[] = [];

  // Hero: lights fade up from the center outward, ribbon draws, beads ignite along it. The H1 types itself
  // in CSS (.fx-typewriter), so the lead and the actions arrive as the last words land.
  const orbs = D("orb");
  const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
  intro
    .from(orbs, { opacity: 0, scale: 0.6, duration: 1.6, ease: "power2.out", stagger: { each: 0.06, from: "end" } }, 0)
    .fromTo(D("rib"), draw, { strokeDashoffset: 0, duration: 1.4, ease: "power2.out", stagger: 0.06 }, 0.2)
    .from(D("bead"), { scale: 0, opacity: 0, duration: 0.8, stagger: 0.18 }, 0.7)
    .from(D("h"), { y: 24, opacity: 0, duration: 0.8, stagger: 0.08 }, 2.2);
  const qs = orbs.map((o) => {
    const d = parseFloat(o.dataset.depth || "1") / 3.4;
    gsap.to(o, {
      x: gsap.utils.random(-36, 36),
      y: gsap.utils.random(-28, 28),
      duration: gsap.utils.random(8, 14),
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    // drift rides on x/y; pointer parallax rides on xPercent/yPercent (converted from px) so the two compose
    return {
      o,
      d,
      x: gsap.quickTo(o, "xPercent", { duration: 1.2, ease: "power3.out" }),
      y: gsap.quickTo(o, "yPercent", { duration: 1.2, ease: "power3.out" }),
    };
  });
  const onPtr = (e: PointerEvent) => {
    const nx = e.clientX / innerWidth - 0.5;
    const ny = e.clientY / innerHeight - 0.5;
    qs.forEach((q) => {
      const w = q.o.offsetWidth || 1;
      q.x(((nx * 48 * q.d) / w) * 100);
      q.y(((ny * 48 * q.d) / w) * 100);
    });
  };
  // Parallax only for a real mouse; on touch it would just jitter during scroll.
  const finePointer = matchMedia("(pointer: fine)").matches;
  if (finePointer) addEventListener("pointermove", onPtr);
  cleanups.push(() => finePointer && removeEventListener("pointermove", onPtr));

  /* ───────── Scene 2 · «ما تحتاج تعرف اسم الموضوع.» ─────────
     One sequence in TIME, played once as the scene comes in (never scrubbed):
       intro — the heading rises word by word with a warm light passing behind it, «اسم الموضوع» is
               underlined by hand, then the body line, then «قد تكون مسلمًا …» with its two highlights;
       then, as soon as the intro is done, the example writes itself word by word, an ink light leading,
               each phrase's orb drifting in as the pen reaches it;
       then the topics arrive along short golden threads (desktop), and the note.
     Desktop keeps the scene pinned for a short hold while it plays; scrolling past it early (or arriving
     already past it) jumps everything to its final state — never a half-written line. */
  const s2Sec = D("s2")[0];
  const s2 = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
  const head = s2Sec.querySelector<HTMLElement>(".human__lead")!;
  const sweep = D("sweep", s2Sec)[0];
  const half = () => head.offsetWidth / 2;
  const headWords = Q(".w__i", head);
  const headSpread = Math.min(0.6, 0.12 * (headWords.length - 1));
  const headEnd = 0.1 + headSpread + 0.65;
  s2.fromTo(D("s2-rib", s2Sec), draw, { strokeDashoffset: 0, duration: 1.8, ease: "power2.out" }, 0)
    .fromTo(headWords, { yPercent: 105, opacity: 0, ...blur(8) }, { yPercent: 0, opacity: 1, ...blur(0), duration: 0.65, stagger: { amount: headSpread }, ease: "power2.out" }, 0.1)
    .fromTo(sweep, { x: () => (rtl() ? 1 : -1) * half() }, { x: () => (rtl() ? -1 : 1) * half(), duration: headEnd, ease: "sine.inOut", immediateRender: false }, 0.05)
    .fromTo(sweep, { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: false }, 0.05)
    .to(sweep, { opacity: 0, duration: 0.4 }, headEnd - 0.35)
    .fromTo(D("mk-line", head), draw, { strokeDashoffset: 0, duration: 0.55, ease: "power1.inOut" }, headEnd - 0.2);
  const tBody = headEnd + 0.1;
  s2.fromTo(Q(".human__body, .human__who", s2Sec), { y: 16, opacity: 0, ...blur(6) }, { y: 0, opacity: 1, ...blur(0), duration: 0.7, stagger: 0.4, ease: "power2.out" }, tBody)
    .fromTo(D("mk-bg", s2Sec), { scaleX: 0 }, { scaleX: 1, duration: 0.45, stagger: 0.28, ease: "power2.inOut" }, tBody + 0.4 + 0.45);
  /** The intro is done: every line of it is in place and both highlights have swept. */
  const introEnd = s2.duration();

  // The example writes itself, the same way the heading rose: each word out of its own mask, an ink light
  // leading along the line in reading order.
  const phr = s2Sec.querySelector<HTMLElement>(".human__phrases")!;
  const exWords = Q(".w", phr);
  const ink = D("ink", phr)[0];
  const T0 = introEnd + 0.1;
  /** About two seconds of writing, whatever the language's word count (at most 0.14 s a word). */
  const STEP = Math.min(0.14, 1.9 / Math.max(1, exWords.length));
  /** Where the pen is: the start and end edges of a word in reading order, at mid-height. */
  const edge = (w: HTMLElement, end: boolean) => {
    const p = phr.getBoundingClientRect();
    const r = w.getBoundingClientRect();
    const startX = rtl() ? r.right : r.left;
    const endX = rtl() ? r.left : r.right;
    return { x: (end ? endX : startX) - p.left, y: r.top + r.height * 0.5 - p.top };
  };
  s2.fromTo(Q(".w__i", phr), { yPercent: 70, opacity: 0, ...blur(4) }, { yPercent: 0, opacity: 1, ...blur(0), duration: 0.45, stagger: STEP, ease: "power2.out" }, T0)
    .fromTo(ink, { opacity: 0 }, { opacity: 1, duration: 0.15 }, T0 - 0.08);
  exWords.forEach((w, i) =>
    s2.fromTo(
      ink,
      { x: () => edge(w, false).x, y: () => edge(w, false).y },
      { x: () => edge(w, true).x, y: () => edge(w, true).y, duration: STEP, ease: "none", immediateRender: i === 0 },
      T0 + i * STEP,
    ),
  );
  const written = T0 + exWords.length * STEP;
  s2.to(ink, { opacity: 0, duration: 0.3 }, written);
  const drift: [number, number][] = [
    [-110, 50],
    [120, -40],
    [-80, -60],
  ];
  // Each phrase's orb drifts in as the pen reaches that phrase.
  let firstWord = 0;
  D("ph", phr).forEach((ph, i) => {
    const po = D("po", ph)[0];
    if (po) {
      s2.fromTo(
        po,
        { scale: 0.3, opacity: 0, x: drift[i % 3][0], y: drift[i % 3][1] },
        { scale: 1, opacity: 1, x: 0, y: 0, duration: 1, ease: "power2.out" },
        T0 + firstWord * STEP - 0.1,
      );
    }
    firstWord += Q(".w", ph).length;
  });

  // Topics: each arrives along a short golden thread from the sentence (desktop), its light igniting.
  const tTopics = written + 0.3;
  const tags = D("tag", s2Sec);
  const thr = D("thr", s2Sec);
  const sparks = D("thr-spark", s2Sec);
  s2.fromTo(D("s2-label", s2Sec), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5 }, tTopics);
  let lastLands = tTopics;
  tags.forEach((tag, i) => {
    const at = tTopics + 0.2 + i * 0.35;
    const lands = desk ? at + 0.35 : at;
    lastLands = lands;
    if (desk && thr[i] && sparks[i]) {
      s2.fromTo(thr[i], draw, { strokeDashoffset: 0, duration: 0.45, ease: "power1.inOut" }, at)
        .set(sparks[i], { opacity: 1 }, at)
        .fromTo(sparks[i], { strokeDashoffset: 0.08 }, { strokeDashoffset: -1.1, duration: 0.55, ease: "none" }, at)
        .set(sparks[i], { opacity: 0 }, at + 0.55);
    }
    s2.fromTo(tag, { opacity: 0, y: desk ? -6 : 10, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "back.out(2)" }, lands).fromTo(
      D("tag-dot", tag),
      { scale: 0.2 },
      { scale: 1, duration: 0.5, ease: "back.out(3)" },
      lands + 0.12,
    );
  });
  s2.fromTo(D("s2-note", s2Sec), { opacity: 0 }, { opacity: 1, duration: 0.7 }, lastLands + 0.35);

  /** Everything in its final state at once — for a person who scrolled past before it finished. */
  const settle = () => {
    if (s2.progress() < 1) s2.progress(1).pause();
  };
  // Desktop: a short hold — the scene stays while the sequence plays, then releases (no long dead scroll).
  const hold = desk
    ? ScrollTrigger.create({ trigger: s2Sec, start: "top top", end: "+=80%", pin: true, onLeave: settle })
    : null;
  // Past it early: the pin's end on desktop; on a phone, once most of the scene has scrolled away.
  const past = hold ? null : ScrollTrigger.create({ trigger: s2Sec, start: "bottom 45%", onEnter: settle });
  let begun = false;
  const begin = () => {
    if (begun) return;
    begun = true;
    const beyond = hold ? hold.end : past!.start;
    if (window.scrollY >= beyond) settle();
    else s2.play();
  };
  const enter = ScrollTrigger.create({ trigger: s2Sec, start: desk ? "top 45%" : "top 65%", end: "max", once: true, onEnter: begin });
  // Built while the page is already scrolled into or past the scene (a reload keeps its place): decide now.
  if (window.scrollY >= enter.start) begin();

  // Rail: curve draws; each station's light swells as the line reaches it (evenly, whatever the count)
  const rail = D(desk ? "rail-d" : "rail-m")[0];
  const rt = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: rail, start: "top 80%", end: desk ? "bottom 60%" : "bottom 70%", scrub: 0.6 },
  });
  if (desk) rt.fromTo(rail.querySelectorAll('[data-a="rail-line"]'), draw, { strokeDashoffset: 0, duration: 1 }, 0);
  else rt.fromTo(rail.querySelector('[data-a="mline"]'), { scaleY: 0 }, { scaleY: 1, duration: 1 }, 0);
  const stations = rail.querySelectorAll('[data-a="st"]');
  stations.forEach((st, i) => {
    const p = (i + 0.5) / stations.length;
    rt.fromTo(st.querySelector('[data-a="dot"]'), { scale: 0.15, opacity: 0.4 }, { scale: 1, opacity: 1, duration: 0.1 }, p).fromTo(
      st.querySelector('[data-a="lbl"]'),
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.1 },
      p,
    );
  });

  // Scene 4: every scattered light flies inward and fuses into the topic's circle; its sources then appear
  const sec = D("s4")[0];
  const disc = D("disc")[0];
  const gls = D("gl");
  // The circle's centre inside the section (it is no longer the section's centre once the sources sit beside/below it).
  const discCentre = () => {
    const s = sec.getBoundingClientRect();
    const d = disc.getBoundingClientRect();
    return { x: d.left - s.left + d.width / 2, y: d.top - s.top + d.height / 2 };
  };
  const s4 = gsap.timeline({
    defaults: { ease: desk ? "none" : "power3.out" },
    scrollTrigger: desk
      ? { trigger: sec, start: "top top", end: "+=160%", pin: true, scrub: 0.6, invalidateOnRefresh: true }
      : { trigger: sec, start: "top 60%", toggleActions: "play none none reverse" },
  });
  s4.fromTo(
    gls,
    { x: 0, y: 0, scale: 1, opacity: 1 },
    {
      x: (_i: number, el: HTMLElement) => discCentre().x - (el.offsetLeft + el.offsetWidth / 2),
      y: (_i: number, el: HTMLElement) => discCentre().y - (el.offsetTop + el.offsetHeight / 2),
      scale: 0.4,
      duration: 0.5,
      stagger: 0.015,
      ease: desk ? "power1.in" : "power2.inOut",
      // The start state is where the lights already are; measure the circle only when the gather plays.
      immediateRender: false,
    },
    0,
  )
    .to(gls, { opacity: 0, duration: 0.1 }, 0.56)
    .fromTo(D("bloom"), { scale: 0.86, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3 }, 0.54)
    .from(root.querySelectorAll('[data-a="s4-text"] > *'), { opacity: 0, y: 12, duration: 0.18, stagger: 0.06 }, 0.76)
    .from(D("s4-item"), { opacity: 0, y: 12, duration: 0.14, stagger: 0.05 }, 0.86);
  if (!desk) s4.duration(2.8);

  /* ───────── Trust · «كل كلمة لها مصدر.» ─────────
     Each word lights up and a small gold node — its source — ignites beneath it; then the body. */
  const tHead = D("trust-head")[0];
  if (tHead) {
    const words = Q(".w", tHead);
    const lit = gsap.timeline({ scrollTrigger: { trigger: tHead, start: "top 78%", once: true } });
    words.forEach((w, i) => {
      const at = i * 0.34;
      const glow = Q(".w__glow", w);
      lit.fromTo(Q(".w__i", w), { opacity: 0.25 }, { opacity: 1, duration: 0.45, ease: "power2.out" }, at)
        .fromTo(glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, ease: "sine.out" }, at)
        .to(glow, { opacity: 0, duration: 0.7, ease: "sine.in" }, at + 0.3)
        .fromTo(Q(".w__node", w), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2.6)" }, at + 0.12);
    });
    lit.fromTo(D("trust-body", tHead), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, ">-0.25");
  }

  // The lens of text writes itself, the thread draws to the source, and the source lights (seal glow).
  const fig = D("fig")[0];
  const s5 = gsap.timeline({
    defaults: { ease: desk ? "none" : "power2.out" },
    scrollTrigger: desk
      ? { trigger: fig, start: "top 80%", end: "bottom 45%", scrub: 0.6 }
      : { trigger: fig, start: "top 80%", once: true },
  });
  s5.from(D("card"), { scale: 0.9, opacity: 0, duration: 0.15 }, 0)
    .fromTo(D("bar"), { scaleX: 0 }, { scaleX: 1, duration: 0.1, stagger: 0.05, ease: "power2.out" }, 0.08)
    .fromTo(D("thread"), draw, { strokeDashoffset: 0, duration: 0.5 }, 0.3)
    .from(D("src"), { opacity: 0, y: 12, duration: 0.14 }, 0.72)
    .from(D("srcglow"), { opacity: 0, scale: 0.6, duration: 0.2 }, 0.8)
    .fromTo(D("src-seal"), { scale: 0.6, rotate: -25 }, { scale: 1, rotate: 0, duration: 0.16, ease: "back.out(2.4)" }, 0.8);
  if (!desk) s5.duration(2.6);

  // The AI's role: a gold line runs 1 → 2 → 3, lighting each step as it passes; the promise lands last
  // inside a seal-like outline that draws itself around it.
  const ai = D("ai-role")[0];
  if (ai) {
    const line = D("ai-line", ai)[0];
    const steps = D("ai-step", ai);
    const lr = line.getBoundingClientRect();
    const vertical = lr.height > lr.width;
    const axis = vertical ? "scaleY" : "scaleX";
    const len = vertical ? lr.height : lr.width;
    const origin = vertical ? lr.top : rtl() ? lr.right : lr.left;
    const frac = steps.map((st, i) => {
      const n = st.querySelector(".ai-steps__n")!.getBoundingClientRect();
      const c = vertical ? n.top + n.height / 2 : n.left + n.width / 2;
      return len ? Math.min(1, Math.max(0, Math.abs(c - origin) / len)) : i / Math.max(1, steps.length - 1);
    });
    const LINE = 1.5;
    const seal = D("seal", ai)[0] as unknown as SVGGeometryElement;
    const sealLen = () => (seal?.getTotalLength?.() ?? 0) + 2;
    const tl = gsap.timeline({ scrollTrigger: { trigger: ai, start: "top 78%", once: true }, defaults: { ease: "power3.out" } });
    tl.from(ai, { opacity: 0, y: 24, duration: 0.8 })
      .from(D("ai-h", ai), { opacity: 0, y: 10, duration: 0.6 }, 0.15)
      .fromTo(line, { [axis]: 0 }, { [axis]: 1, duration: LINE, ease: "power1.inOut" }, 0.5);
    steps.forEach((st, i) => {
      const at = 0.5 + LINE * frac[i] - 0.06;
      tl.fromTo(st, { borderColor: "#E2D8C8" }, { borderColor: "rgba(196,163,90,.55)", duration: 0.4 }, at)
        .fromTo(Q(".ai-steps__n", st), { scale: 0.7, opacity: 0.4 }, { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2.4)" }, at)
        .fromTo(Q(".ai-steps__txt", st), { opacity: 0.55 }, { opacity: 1, duration: 0.4 }, at);
    });
    const end = 0.5 + LINE + 0.1;
    tl.fromTo(D("ai-note", ai), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6 }, end);
    if (seal) {
      tl.fromTo(
        seal,
        { strokeDasharray: sealLen, strokeDashoffset: sealLen },
        {
          strokeDashoffset: 0,
          duration: 1.1,
          ease: "power2.inOut",
          onComplete: () => void gsap.set(seal, { clearProps: "strokeDasharray,strokeDashoffset" }),
        },
        end + 0.2,
      );
    }
    tl.fromTo(D("ai-shield", ai), { scale: 1.6, opacity: 0, rotate: -20 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.5, ease: "back.out(2)" }, end + 0.9);
  }

  /* ───────── Experience · «وش يشغلك اليوم؟» ─────────
     The question rises word by word; the examples and kinds cascade in; the two assurances settle under
     a gold rule that draws. A slow light travels the card's border only while the section is on screen. */
  const exp = D("exp")[0];
  ScrollTrigger.create({ trigger: exp, start: "top bottom", end: "bottom top", toggleClass: { targets: exp, className: "is-live" } });
  const qWords = Q('[data-a="exp-q"] .w__i', exp);
  gsap
    .timeline({ scrollTrigger: { trigger: exp, start: "top 72%", once: true }, defaults: { ease: "power3.out" }, onComplete: unblur(qWords) })
    .fromTo(qWords, { yPercent: 105, opacity: 0, ...blur(6) }, { yPercent: 0, opacity: 1, ...blur(0), duration: 0.8, stagger: 0.09 }, 0)
    .from(D("exp-sub", exp), { opacity: 0, y: 10, duration: 0.7 }, 0.3)
    .from(D("exp-cascade", exp), { opacity: 0, y: 10, duration: 0.5, stagger: 0.045 }, 0.45)
    .fromTo(D("assure-rule", exp), { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "power2.inOut", stagger: 0.18 }, 0.7)
    .from(D("assure", exp), { opacity: 0, y: 8, duration: 0.6, stagger: 0.18 }, 0.8);

  // Generic reveals that remain (the journey title).
  D("rv").forEach((el) =>
    gsap.from(el, { opacity: 0, y: 24, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%" } }),
  );

  /* ───────── Closing · «ابدأ من حيث أنت.» ─────────
     The lights converge into a soft dawn while the line rises word by word; three invitations light up
     as nodes on one golden thread; then the closing sentence and the button, which breathes while seen. */
  const s7 = D("s7")[0];
  ScrollTrigger.create({ trigger: s7, start: "top bottom", end: "bottom top", toggleClass: { targets: s7, className: "is-live" } });
  const title = s7.querySelector<HTMLElement>(".closing__title")!;
  const titleWords = Q(".w__i", title);
  const centre = () => {
    const s = s7.getBoundingClientRect();
    const r = title.getBoundingClientRect();
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
  };
  const thread = D("c-thread", s7)[0];
  const tr = thread.getBoundingClientRect();
  const along = tr.height > tr.width ? "scaleY" : "scaleX";
  const nodes = D("c-node", s7);
  const NODE_AT = 1.7;
  const fin = gsap.timeline({
    scrollTrigger: { trigger: s7, start: "top 70%", once: true },
    defaults: { ease: "power3.out" },
    onComplete: unblur(titleWords),
  });
  fin.to(
    D("cl", s7),
    {
      x: (_i: number, el: HTMLElement) => centre().x - (el.offsetLeft + el.offsetWidth / 2),
      y: (_i: number, el: HTMLElement) => centre().y - (el.offsetTop + el.offsetHeight / 2),
      scale: 0.3,
      opacity: 0,
      duration: 1.4,
      ease: "power2.in",
      stagger: 0.06,
    },
    0,
  )
    .fromTo(D("dawn", s7), { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 1.8, ease: "sine.out" }, 0.7)
    .fromTo(titleWords, { yPercent: 105, opacity: 0, ...blur(8) }, { yPercent: 0, opacity: 1, ...blur(0), duration: 0.9, stagger: 0.12 }, 0.8)
    .fromTo(thread, { [along]: 0 }, { [along]: 1, duration: 1.5, ease: "power1.inOut" }, NODE_AT);
  nodes.forEach((n, i) => {
    const at = NODE_AT + (1.5 * i) / Math.max(1, nodes.length - 1);
    fin.fromTo(Q(".cnode__dot", n), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2.6)" }, at)
      .fromTo(Q(".cnode__t", n), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.7 }, at + 0.1);
  });
  const after = NODE_AT + 1.5 + 0.35;
  fin.fromTo(Q(".closing__body", s7), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8 }, after)
    .fromTo(Q(".closing__cta", s7), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8 }, after + 0.4);

  return () => cleanups.forEach((f) => f());
}
