import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import App from "@/App";
import { copy } from "@/copy";
import { GuidanceResult } from "@/Journey";
import type { AnalyzeResult, GuidancePayload, PublicProvenance, VerifiedContent, VerifiedStory } from "../../shared/experience/guidance";

/* A journey modelled on «شايلة هم القروض والديون» → anxiety: 2:286, Tabari, Bukhari 5641, Bukhari 2916. */

const VERSE =
  "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَا إِنْ نَسِينَا أَوْ أَخْطَأْنَا";
const VERSE_HL = "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا";
const TAFSIR_LEAD = "قال أبو جعفر: فتأويل الآية إذا: لا يكلف الله نفسا إلا ما يسعها فلا يجهدها.";
const TAFSIR = `${TAFSIR_LEAD} ولا يضيق عليها في أمر دينها.`;
const HADITH =
  "عَنْ أَبِي سَعِيدٍ الْخُدْرِيِّ عَنِ النَّبِيِّ ﷺ قَالَ: «مَا يُصِيبُ الْمُسْلِمَ مِنْ نَصَبٍ وَلَا وَصَبٍ وَلَا هَمٍّ وَلَا حُزْنٍ إِلَّا كَفَّرَ اللهُ بِهَا مِنْ خَطَايَاهُ.»";
const HADITH_HL = "مَا يُصِيبُ الْمُسْلِمَ مِنْ نَصَبٍ وَلَا وَصَبٍ وَلَا هَمٍّ وَلَا حُزْنٍ إِلَّا كَفَّرَ اللهُ بِهَا مِنْ خَطَايَاهُ";
const BEAT_1 = "عَنْ عَائِشَةَ قَالَتْ: «تُوُفِّيَ رَسُولُ اللهِ ﷺ";
const BEAT_2 = "وَدِرْعُهُ مَرْهُونَةٌ عِنْدَ يَهُودِيٍّ بِثَلَاثِينَ صَاعًا مِنْ شَعِيرٍ»";
const KEY_QUOTE = "وَدِرْعُهُ مَرْهُونَةٌ عِنْدَ يَهُودِيٍّ";
const DUA = "يا رب فرّج همّي واقضِ عني ديني — سرّ لا يغادر الجهاز";

const prov = (over: Partial<PublicProvenance> = {}): PublicProvenance => ({
  sourceId: "s",
  sourceReference: "",
  verificationStatus: "published",
  contentOrigin: "source_text",
  verificationDisclosure: "",
  attributionDisclosure: "",
  ...over,
});

const item = (over: Partial<VerifiedContent>): VerifiedContent => ({
  content_id: "c",
  type: "quran",
  topicId: "anxiety",
  level: "A",
  published: true,
  verified: true,
  arabic: "",
  translation: "",
  place: "",
  reference: "",
  source: { name: "", reference: "" },
  provenance: prov(),
  ...over,
});

const seerah = (over: Partial<VerifiedStory> = {}): VerifiedStory => ({
  story_id: "seerah-bukhari-2916",
  topicId: "anxiety",
  level: "A",
  published: true,
  verified: true,
  title: "حين رهن النبي ﷺ درعه",
  headline: "",
  opening: "",
  body: [`${BEAT_1} ${BEAT_2}`],
  lessons: [],
  takeaway: "",
  keep: "",
  source: { name: "صحيح البخاري (ط. السلطانية) — المكتبة الشاملة", reference: "صحيح البخاري 2916", url: "https://shamela.ws/book/1681/4626" },
  provenance: prov({
    hadith: { collection: "صحيح البخاري", hadithReference: "2916", number: 2916, grade: "صحيح" },
    seerah: { sourceReference: "صحيح البخاري 2916", book: "صحيح البخاري", sourceKind: "sahih", number: 2916, volume: 4, page: 41 },
  }),
  beats: [BEAT_1, BEAT_2],
  key_quotes: [KEY_QUOTE],
  ...over,
});

const debt = (over: Partial<GuidancePayload> = {}): GuidancePayload => ({
  heading: "",
  emotional_state: { primary: "unspecified", secondary: [], confidence: 0.5 },
  context: "",
  user_need: "",
  response: [],
  remember: "",
  topic_id: "anxiety",
  content: item({
    arabic: VERSE,
    translation: "Allah does not charge a soul except [with that within] its capacity.",
    place: "سورة البقرة",
    reference: "2:286",
    source: { name: "Quranpedia", reference: "2:286" },
    highlight: VERSE_HL,
  }),
  quran_explanation: item({
    type: "tafsir",
    arabic: TAFSIR,
    place: "جامع البيان في تأويل آي القرآن — الطبري، ت. أحمد شاكر",
    reference: "2:286 · ج6 ص131",
    source: { name: "تفسير الطبري — جامع البيان في تأويل آي القرآن (Quranpedia)", reference: "2:286 · ج6 ص131", url: "https://quranpedia.net/embed?surah=2&ayah=286" },
    provenance: prov({ tafsir: { surah: 2, ayah: 286, book: "جامع البيان", author: "الطبري", volume: 6, pages: [131], editor: "أحمد شاكر", url: "https://quranpedia.net" } }),
    lead: TAFSIR_LEAD,
  }),
  hadith: item({
    type: "hadith",
    arabic: HADITH,
    place: "كتاب المرضى — باب ما جاء في كفارة المرض",
    reference: "صحيح البخاري 5641",
    source: { name: "صحيح البخاري (ط. السلطانية) — المكتبة الشاملة", reference: "صحيح البخاري 5641", url: "https://shamela.ws/book/1681/8439" },
    provenance: prov({ hadith: { collection: "صحيح البخاري", hadithReference: "5641", number: 5641, grade: "صحيح" } }),
    highlight: HADITH_HL,
  }),
  hadith_explanation: null,
  story: seerah(),
  related_topics: [],
  suggested_action: { type: "dua", title: "اكتب دعاءك", description: "ادعُ الله الآن بكلامك أنت." },
  learning_path: [],
  reflection_question: "",
  safety: { level: "normal", requires_human_support: false },
  unclear: false,
  bridges: {
    quran: "شيء من القرآن يلامس ما تعيشه",
    tafsir: "ماذا نفهم من الآية؟",
    hadith: "وفي السنة حديثٌ عن الهمّ والحزن",
    seerah: "موقف عاشه النبي ﷺ",
    connect: { title: "ما يمر بك اليوم… ليس خارج الرحلة.", points: ["ما أشعر به", "ما أتعلمه", "ما أستطيع أن أفعله الآن"] },
  },
  ...over,
});

const READING = "تحملين همّ القروض والديون.";
const analyzeResult: AnalyzeResult = {
  context_summary: READING,
  level: "A",
  safety: "safe",
  suggested_topics: [{ id: "anxiety", title: "القلق والهم" }],
  input_intent: "EXPERIENCE",
  recommended_path: "topic_discovery",
};

const ar = copy.ar;
const en = copy.en;
const stage = (k: string) => document.querySelector<HTMLElement>(`[data-stage="${k}"]`)!;
const show = (p: GuidancePayload, lang: "ar" | "en" = "ar", extra: { onNext?: (id: string) => void; onRestart?: () => void } = {}) =>
  render(
    <GuidanceResult
      analyze={analyzeResult}
      payload={p}
      t={copy[lang]}
      ar={lang === "ar"}
      onNext={extra.onNext ?? null}
      onRestart={extra.onRestart ?? (() => {})}
    />,
  );

describe("the journey, in stages", () => {
  it("tells it in order: their words → verse → tafsir → hadith → Seerah → connection → du‘a", () => {
    show(debt());
    const order = [...document.querySelectorAll<HTMLElement>("[data-stage]")].map((s) => s.dataset.stage);
    expect(order).toEqual(["you", "verse", "tafsir", "hadith", "seerah", "connect", "dua"]);
    // each stage opens with its curated bridge as a heading
    for (const [k, b] of [
      ["verse", "شيء من القرآن يلامس ما تعيشه"],
      ["tafsir", "ماذا نفهم من الآية؟"],
      ["hadith", "وفي السنة حديثٌ عن الهمّ والحزن"],
      ["seerah", "موقف عاشه النبي ﷺ"],
      ["connect", "ما يمر بك اليوم… ليس خارج الرحلة."],
      ["dua", ar.duaTitle],
    ]) {
      expect(within(stage(k)).getByRole("heading", { level: 3, name: b })).toBeInTheDocument();
    }
    // reduced motion (the test environment): every stage is lit and static from the start
    expect(document.querySelector(".jr--staged")).toBeNull();
    expect(document.querySelectorAll("[data-stage]:not(.is-on)")).toHaveLength(0);
  });

  it("falls back to neutral bridges from the copy when the payload has none", () => {
    show(debt({ bridges: undefined }));
    expect(within(stage("verse")).getByRole("heading", { name: ar.bridgeQuran })).toBeInTheDocument();
    expect(within(stage("tafsir")).getByRole("heading", { name: ar.bridgeTafsir })).toBeInTheDocument();
    expect(within(stage("hadith")).getByRole("heading", { name: ar.bridgeHadith })).toBeInTheDocument();
    expect(within(stage("seerah")).getByRole("heading", { name: ar.bridgeSeerah })).toBeInTheDocument();
    expect(within(stage("connect")).getByRole("heading", { name: ar.connectTitle })).toBeInTheDocument();
    ar.connectPoints.forEach((p) => expect(within(stage("connect")).getByText(p)).toBeInTheDocument());
  });

  it("verse: verbatim, cut only at spaces, its clause lit, the ayah number and an exact source chip", () => {
    show(debt());
    const v = stage("verse").querySelector<HTMLElement>(".verse")!;
    const ayah = v.querySelector(".ayah")!;
    expect(ayah).toHaveTextContent("٢٨٦");
    expect(v.textContent!.replace(ayah.textContent!, "").trim()).toBe(VERSE);
    expect([...v.querySelectorAll(".vr")].length).toBeGreaterThan(1);
    expect([...v.querySelectorAll(".lit")].map((l) => l.textContent).join("")).toBe(VERSE_HL);
    const chip = stage("verse").querySelector(".src-chip")!;
    expect(chip).toHaveTextContent("البقرة 2:286 · Quranpedia");
    expect(chip).toHaveTextContent(ar.verifiedSource);
  });

  it("verse without a highlight is shown whole, nothing lit", () => {
    show(debt({ content: { ...debt().content!, highlight: undefined } }));
    expect(stage("verse").querySelector(".lit")).toBeNull();
    expect(stage("verse").querySelector(".verse")!.textContent).toContain(VERSE);
  });

  it("tafsir: the lead first; «عرض التفسير كاملًا» opens the full excerpt (an accessible disclosure)", () => {
    show(debt());
    const s = stage("tafsir");
    const text = s.querySelector<HTMLElement>(".aside__text")!;
    expect(text.textContent).toBe(TAFSIR_LEAD);
    const btn = within(s).getByRole("button", { name: ar.showFullTafsir });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveAttribute("aria-controls", text.id);
    fireEvent.click(btn);
    expect(text.textContent).toBe(TAFSIR);
    expect(within(s).getByRole("button", { name: ar.showLess })).toHaveAttribute("aria-expanded", "true");
    expect(s.querySelector(".src-chip")).toHaveTextContent("تفسير الطبري، ت. أحمد شاكر · ج6 ص131");
    expect(within(s).getByRole("link")).toHaveAttribute("href", "https://quranpedia.net/embed?surah=2&ayah=286");
  });

  it("tafsir: no disclosure when the lead is the whole excerpt, or absent", () => {
    show(debt({ quran_explanation: { ...debt().quran_explanation!, lead: TAFSIR } }));
    expect(within(stage("tafsir")).queryByRole("button", { name: ar.showFullTafsir })).toBeNull();
    expect(stage("tafsir").querySelector(".aside__text")!.textContent).toBe(TAFSIR);
  });

  it("hadith: the focal line between «…» cues (decoration only), the grade and its chip; the full text on request", () => {
    show(debt());
    const s = stage("hadith");
    const q = s.querySelector<HTMLElement>("blockquote")!;
    expect(q.querySelector(".hq__line")!.textContent).toBe(HADITH_HL);
    const cues = [...q.querySelectorAll(".hq__cue")];
    expect(cues).toHaveLength(2);
    cues.forEach((c) => expect(c).toHaveAttribute("aria-hidden", "true"));
    expect(q).toHaveTextContent(ar.excerpt); // screen readers hear that it is an excerpt
    expect(s.querySelector(".grade-tag")).toHaveTextContent(`${ar.grade}: صحيح`);
    expect(s.querySelector(".src-chip")).toHaveTextContent("صحيح البخاري · 5641");
    expect(within(s).getByRole("link")).toHaveAttribute("href", "https://shamela.ws/book/1681/8439");
    expect(s).toHaveTextContent("كتاب المرضى — باب ما جاء في كفارة المرض");

    const btn = within(s).getByRole("button", { name: ar.showFullHadith });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(q.textContent).toBe(HADITH);
    expect(q.querySelector(".hq__cue")).toBeNull();
    expect(q.querySelector(".lit")!.textContent).toBe(HADITH_HL);
  });

  it("hadith without a highlight: the whole text, no disclosure", () => {
    show(debt({ hadith: { ...debt().hadith!, highlight: undefined } }));
    expect(stage("hadith").querySelector("blockquote")!.textContent).toBe(HADITH);
    expect(within(stage("hadith")).queryByRole("button", { name: ar.showFullHadith })).toBeNull();
  });

  it("Seerah: the event as a title, its beats in order with the key words lit, the source chip — no grade", () => {
    show(debt());
    const s = stage("seerah");
    expect(within(s).getByRole("heading", { level: 4, name: "حين رهن النبي ﷺ درعه" })).toBeInTheDocument();
    const beats = [...s.querySelectorAll(".beat")];
    expect(beats.map((b) => b.textContent)).toEqual([BEAT_1, BEAT_2]);
    expect(beats.map((b) => b.textContent).join(" ")).toBe(debt().story!.body.join(" "));
    expect([...s.querySelectorAll(".kq")].map((k) => k.textContent)).toEqual([KEY_QUOTE]);
    expect(s.querySelector(".src-chip")).toHaveTextContent("صحيح البخاري · 2916");
    expect(s.querySelector(".grade-tag")).toBeNull();
    expect(s).not.toHaveTextContent(ar.grade);
    // line-art only: decorative, out of the accessibility tree, no figures
    expect(s.querySelector(".sky")).toHaveAttribute("aria-hidden", "true");
  });

  it("Seerah without beats: the whole passage; a Seerah book shows volume/page and never a grade", () => {
    show(
      debt({
        story: seerah({
          beats: undefined,
          key_quotes: undefined,
          body: ["فقرة أولى من السيرة.", "فقرة ثانية من السيرة."],
          source: { name: "سيرة ابن هشام", reference: "ج1 ص236" },
          provenance: prov({ seerah: { sourceReference: "ج1 ص236", book: "سيرة ابن هشام", sourceKind: "seerah_book", volume: 1, page: 236 } }),
        }),
      }),
    );
    const s = stage("seerah");
    expect([...s.querySelectorAll(".beat")].map((b) => b.textContent)).toEqual(["فقرة أولى من السيرة.", "فقرة ثانية من السيرة."]);
    expect(s.querySelector(".src-chip")).toHaveTextContent("سيرة ابن هشام · ج1 ص236");
    expect(s).not.toHaveTextContent("صحيح");
  });

  it("connection: three points on one line, the topic's practical step under the third; no old step card", () => {
    show(debt());
    const s = stage("connect");
    const points = [...s.querySelectorAll(".cpoint")];
    expect(points.map((p) => p.querySelector(".cpoint__t")!.textContent)).toEqual(["ما أشعر به", "ما أتعلمه", "ما أستطيع أن أفعله الآن"]);
    expect(points[2].querySelector(".cpoint__step")).toHaveTextContent("اكتب دعاءك");
    expect(points[2].querySelector(".cpoint__step")).toHaveTextContent("ادعُ الله الآن بكلامك أنت.");
    expect(document.querySelector(".step-card")).toBeNull();
    expect(screen.queryByText("خطوة بسيطة")).toBeNull();
  });

  it("«تابع» takes focus to the next stage's heading — it never moves on by itself", () => {
    show(debt());
    const go = within(stage("verse")).getByRole("button", { name: ar.continueLabel });
    expect(go).toHaveAccessibleDescription("ماذا نفهم من الآية؟");
    fireEvent.click(go);
    expect(document.activeElement).toBe(within(stage("tafsir")).getByRole("heading", { level: 3 }));
    expect(within(stage("dua")).queryByRole("button", { name: ar.continueLabel })).toBeNull();
  });

  it("du‘a box: labelled, private by design; «أختم رحلتي» ends, the related topic is a quiet second way", () => {
    const onNext = vi.fn();
    const onRestart = vi.fn();
    show(debt({ related_topics: [{ id: "hope", title: "الرجاء" }] }), "ar", { onNext, onRestart });
    const box = within(stage("dua")).getByRole("textbox", { name: ar.duaTitle });
    expect(box).toHaveAttribute("placeholder", ar.duaPlaceholder);
    expect(box).not.toHaveAttribute("name");
    expect(box.closest("form")).toBeNull();
    expect(box).toHaveAttribute("spellcheck", "false");
    expect(box).toHaveAttribute("autocomplete", "off");
    expect(box).toHaveAccessibleDescription(`${ar.duaSub} ${ar.duaPrivacy}`);
    fireEvent.change(box, { target: { value: DUA } });
    fireEvent.click(within(stage("dua")).getByRole("button", { name: ar.endJourney }));
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
    expect(box).toHaveValue("");
    fireEvent.change(box, { target: { value: DUA } });
    fireEvent.click(within(stage("dua")).getByRole("button", { name: `${ar.nextPath}: الرجاء` }));
    expect(onNext).toHaveBeenCalledWith("hope");
    expect(box).toHaveValue("");
  });

  it("English: labels in English, Arabic-only sources noted, chips read right to left", () => {
    show(debt({ bridges: undefined }), "en");
    expect(within(stage("verse")).getByRole("heading", { name: en.bridgeQuran })).toBeInTheDocument();
    expect(screen.getByText(/Allah does not charge a soul/)).toBeInTheDocument();
    expect(screen.getAllByText(en.arabicOnly).length).toBeGreaterThanOrEqual(2);
    expect(stage("hadith").querySelector(".src-chip__t")).toHaveAttribute("dir", "rtl");
    expect(stage("verse").querySelector(".src-chip__t")).not.toHaveAttribute("dir");
    expect(within(stage("dua")).getByRole("button", { name: en.endJourney })).toBeInTheDocument();
  });
});

/* ───────── the du‘a never leaves the page ───────── */

const reply = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

describe("du‘a privacy (whole app)", () => {
  let fetchMock: Mock;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const toJourney = async (journey: GuidancePayload) => {
    fetchMock
      .mockReturnValueOnce(reply({ ok: true, mode: "live", route: "topic_discovery", analyze: analyzeResult }))
      .mockReturnValueOnce(reply({ ok: true, mode: "live", payload: journey }));
    render(<App />);
    fireEvent.change(document.querySelector("#tm-text")!, { target: { value: "شايلة هم القروض والديون" } });
    fireEvent.click(document.querySelector<HTMLButtonElement>(".composer__send")!);
    fireEvent.click(await screen.findByRole("button", { name: /القلق والهم/ }));
    return screen.findByRole("textbox", { name: ar.duaTitle });
  };

  it("is never sent in any request and never written to storage", async () => {
    const setLocal = vi.spyOn(Storage.prototype, "setItem");
    const box = await toJourney(debt({ related_topics: [{ id: "hope", title: "الرجاء" }] }));
    fetchMock.mockReturnValueOnce(reply({ ok: true, mode: "live", payload: debt({ topic_id: "hope" as never }) }));
    fireEvent.change(box, { target: { value: DUA } });
    fireEvent.click(screen.getByRole("button", { name: `${ar.nextPath}: الرجاء` }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const bodies = fetchMock.mock.calls.map((c) => String((c[1] as RequestInit).body));
    expect(JSON.parse(bodies[2])).toMatchObject({ stage: "journey", topicId: "hope" });
    for (const b of bodies) expect(b).not.toContain("فرّج همّي");
    expect(setLocal).not.toHaveBeenCalled();
    expect(JSON.stringify({ ...localStorage })).not.toContain("فرّج همّي");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain("فرّج همّي");
    // the next journey starts with an empty box
    expect(await screen.findByRole("textbox", { name: ar.duaTitle })).toHaveValue("");
  }, 20_000);

  it("«أختم رحلتي» returns to «وش يشغلك اليوم؟» with a fresh composer, focused", async () => {
    const box = await toJourney(debt({ related_topics: [{ id: "hope", title: "الرجاء" }] }));
    fireEvent.change(box, { target: { value: DUA } });
    fireEvent.click(screen.getByRole("button", { name: ar.endJourney }));
    const composer = await screen.findByRole("textbox", { name: ar.question });
    expect(composer).toHaveValue("");
    await waitFor(() => expect(document.activeElement).toBe(composer));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(DUA)).toBeNull();
    expect(document.body.textContent).not.toContain("فرّج همّي");
  }, 20_000);
});
