import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import App from "@/App";
import { chipList, copy } from "@/copy";
import { CLIENT_TIMEOUT_MS } from "@/understand";
import type { AnalyzeResult, GuidancePayload, LessonItem, VerifiedContent, VerifiedStory } from "../../shared/experience/guidance";

/* ───────── fixtures (test-only strings, so every assertion proves the text came from the response) ───────── */

const VERSE_1 = "نص الآية الأولى من الخادم";
const VERSE_2 = "نص الآية الثانية من الخادم";

const verse = (over: Partial<VerifiedContent> = {}): VerifiedContent => ({
  content_id: "quran-test",
  type: "quran",
  topicId: "patience",
  level: "A",
  published: true,
  verified: true,
  title: "عنوان من الكتالوج",
  arabic: `${VERSE_1} ۝ ${VERSE_2}`,
  translation: "Translation returned by the server.",
  place: "سورة الاختبار",
  reference: "94:5-6",
  source: { name: "Quranpedia", reference: "94:5-6" },
  provenance: {
    sourceId: "tmn-src-quran-mushaf",
    sourceReference: "94:5-6",
    verificationStatus: "published",
    contentOrigin: "source_text",
    verificationDisclosure: "",
    attributionDisclosure: "",
  },
  ...over,
});

const story = (over: Partial<VerifiedStory> = {}): VerifiedStory => ({
  story_id: "story-test",
  topicId: "patience",
  level: "A",
  published: true,
  verified: true,
  // A verbatim Seerah excerpt: event title, the source's own paragraphs, book/volume/page + link;
  // editorial fields empty. The provenance carries a grade on purpose: the Seerah card must not show it.
  title: "عنوان الموقف من الخادم",
  headline: "",
  opening: "",
  body: ["الفقرة الأولى من الخادم", "الفقرة الثانية من الخادم"],
  lessons: [],
  takeaway: "",
  keep: "",
  source: { name: "كتاب السيرة (اختبار)", reference: "ج1 ص100", url: "https://example.org/seerah" },
  provenance: {
    sourceId: "tmn-src-seerah-dorar",
    sourceReference: "ج1 ص100",
    verificationStatus: "published",
    contentOrigin: "source_text",
    verificationDisclosure: "",
    attributionDisclosure: "",
    hadith: { collection: "اختبار", hadithReference: "1", grade: "صحيح" },
  },
  ...over,
});

const lesson = (over: Partial<LessonItem> = {}): LessonItem => ({
  id: "lesson-test",
  topicId: "patience",
  aspect: "how",
  title_ar: "عنوان القسم من الخادم",
  title_en: "Section heading (test)",
  body_ar: "نص القسم كما ورد في المصدر",
  source: { name: "مصدر القسم", reference: "ص 3", url: "https://example.org/lesson" },
  ...over,
});

const payload = (over: Partial<GuidancePayload> = {}): GuidancePayload => ({
  heading: "",
  emotional_state: { primary: "unspecified", secondary: [], confidence: 0.5 },
  context: "",
  user_need: "",
  response: [],
  remember: "",
  topic_id: "patience",
  content: verse(),
  story: null,
  related_topics: [],
  suggested_action: { type: "reach_out", title: "", description: "" },
  learning_path: [],
  reflection_question: "",
  safety: { level: "normal", requires_human_support: false },
  unclear: false,
  ...over,
});

const READING = "يبدو إنك متعب من محاولات ما تبان نتيجتها.";

const analyze = (over: Partial<AnalyzeResult> = {}): AnalyzeResult => ({
  context_summary: READING,
  level: "B",
  safety: "safe",
  suggested_topics: [
    { id: "patience", title: "الصبر", reason: "لأنك تقول إنك تحاول من زمان" },
    { id: "hope", title: "الأمل" },
  ],
  input_intent: "FEELING",
  recommended_path: "topic_discovery",
  ...over,
});

/* ───────── fetch mock ───────── */

const reply = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

let fetchMock: Mock;
const bodyOf = (call: number) => JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/* ───────── helpers ───────── */

const write = (s: string) => fireEvent.change(screen.getByRole("textbox"), { target: { value: s } });
const sendButton = () => document.querySelector<HTMLButtonElement>(".composer__foot button")!;
const toEnglish = () => fireEvent.click(screen.getByRole("button", { name: "English" }));
const ar = copy.ar;
const en = copy.en;
/** «سؤال يشغلني» / "A question on my mind" */
const QUESTION_CHIP = chipList[1];

describe("Tamaninah landing", () => {
  it("renders the Arabic hero by default, right-to-left", () => {
    const { container } = render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("كل تجربة ممكن تكون بداية لاكتشاف الإسلام.");
    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
  });

  it("switches to English", () => {
    const { container } = render(<App />);
    toEnglish();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Every experience could be the beginning of discovering Islam.");
    expect(container.firstElementChild).toHaveAttribute("dir", "ltr");
    expect(document.documentElement.lang).toBe("en");
  });

  it("shows the AI + privacy note by the composer and no religious text before a response", () => {
    render(<App />);
    expect(screen.getByText(/طمأنينة أداة مدعومة بالذكاء الاصطناعي/)).toBeInTheDocument();
    expect(screen.getByText("خصوصيتك مهمة. لا تحتاج طمأنينة إلى اسمك أو بياناتك الشخصية. اكتب فقط ما تحتاجه لتبدأ رحلتك.")).toBeInTheDocument();
    expect(document.querySelector(".verse, .card")).toBeNull();
    expect(sendButton()).toBeDisabled();
  });
});

describe("experience · topic discovery → journey", () => {
  it("reads the words, offers catalog topics, and renders the journey from the response", async () => {
    fetchMock
      .mockReturnValueOnce(reply({ ok: true, mode: "live", route: "topic_discovery", analyze: analyze() }))
      .mockReturnValueOnce(
        reply({
          ok: true,
          mode: "live",
          payload: payload({ story: story(), related_topics: [{ id: "hope", title: "الأمل" }] }),
        }),
      )
      .mockReturnValueOnce(reply({ ok: true, mode: "live", payload: payload({ topic_id: "hope", related_topics: [] }) }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: QUESTION_CHIP[0] }));
    write("تعبت من كل شيء");
    fireEvent.click(sendButton());

    expect(screen.getByRole("status")).toHaveTextContent("أقرأ ما كتبته…");
    expect(screen.getByText("تعبت من كل شيء")).toBeInTheDocument();
    expect(bodyOf(0)).toEqual({ stage: "analyze", message: "تعبت من كل شيء\n\n(نوع ما أكتبه: سؤال يشغلني)", language: "ar" });

    // Topic discovery: the AI's reading (tagged as such) + catalog titles with the model's reason
    const topic = await screen.findByRole("button", { name: /الصبر/ });
    expect(screen.getByText(READING)).toBeInTheDocument();
    expect(screen.getByText("قراءة الذكاء الاصطناعي لكلامك")).toBeInTheDocument();
    expect(screen.getByText("لأنك تقول إنك تحاول من زمان")).toBeInTheDocument();
    expect(document.activeElement).toHaveTextContent("فهمت عليك");

    fireEvent.click(topic);
    expect(screen.getByRole("status")).toHaveTextContent(ar.thinkingJourney[0]);
    expect(bodyOf(1)).toEqual({
      stage: "journey",
      message: "تعبت من كل شيء\n\n(نوع ما أكتبه: سؤال يشغلني)",
      language: "ar",
      topicId: "patience",
      analyzeLevel: "B",
    });

    // The verse, its numbers, verified source and chip all come from the mocked payload
    const verseEl = (await screen.findByText(new RegExp(VERSE_1))).closest("p")!;
    expect(verseEl).toHaveAttribute("lang", "ar");
    expect(verseEl).toHaveTextContent(VERSE_2);
    expect(within(verseEl).getByText("٥")).toBeInTheDocument();
    expect(within(verseEl).getByText("٦")).toBeInTheDocument();
    const verseChip = document.querySelector('[data-stage="verse"] .src-chip')!;
    expect(verseChip).toHaveTextContent("مصدر موثّق");
    expect(verseChip).toHaveTextContent("الاختبار 94:5-6 · Quranpedia");
    expect(screen.queryByText(/Translation returned by the server\./)).toBeNull(); // Arabic UI
    expect(document.activeElement).toHaveTextContent("فهمت عليك");

    // The Seerah scene: the event as its title, the passage beat by beat (here its paragraphs); only
    // the parts that exist; never a grade; the source as a linked chip.
    const seerah = document.querySelector<HTMLElement>('[data-stage="seerah"]')!;
    expect(within(seerah).getByRole("heading", { level: 3, name: ar.bridgeSeerah })).toBeInTheDocument();
    expect(within(seerah).getByRole("heading", { level: 4, name: "عنوان الموقف من الخادم" })).toBeInTheDocument();
    expect([...seerah.querySelectorAll(".beat")].map((b) => b.textContent)).toEqual(["الفقرة الأولى من الخادم", "الفقرة الثانية من الخادم"]);
    expect(seerah.querySelector(".seerah__aside, .grade-tag")).toBeNull();
    expect(seerah).not.toHaveTextContent("صحيح");
    expect(within(seerah).getByRole("link", { name: /كتاب السيرة\s+ج1 ص100/ })).toHaveAttribute("href", "https://example.org/seerah");

    // No practical step when the server sends an empty suggested action; the old step card is gone
    expect(document.querySelector(".cpoint__step, .step-card")).toBeNull();

    // The related catalog topic is a second way out of the ending; it runs a real journey request
    expect(screen.getByText("الأمل", { selector: ".dua__rel bdi" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `${ar.nextPath}: الأمل` }));
    expect(bodyOf(2)).toMatchObject({ stage: "journey", topicId: "hope", analyzeLevel: "B" });
    expect(await screen.findByRole("button", { name: ar.endJourney })).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector(".dua__rel")).toBeNull());
  }, 20_000);

  it("renders direct_learning straight away, with no story card when none is returned", async () => {
    fetchMock.mockReturnValueOnce(
      reply({
        ok: true,
        mode: "live",
        route: "direct_learning",
        analyze: analyze({ recommended_path: "direct_learning" }),
        payload: payload({ suggested_action: { type: "quran", title: "عنوان الخطوة من الخادم", description: "وصف الخطوة من الخادم" } }),
      }),
    );
    render(<App />);
    write("أبي أتعلم عن الصبر");
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", ctrlKey: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(await screen.findByText(new RegExp(VERSE_1))).toBeInTheDocument();
    expect(screen.getByText(READING)).toBeInTheDocument();
    expect(document.querySelector('[data-stage="seerah"]')).toBeNull();
    // The step sits under «ما أستطيع أن أفعله الآن»
    const third = [...document.querySelectorAll(".cpoint")][2];
    expect(third).toHaveTextContent(ar.connectPoints[2]);
    expect(within(third as HTMLElement).getByText("عنوان الخطوة من الخادم")).toBeInTheDocument();
    expect(within(third as HTMLElement).getByText("وصف الخطوة من الخادم")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ar.endJourney })).toBeInTheDocument();
  }, 20_000);
});

describe("experience · knowledge answers", () => {
  it("shows a glossary answer verbatim with its English term and source link", async () => {
    fetchMock.mockReturnValueOnce(
      reply({
        ok: true,
        mode: "live",
        route: "knowledge",
        analyze: analyze({ context_summary: "تسأل عن معنى مصطلح.", suggested_topics: [] }),
        answer: {
          kind: "glossary",
          id: "g-1",
          level: "A",
          domain: "terminology",
          title_ar: "عنوان المصطلح",
          title_en: "Term title",
          body_ar: "تعريف المصطلح كما ورد في المسرد",
          term_en: "Term / English equivalent",
          source: { name: "الجمهرة", reference: "المسرد", url: "https://islamic-content.com/dictionary" },
        },
      }),
    );
    render(<App />);
    write("وش معنى المصطلح؟");
    fireEvent.click(sendButton());

    expect(await screen.findByText("تعريف المصطلح كما ورد في المسرد")).toHaveAttribute("lang", "ar");
    expect(screen.getByRole("heading", { name: "عنوان المصطلح" })).toBeInTheDocument();
    expect(screen.getByText("Term / English equivalent")).toBeInTheDocument();
    expect(screen.getByText("نص المصدر")).toBeInTheDocument();
    expect(screen.queryByText(/مقتطف من الجواب/)).toBeNull();
    const link = screen.getByRole("link", { name: /افتح المصدر/ });
    expect(link).toHaveAttribute("href", "https://islamic-content.com/dictionary");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("marks a Q&A answer as an excerpt and, in English, says the source is Arabic", async () => {
    fetchMock.mockReturnValueOnce(
      reply({
        ok: true,
        mode: "live",
        route: "knowledge",
        analyze: analyze({ context_summary: "", suggested_topics: [] }),
        answer: {
          kind: "qa",
          id: "qa-1",
          level: "A",
          domain: "shubuhat",
          title_ar: "عنوان السؤال",
          title_en: "Question title",
          body_ar: "مقتطف الجواب من المصدر",
          source: { name: "بينات", reference: "سؤال ١", url: "https://dawa.center/file/7937" },
        },
      }),
    );
    render(<App />);
    toEnglish();
    write("A question");
    fireEvent.click(sendButton());

    expect(await screen.findByRole("heading", { name: "Question title" })).toBeInTheDocument();
    expect(screen.getByText("مقتطف الجواب من المصدر")).toBeInTheDocument();
    expect(screen.getByText("An excerpt from the answer — read the full answer at the source")).toBeInTheDocument();
    expect(screen.getByText("Shown in Arabic, as published in its source.")).toBeInTheDocument();
    expect(bodyOf(0).language).toBe("en");
  });
});

describe("experience · referrals and honest gaps", () => {
  it("self-harm shows «أنت مهم» with human help, and no religious content", async () => {
    fetchMock.mockReturnValueOnce(
      reply({
        ok: true,
        mode: "live",
        referral: { kind: "referral", reason: "self_harm", level: "D", context_summary: "", message: "server text" },
      }),
    );
    render(<App />);
    write("…");
    fireEvent.click(sendButton());

    const h = await screen.findByRole("heading", { name: "أنت مهم" });
    await waitFor(() => expect(document.activeElement).toBe(h));
    expect(screen.getByText(/تواصل الآن مع شخص تثق فيه/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ابحث عن خط مساعدة في بلدك/ })).toHaveAttribute("href", "https://findahelpline.com");
    expect(document.querySelector(".verse, .card--verse")).toBeNull();
  });

  it("level D shows the server's message with the no-personal-fatwa framing and the general-info pointer", async () => {
    fetchMock.mockReturnValueOnce(
      reply({
        ok: true,
        mode: "live",
        referral: { kind: "referral", reason: "level_d", level: "D", context_summary: "", message: "رسالة الإحالة من الخادم" },
        pointer: {
          domain: "fiqh",
          label_ar: "الفقه العام",
          label_en: "General fiqh",
          rule_ar: "قاعدة الاستخدام",
          sources: [{ name: "الموسوعة الفقهية", url: "https://dorar.net/feqhia" }],
        },
      }),
    );
    render(<App />);
    write("سؤال عن حالتي");
    fireEvent.click(sendButton());

    expect(await screen.findByText("رسالة الإحالة من الخادم")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "سؤالك يحتاج أهل العلم" })).toBeInTheDocument();
    expect(screen.getByText(/لا تُصدر فتوى شخصية/)).toBeInTheDocument();
    expect(screen.getByText(/وللمعلومات العامة في هذا الباب/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /الموسوعة الفقهية/ })).toHaveAttribute("href", "https://dorar.net/feqhia");
  });

  it("journey referral_required lands on the scholar referral too", async () => {
    fetchMock
      .mockReturnValueOnce(reply({ ok: true, mode: "live", route: "topic_discovery", analyze: analyze() }))
      .mockReturnValueOnce(reply({ ok: false, error: "referral_required" }, 422));
    render(<App />);
    write("كلام");
    fireEvent.click(sendButton());
    fireEvent.click(await screen.findByRole("button", { name: /الأمل/ }));
    expect(await screen.findByRole("heading", { name: "سؤالك يحتاج أهل العلم" })).toBeInTheDocument();
  });

  it("insufficient reference is honest and points to the approved source", async () => {
    fetchMock.mockReturnValueOnce(
      reply(
        {
          ok: false,
          error: "insufficient_reference",
          pointer: {
            domain: "fiqh",
            label_ar: "الفقه العام",
            label_en: "General fiqh",
            rule_ar: "قاعدة الاستخدام كما في الملف",
            sources: [{ name: "الموسوعة الفقهية", url: "https://dorar.net/feqhia" }],
          },
        },
        422,
      ),
    );
    render(<App />);
    write("سؤال فقهي");
    fireEvent.click(sendButton());

    expect(await screen.findByRole("heading", { name: /ما وجدنا في مصادرنا المعتمدة ما يكفي/ })).toBeInTheDocument();
    expect(screen.getByText("الفقه العام")).toBeInTheDocument();
    expect(screen.getByText("قاعدة الاستخدام كما في الملف")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /الموسوعة الفقهية/ })).toHaveAttribute("href", "https://dorar.net/feqhia");

    fireEvent.click(screen.getByRole("button", { name: "اكتب بطريقة ثانية" }));
    expect(screen.getByRole("textbox")).toHaveValue("سؤال فقهي");
  });

  it("unclear asks for a little more and returns to the composer", async () => {
    fetchMock.mockReturnValueOnce(reply({ ok: false, error: "unclear" }, 422));
    render(<App />);
    write("همم");
    fireEvent.click(sendButton());
    fireEvent.click(await screen.findByRole("button", { name: /أكمل الكتابة/ }));
    expect(screen.getByRole("textbox")).toHaveValue("همم");
  });
});

describe("experience · resilience", () => {
  it("times out on the client after 20 s, then retry resends the same request", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))),
        ),
    );
    render(<App />);
    write("تعبت");
    fireEvent.click(sendButton());
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CLIENT_TIMEOUT_MS);
    });
    expect(screen.getByRole("heading", { name: "ما قدرنا نكمل الحين" })).toBeInTheDocument();
    vi.useRealTimers();

    fetchMock.mockReturnValueOnce(reply({ ok: true, mode: "live", route: "topic_discovery", analyze: analyze() }));
    fireEvent.click(screen.getByRole("button", { name: /حاول مرة ثانية/ }));
    expect(await screen.findByRole("button", { name: /الصبر/ })).toBeInTheDocument();
    expect(bodyOf(1)).toEqual(bodyOf(0));
  });

  it("network failure and malformed responses become the gentle retry state", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<App />);
    write("تعبت");
    fireEvent.click(sendButton());
    expect(await screen.findByRole("heading", { name: "ما قدرنا نكمل الحين" })).toBeInTheDocument();

    fetchMock.mockReturnValueOnce(reply({ ok: true, mode: "live", route: "direct_learning", analyze: analyze() }));
    fireEvent.click(screen.getByRole("button", { name: /حاول مرة ثانية/ }));
    expect(await screen.findByRole("heading", { name: "ما قدرنا نكمل الحين" })).toBeInTheDocument();
    expect(document.querySelector(".verse")).toBeNull();
  });

  it("rate limiting says to wait a minute", async () => {
    fetchMock.mockReturnValueOnce(reply({ ok: false, error: "rate" }, 429));
    render(<App />);
    write("تعبت");
    fireEvent.click(sendButton());
    expect(await screen.findByText(/انتظر دقيقة/)).toBeInTheDocument();
  });

  it("«عدّل» aborts the request in flight and keeps the words", () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return new Promise(() => undefined);
    });
    render(<App />);
    write("كلامي");
    fireEvent.click(sendButton());
    fireEvent.click(screen.getByRole("button", { name: "عدّل" }));
    expect(signal?.aborted).toBe(true);
    expect(screen.getByRole("textbox")).toHaveValue("كلامي");
  });
});

describe("experience · English", () => {
  it("labels switch to English and the verse shows its returned translation", async () => {
    fetchMock.mockReturnValueOnce(
      reply({
        ok: true,
        mode: "live",
        route: "direct_learning",
        analyze: analyze({ context_summary: "It sounds like you are worn out." }),
        payload: payload(),
      }),
    );
    render(<App />);
    toEnglish();
    fireEvent.click(screen.getByRole("button", { name: QUESTION_CHIP[1] }));
    expect(screen.getByText(en.privacyNote)).toBeInTheDocument();
    write("What does patience mean?");
    fireEvent.click(sendButton());
    expect(screen.getByRole("status")).toHaveTextContent("Reading what you wrote…");
    expect(bodyOf(0)).toEqual({
      stage: "analyze",
      message: "What does patience mean?\n\n(What I’m writing about: A question on my mind)",
      language: "en",
    });

    expect(await screen.findByText("What I understood")).toBeInTheDocument();
    expect(screen.getByText("The AI’s reading of your words")).toBeInTheDocument();
    expect(screen.getByText("It sounds like you are worn out.")).toHaveAttribute("lang", "en");
    expect(document.querySelector(".src-chip")).toHaveTextContent("Verified source");
    expect(screen.getByText(/Translation returned by the server\./)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(VERSE_1)).closest("p")).toHaveAttribute("dir", "rtl");

    // Switching language keeps the result; only the labels change.
    fireEvent.click(screen.getByRole("button", { name: "العربية" }));
    expect(screen.getByText("فهمت عليك")).toBeInTheDocument();
    expect(screen.getByText("It sounds like you are worn out.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("footer", () => {
  it("lists the approved sources in a dialog", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: "عن المنصة" })).toHaveAttribute("href", "#journey");
    fireEvent.click(screen.getByRole("button", { name: "المصادر المعتمدة" }));
    const dialog = screen.getByRole("dialog", { name: "المصادر المعتمدة" });
    expect(within(dialog).getByRole("link", { name: /dorar\.net\/tafseer/ })).toHaveAttribute("href", "https://dorar.net/tafseer");
    expect(within(dialog).getByText(/طبعة مجمع الملك فهد/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "إغلاق" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("discovery positioning", () => {
  it("tells the whole story in order: any experience → topics → choose → learn from sources", () => {
    render(<App />);
    expect(document.title).toBe(ar.docTitle);
    // Scene 2: the example and the topics it could lead to.
    expect(screen.getByRole("heading", { name: ar.s2Lead })).toBeInTheDocument();
    const tags = within(screen.getByRole("list", { name: ar.s2TopicsLabel })).getAllByRole("listitem");
    expect(tags.map((t) => t.textContent)).toEqual(ar.s2Topics);
    expect(screen.getByText(ar.s2TopicsNote)).toBeInTheDocument();
    // Split for its signature entrance, but still exactly the copy, with both audiences marked.
    expect(document.querySelector(".human__who")!.textContent).toBe(ar.s2Who);
    expect(document.querySelectorAll(".human__who .mk--highlight")).toHaveLength(2);
    // Gateway: three sources only.
    expect(document.querySelectorAll("#story .story__item")).toHaveLength(3);
    // Journey: four numbered stations on each rail.
    for (const rail of document.querySelectorAll(".rail-d, .rail-m")) {
      const items = rail.querySelectorAll("li");
      expect(items).toHaveLength(4);
      expect([...items].map((li) => li.querySelector(".st-num")?.textContent)).toEqual(["01", "02", "03", "04"]);
      expect([...items].map((li) => li.querySelector("strong")?.textContent)).toEqual(ar.stations.map(([title]) => title));
    }
    // Gateway: the topic's four sources.
    expect(screen.getByRole("heading", { level: 2, name: `${ar.storyLine1} ${ar.storyLine2}` })).toBeInTheDocument();
    for (const [title, body] of ar.storyItems) {
      expect(screen.getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
      expect(screen.getByText(body)).toBeInTheDocument();
    }
    expect(screen.getByText(ar.storyFoot)).toBeInTheDocument();
    // Trust: what the AI does, and what it never does.
    expect(screen.getByRole("heading", { name: ar.aiRoleTitle })).toBeInTheDocument();
    const steps = document.querySelector("ol.ai-steps")!;
    expect([...steps.querySelectorAll(".ai-steps__txt")].map((e) => e.textContent)).toEqual(ar.aiRoleSteps);
    expect([...steps.querySelectorAll(".ai-steps__n")].map((e) => e.textContent)).toEqual(["1", "2", "3"]);
    expect(screen.getByText(ar.aiRoleNote).tagName).toBe("STRONG");
    // Closing.
    expect(document.querySelector(".closing__nodes")!.textContent).toBe(ar.closingLead);
    expect(document.querySelectorAll(".closing__nodes .cnode")).toHaveLength(3);
    expect(screen.getByText(ar.closingBody)).toBeInTheDocument();
    // The closing no longer repeats the brand and tagline (the footer keeps the brand).
    expect(document.getElementById("begin")).not.toHaveTextContent(ar.tagline);
    expect(document.getElementById("begin")).not.toHaveTextContent("Tamaninah");
    expect(screen.getByRole("button", { name: ar.closingCta })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Global AI Challenge");
  });

  it("English has every section too, and the document title follows the language", () => {
    render(<App />);
    toEnglish();
    expect(document.title).toBe(en.docTitle);
    expect(screen.getByRole("heading", { name: en.question })).toBeInTheDocument();
    expect(screen.getByText(en.questionSub)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: en.aiRoleTitle })).toBeInTheDocument();
    for (const [title] of en.storyItems) expect(screen.getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.closingCta })).toBeInTheDocument();
  });
});

describe("composer · discovery", () => {
  it("needs typed words: a kind chip alone does not enable sending, and the hint says why", () => {
    render(<App />);
    const send = sendButton();
    expect(send).toHaveTextContent(ar.sendLabel);
    fireEvent.click(screen.getByRole("button", { name: QUESTION_CHIP[0] }));
    expect(screen.getByRole("button", { name: QUESTION_CHIP[0] })).toHaveAttribute("aria-pressed", "true");
    expect(send).toBeDisabled();
    expect(screen.getByText(ar.sendHint)).toBeInTheDocument();
    expect(send).toHaveAttribute("aria-describedby", "tm-hint");
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", ctrlKey: true });
    expect(fetchMock).not.toHaveBeenCalled();

    write("سؤال");
    expect(send).toBeEnabled();
    expect(screen.queryByText(ar.sendHint)).toBeNull();
  });

  it("an example fills the composer, takes focus, and the examples fold away", () => {
    render(<App />);
    const examples = screen.getByRole("list", { name: ar.examplesLabel });
    expect(within(examples).getAllByRole("button")).toHaveLength(ar.examples.length);
    fireEvent.click(within(examples).getByRole("button", { name: ar.examples[1] }));
    const ta = screen.getByRole("textbox");
    expect(ta).toHaveValue(ar.examples[1]);
    return new Promise<void>((done) =>
      setTimeout(() => {
        expect(ta).toHaveFocus();
        expect(screen.queryByRole("list", { name: ar.examplesLabel })).toBeNull();
        expect(sendButton()).toBeEnabled();
        done();
      }, 10),
    );
  });

  it("the textarea is described by the sub-question and the AI/privacy note", () => {
    render(<App />);
    expect(screen.getByRole("textbox", { name: ar.question })).toHaveAttribute("aria-describedby", "tm-sub tm-note");
    expect(document.getElementById("tm-sub")).toHaveTextContent(ar.questionSub);
  });
});

describe("journey · learning more", () => {
  const journeyWith = (over: Partial<GuidancePayload>, analyzeOver: Partial<AnalyzeResult> = {}) => {
    fetchMock
      .mockReturnValueOnce(reply({ ok: true, mode: "live", route: "topic_discovery", analyze: analyze(analyzeOver) }))
      .mockReturnValueOnce(reply({ ok: true, mode: "live", payload: payload(over) }));
    render(<App />);
    write("علّمني كيف أصبر");
    fireEvent.click(sendButton());
  };

  it("sends the analyze stage's learning focus back with the journey — known aspects only", async () => {
    journeyWith({}, { learning_focus: ["how", "nonsense" as never, "how", "fruits"] });
    fireEvent.click(await screen.findByRole("button", { name: /الصبر/ }));
    expect(bodyOf(1)).toEqual({
      stage: "journey",
      message: "علّمني كيف أصبر",
      language: "ar",
      topicId: "patience",
      analyzeLevel: "B",
      focus: ["how", "fruits"],
    });
  });

  it("leaves focus out when nothing extra was asked", async () => {
    journeyWith({}, { learning_focus: [] });
    fireEvent.click(await screen.findByRole("button", { name: /الصبر/ }));
    expect(bodyOf(1)).not.toHaveProperty("focus");
  });

  it("shows «لتتعلّم أكثر» after the core, before the connection, with verbatim sections, their sources, and folding", async () => {
    const long = "جملة طويلة منقولة من قسم في مصدر معتمد للاختبار. ".repeat(12).trim();
    journeyWith({
      suggested_action: { type: "quran", title: "خطوة الاختبار", description: "وصف خطوة الاختبار" },
      lessons: [lesson(), lesson({ id: "lesson-2", title_ar: "قسم طويل من الخادم", body_ar: long })],
      learning_request: { focus: ["how"], covered: true },
    });
    fireEvent.click(await screen.findByRole("button", { name: /الصبر/ }));
    const group = await screen.findByRole("group", { name: ar.lessonsTitle });
    const order = [...document.querySelectorAll<HTMLElement>("#experience [data-stage]")].map((s) => s.dataset.stage);
    expect(order).toEqual(["you", "verse", "more", "connect", "dua"]);
    expect(group.closest('[data-stage="more"]')).not.toBeNull();
    expect(document.querySelector('[data-stage="connect"] .cpoint__step')).toHaveTextContent("خطوة الاختبار");

    expect(within(group).getByRole("heading", { level: 4, name: "عنوان القسم من الخادم" })).toBeInTheDocument();
    expect(within(group).getAllByText(ar.lessonBadge)).toHaveLength(2);
    expect(within(group).getByText("نص القسم كما ورد في المصدر")).toHaveAttribute("lang", "ar");
    const src = within(group).getAllByRole("link")[0];
    expect(src).toHaveAttribute("href", "https://example.org/lesson");
    expect(src).toHaveAttribute("rel", "noopener noreferrer");

    const longBody = within(group).getByText(long);
    expect(longBody).toHaveClass("is-folded");
    const fold = within(group).getByRole("button", { name: ar.readMore });
    expect(fold).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(fold);
    expect(longBody).not.toHaveClass("is-folded");
    expect(within(group).getByRole("button", { name: ar.readLess })).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText(ar.gapNote)).toBeNull();
  });

  it("says calmly when the approved content does not cover what was asked", async () => {
    journeyWith({ learning_request: { focus: ["virtues"], covered: false } });
    fireEvent.click(await screen.findByRole("button", { name: /الصبر/ }));
    const note = await screen.findByRole("note");
    expect(note).toHaveTextContent(ar.gapNote);
    expect(screen.queryByRole("group", { name: ar.lessonsTitle })).toBeNull();
    expect(screen.queryByText(ar.errorTitle)).toBeNull();
    expect(screen.getByText(new RegExp(VERSE_1))).toBeInTheDocument();
  });

  it("English: the lesson heading is the English label; the Arabic body is noted; non-http links stay text", async () => {
    fetchMock
      .mockReturnValueOnce(reply({ ok: true, mode: "live", route: "topic_discovery", analyze: analyze() }))
      .mockReturnValueOnce(
        reply({
          ok: true,
          mode: "live",
          payload: payload({ lessons: [lesson({ source: { name: "مصدر القسم", reference: "ص 3", url: "javascript:alert(1)" } })] }),
        }),
      );
    render(<App />);
    toEnglish();
    write("Teach me patience");
    fireEvent.click(sendButton());
    fireEvent.click(await screen.findByRole("button", { name: /الصبر/ }));
    const group = await screen.findByRole("group", { name: en.lessonsTitle });
    expect(within(group).getByRole("heading", { level: 4, name: "Section heading (test)" })).toBeInTheDocument();
    expect(within(group).getByText(en.arabicOnly)).toBeInTheDocument();
    expect(within(group).queryByRole("link")).toBeNull();
  });
});

describe("signature moments: real text, split only on spaces", () => {
  const text = (sel: string) => document.querySelector(sel)!.textContent;

  it("keeps every split heading byte-identical to the copy and readable by name", () => {
    render(<App />);
    expect(text("h1")).toBe(`${ar.heroLine1} ${ar.heroLine2}`);
    expect(text(".human__lead")).toBe(ar.s2Lead);
    expect(text(".trust__title")).toBe(ar.trustTitle);
    expect(text(".exp__q")).toBe(ar.question);
    expect(text(".closing__title")).toBe(ar.closing);
    expect(text(".human__phrases")).toBe(ar.phrases.join(" "));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(`${ar.heroLine1} ${ar.heroLine2}`);
    expect(screen.getByRole("heading", { name: ar.trustTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: ar.closing })).toBeInTheDocument();
  });

  it("never splits inside a word: one span per space-separated word", () => {
    render(<App />);
    const words = (sel: string) => [...document.querySelectorAll(`${sel} .w__i`)].map((w) => w.textContent);
    expect(words(".human__lead")).toEqual(ar.s2Lead.split(" "));
    expect(words(".trust__title")).toEqual(ar.trustTitle.split(" "));
    expect(words(".closing__title")).toEqual(ar.closing.split(" "));
    expect(words(".human__phrases")).toEqual(ar.phrases.join(" ").split(" "));
    // A source node under every word of «كل كلمة لها مصدر.»
    expect(document.querySelectorAll(".trust__title .w__node")).toHaveLength(ar.trustTitle.split(" ").length);
  });

  it("hero Teletype: one word span per word across both lines, indexed in reading order", () => {
    render(<App />);
    const tw = [...document.querySelectorAll<HTMLElement>("h1 .tw")];
    expect(tw.map((w) => w.textContent)).toEqual(`${ar.heroLine1} ${ar.heroLine2}`.split(" "));
    expect(tw.map((w) => w.style.getPropertyValue("--i"))).toEqual(tw.map((_, i) => String(i)));
    expect(tw.at(-1)).toHaveClass("tw--last");
    expect(document.querySelector("h1")).toHaveClass("fx-typewriter");
  });

  it("underlines «اسم الموضوع» and keeps decoration out of the accessibility tree", () => {
    render(<App />);
    const mark = document.querySelector(".human__lead .mk--underline")!;
    expect(mark.textContent).toBe("اسم الموضوع.");
    for (const el of document.querySelectorAll(".mk__line, .mk__bg, .sweep, .ink, .threads, .seal, .w__node, .w__glow, .closing__dawn, .closing__thread, .closing__halo"))
      expect(el.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("English splits on spaces too", () => {
    render(<App />);
    toEnglish();
    expect(text("h1")).toBe(`${en.heroLine1} ${en.heroLine2}`);
    expect(text(".human__lead")).toBe(en.s2Lead);
    expect(document.querySelector(".human__lead .mk--underline")!.textContent).toBe("topic’s name.");
    expect(text(".human__who")).toBe(en.s2Who);
    expect(text(".closing__nodes")).toBe(en.closingLead);
  });
});
