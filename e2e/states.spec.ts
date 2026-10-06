/**
 * Every experience state, rendered from stubbed /api/understand responses (fixtures typed
 * against the wire contract). Runs on desktop and with reduced motion.
 */
import type { Page } from "@playwright/test";
import { R, SOURCE_URL, T, analyze, glossary, lesson, payload, qa } from "./fixtures/understand";
import {
  ask,
  expect,
  experience,
  focusTarget,
  gate,
  openApp,
  sendButton,
  stubUnderstand,
  test,
  textarea,
} from "./support/app";
import { HELPLINE_URL, chips, en, t } from "./support/copy";

const MSG = "رسالة تجريبية: تعبت من كل شيء";
/** A du‘a typed into the ending box — it must never leave the page. */
const DUA_MARK = "دعاء تجريبي خاص";
const DUA = `يا رب، ${DUA_MARK} لا يغادر هذا الجهاز`;

/** One stage of the journey (you, verse, tafsir, hadith, seerah, more, connect, dua). */
const stage = (page: Page, k: string) => experience(page).locator(`[data-stage="${k}"]`);

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test.describe("topic discovery → journey", () => {
  test("thinking → topics → pick → the staged journey, stage by stage → «أختم رحلتي»", async ({ page }) => {
    test.slow();
    const hold = gate();
    const calls = await stubUnderstand(
      page,
      async () => {
        await hold.promise;
        return R.topics();
      },
      R.journey(),
      R.journey({ related_topics: [] }),
    );
    const exp = experience(page);

    await ask(page, MSG);

    // 02 · thinking: a polite live status takes focus, the person's words are echoed back.
    const thinking = exp.getByRole("status");
    await expect(thinking).toBeVisible();
    await expect(thinking).toHaveAttribute("aria-live", "polite");
    await expect(thinking).toContainText(t.thinkingAnalyze[0]);
    await expect(focusTarget(page, "thinking")).toBeFocused();
    await expect(exp.locator(".words__quote")).toHaveText(MSG);
    await expect(textarea(page)).toHaveCount(0);
    hold.open();

    // Topics: the AI reading is labelled as AI, the titles come from the response.
    await expect(exp.locator(".topics")).toBeVisible();
    await expect(focusTarget(page, "topics")).toBeFocused();
    await expect(exp.locator(".understood")).toContainText(t.understood);
    await expect(exp.locator(".understood .ai-tag")).toHaveText(t.aiReading);
    await expect(exp.locator(".understood")).toContainText(T.reading);
    await expect(exp.getByRole("heading", { name: t.topicsTitle })).toBeVisible();
    const topics = exp.locator(".topics__list .topic");
    await expect(topics).toHaveCount(2);
    await expect(topics.first()).toContainText(T.topicPatience);
    await expect(topics.first()).toContainText(T.topicPatienceReason);

    expect(calls[0]).toEqual({ stage: "analyze", message: MSG, language: "ar" });

    // Pick → journey request carries topicId + analyzeLevel from the analyze reading.
    await exp.getByRole("button", { name: T.topicPatience }).click();
    const verse = stage(page, "verse");
    await expect(verse).toBeVisible();
    expect(calls[1]).toEqual({ stage: "journey", message: MSG, language: "ar", topicId: "patience", analyzeLevel: "B" });
    await expect(focusTarget(page, "result")).toBeFocused();

    // The order of the journey, every stage in the DOM from the start.
    const order = await exp.locator("[data-stage]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.stage));
    expect(order).toEqual(["you", "verse", "tafsir", "hadith", "seerah", "connect", "dua"]);
    await expect(exp.locator(".lessons, .gap-note"), "nothing extra was asked for").toHaveCount(0);

    // 2 · The verse: its curated bridge, the text in short runs with its clause lit, Arabic-Indic āyah numbers.
    await expect(verse.getByRole("heading", { level: 3, name: T.bridgeQuran })).toBeVisible();
    await expect(verse.locator(".verse")).toContainText(T.verse1);
    await expect(verse.locator(".verse")).toContainText(T.verse2);
    await expect(verse.locator(".verse .lit")).toHaveText(T.verseHighlight);
    await expect(verse.locator(".verse .ayah")).toHaveText(["٥", "٦"]);
    await expect(verse.locator(".verse-en"), "no translation in Arabic UI").toHaveCount(0);
    // The source: a small chip on a thread — place + reference + source, a safe external link.
    const chip = verse.locator("a.src-chip");
    await expect(chip).toContainText(t.verifiedSource);
    await expect(chip).toContainText("تجريبية 2:5-6");
    await expect(chip).toContainText(T.sourceName);
    await expect(chip).toHaveAttribute("href", SOURCE_URL);
    await expect(chip).toHaveAttribute("target", "_blank");
    await expect(chip).toHaveAttribute("rel", "noopener noreferrer");

    // «تابع» never moves on by itself; pressed, it takes focus to the next stage's heading.
    await verse.getByRole("button", { name: t.continueLabel }).click();
    const tafsir = stage(page, "tafsir");
    await expect(tafsir.getByRole("heading", { level: 3, name: T.bridgeTafsir })).toBeFocused();
    await expect(tafsir).toHaveClass(/is-on/);

    // 3 · The tafsir: its lead first, the full excerpt behind an accessible disclosure.
    const tafsirText = tafsir.locator(".aside__text");
    await expect(tafsirText).toHaveText(T.explanationLead);
    const full = tafsir.getByRole("button", { name: t.showFullTafsir });
    await expect(full).toHaveAttribute("aria-expanded", "false");
    await full.click();
    await expect(tafsirText).toHaveText(T.explanation);
    await expect(tafsir.getByRole("button", { name: t.showLess })).toHaveAttribute("aria-expanded", "true");
    await expect(tafsir.locator("a.src-chip")).toContainText(T.sourceName);

    // 4 · The hadith: its focal line between «…» cues (decoration only), grade + chip, the full text on request.
    const hadith = stage(page, "hadith");
    await expect(hadith.getByRole("heading", { level: 3, name: T.bridgeHadith })).toBeVisible();
    await expect(hadith.locator(".hq__line")).toHaveText(T.hadithHighlight);
    await expect(hadith.locator(".hq__cue")).toHaveCount(2);
    for (const cue of await hadith.locator(".hq__cue").all()) await expect(cue).toHaveAttribute("aria-hidden", "true");
    await expect(hadith.locator(".grade-tag")).toContainText(T.hadithGrade);
    await expect(hadith.locator("a.src-chip").first()).toContainText("مجموعة تجريبية · 1");
    await expect(hadith.getByRole("link", { name: /مجموعة تجريبية\s+1/ })).toHaveAttribute("href", SOURCE_URL);
    await hadith.getByRole("button", { name: t.showFullHadith }).click();
    await expect(hadith.locator("blockquote")).toHaveText(T.hadith);
    await expect(hadith.locator("blockquote .lit")).toHaveText(T.hadithHighlight);
    await expect(hadith.locator(".hx")).toContainText(T.hadithExplanation);
    await expect(hadith.locator(".hx a.src-chip")).toContainText(`${T.sourceName} · مرجع تجريبي`);

    // 5 · The Seerah scene: the event as its title, the beats in order with the key line lit; line-art only;
    // never a grade (even though this narration's provenance carries one).
    const seerah = stage(page, "seerah");
    await expect(seerah.getByRole("heading", { level: 3, name: T.bridgeSeerah })).toBeVisible();
    await expect(seerah.getByRole("heading", { level: 4, name: T.storyTitle })).toBeVisible();
    await expect(seerah.locator(".beat")).toHaveText([T.storyPara1, T.storyPara2]);
    await expect(seerah.locator(".kq")).toHaveText([T.storyKeyQuote]);
    await expect(seerah.locator(".sky")).toHaveAttribute("aria-hidden", "true");
    await expect(seerah).not.toContainText(T.hadithGrade);
    await expect(seerah.locator(".grade-tag")).toHaveCount(0);
    await expect(seerah.locator("a.src-chip")).toContainText(T.storyRef);
    await expect(seerah.locator("a.src-chip")).toHaveAttribute("href", SOURCE_URL);

    // 7 · Connection: the three points on one line; the practical step under the third. No old step card.
    const connect = stage(page, "connect");
    await expect(connect.getByRole("heading", { level: 3, name: T.connectTitle })).toBeVisible();
    await expect(connect.locator(".cpoint__t")).toHaveText([...T.connectPoints]);
    const step = connect.locator(".cpoint").nth(2).locator(".cpoint__step");
    await expect(step).toContainText(T.stepTitle);
    await expect(step).toContainText(T.stepDescription);
    await expect(exp.locator(".step-card, .next, .done")).toHaveCount(0);

    // 8 · The du‘a: a large box — never sent, never stored — then the quiet related-topic link.
    const dua = stage(page, "dua");
    await expect(dua.getByRole("heading", { level: 3, name: t.duaTitle })).toBeVisible();
    await expect(dua).toContainText(t.duaSub);
    await expect(dua).toContainText(t.duaPrivacy);
    const box = dua.getByRole("textbox", { name: t.duaTitle });
    await expect(box).toHaveAttribute("placeholder", t.duaPlaceholder);
    await box.fill(DUA);
    await expect(dua.locator(".dua__rel")).toContainText(T.relatedTitle);
    await dua.locator(".dua__rel").click();
    await expect.poll(() => calls.length).toBe(3);
    expect(calls[2]).toEqual({ stage: "journey", message: MSG, language: "ar", topicId: "hope", analyzeLevel: "B" });

    // The next journey starts with an empty box; «أختم رحلتي» ends it and returns to the composer —
    // fresh and focused — without another request.
    await expect(stage(page, "dua").getByRole("textbox", { name: t.duaTitle })).toHaveValue("");
    await expect(stage(page, "dua").locator(".dua__rel")).toHaveCount(0);
    await stage(page, "dua").getByRole("button", { name: t.endJourney }).click();
    await expect(textarea(page)).toBeFocused();
    await expect(textarea(page)).toHaveValue("");
    await expect(exp.locator(".jr")).toHaveCount(0);
    expect(calls).toHaveLength(3);
  });

  test("stages light as they come into view (all at once with reduced motion); nothing moves on by itself", async ({ page }) => {
    await stubUnderstand(page, R.topics(), R.journey());
    await ask(page, MSG);
    await experience(page).getByRole("button", { name: T.topicPatience }).click();
    await expect(focusTarget(page, "result")).toBeFocused();
    const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    const dua = stage(page, "dua");
    const hadith = stage(page, "hadith");
    if (reduced) {
      await expect(experience(page).locator(".jr--staged")).toHaveCount(0);
      await expect(experience(page).locator("[data-stage]:not(.is-on)")).toHaveCount(0);
      return;
    }
    await expect(experience(page).locator(".jr--staged")).toHaveCount(1);
    // «تابع» brings the verse in: it lights and its heading takes focus.
    await stage(page, "you").getByRole("button", { name: t.continueLabel }).click();
    await expect(stage(page, "verse")).toHaveClass(/is-on/);
    await expect(stage(page, "verse").getByRole("heading", { level: 3 })).toBeFocused();
    // Far below the fold, a stage waits — and the page does not scroll itself there.
    await page.waitForTimeout(1_500);
    await expect(dua).not.toHaveClass(/is-on/);
    expect(await dua.evaluate((el) => el.getBoundingClientRect().top > window.innerHeight)).toBe(true);
    // Keyboard focus arriving in a waiting stage lights it.
    await hadith.getByRole("button", { name: t.continueLabel }).focus();
    await expect(hadith).toHaveClass(/is-on/);
    // Scrolling into a stage lights it.
    await dua.scrollIntoViewIfNeeded();
    await expect(dua).toHaveClass(/is-on/);
    await expect(dua.locator(".dua__box")).toHaveCSS("opacity", "1");
  });

  test("the du‘a is never in any request body, never in storage, and gone when the journey ends", async ({ page }) => {
    const bodies: string[] = [];
    page.on("request", (r) => {
      const body = r.postData();
      if (body) bodies.push(body);
    });
    const calls = await stubUnderstand(page, R.topics(), R.journey(), R.journey({ related_topics: [] }));
    await ask(page, MSG);
    await experience(page).getByRole("button", { name: T.topicPatience }).click();
    const box = stage(page, "dua").getByRole("textbox", { name: t.duaTitle });
    await box.fill(DUA);
    await box.press("Tab");
    await stage(page, "dua").locator(".dua__rel").click();
    await expect.poll(() => calls.length).toBe(3);
    await expect(stage(page, "dua").getByRole("textbox", { name: t.duaTitle })).toHaveValue("");

    expect(bodies.length).toBeGreaterThanOrEqual(3);
    for (const b of bodies) expect(b).not.toContain(DUA_MARK);
    const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    expect(stored).not.toContain(DUA_MARK);
    await expect(page.locator("body")).not.toContainText(DUA_MARK);
  });

  test("a topic_discovery with no usable topics is an honest «insufficient»", async ({ page }) => {
    await stubUnderstand(page, R.topics({ suggested_topics: [{ id: "x", title: "  " }] }));
    await ask(page, MSG);
    await expect(focusTarget(page, "insufficient")).toBeFocused();
    await expect(experience(page).locator(".pointer")).toHaveCount(0);
  });

  test("English: default bridges, the verse translation and the «Arabic only» note", async ({ page }) => {
    const calls = await stubUnderstand(page, R.topics(), R.journey({ bridges: undefined }));
    await page.getByRole("button", { name: t.langLabel }).click();
    await ask(page, "I am tired of waiting");
    await experience(page).locator(".topic").first().click();
    const exp = experience(page);
    await expect(exp.locator(".verse-en")).toHaveText(`“${T.verseTranslation}”`);
    await expect(exp.locator(".verse")).toHaveAttribute("dir", "rtl");
    await expect(stage(page, "tafsir")).toContainText(en.arabicOnly);
    await expect(stage(page, "verse").getByRole("heading", { name: en.bridgeQuran })).toBeVisible();
    await expect(stage(page, "connect").getByRole("heading", { name: en.connectTitle })).toBeVisible();
    await expect(stage(page, "dua").getByRole("button", { name: en.endJourney })).toBeVisible();
    expect(calls[1]).toMatchObject({ stage: "journey", language: "en", topicId: "patience" });
  });
});

test.describe("learning more («علمني»)", () => {
  test("the analyze stage's learning focus goes back with the journey — known aspects only, once each", async ({ page }) => {
    const calls = await stubUnderstand(page, R.topics({ learning_focus: ["how", "not-an-aspect" as never, "how", "virtues"] }), R.journey());
    await ask(page, MSG);
    await experience(page).getByRole("button", { name: T.topicPatience }).click();
    await expect(stage(page, "verse")).toBeVisible();
    expect(calls[1]).toEqual({
      stage: "journey",
      message: MSG,
      language: "ar",
      topicId: "patience",
      analyzeLevel: "B",
      focus: ["how", "virtues"],
    });
  });

  test("«لتتعلّم أكثر» is a quieter chapter after the core, before the connection: verbatim sections with their source; long ones fold", async ({ page }) => {
    await stubUnderstand(
      page,
      R.topics({ learning_focus: ["how"] }),
      R.journey({
        lessons: [lesson(), lesson({ id: "e2e-lesson-2", title_ar: "عنوان قسم تجريبي ثانٍ", body_ar: T.lessonLong })],
        learning_request: { focus: ["how"], covered: true },
      }),
    );
    await ask(page, MSG);
    await experience(page).getByRole("button", { name: T.topicPatience }).click();
    const exp = experience(page);
    const section = exp.getByRole("group", { name: t.lessonsTitle });
    await expect(section).toBeVisible();
    // After the Seerah, before the connection and the du‘a.
    const order = await exp.locator("[data-stage]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.stage));
    expect(order).toEqual(["you", "verse", "tafsir", "hadith", "seerah", "more", "connect", "dua"]);
    await expect(stage(page, "more").getByRole("group", { name: t.lessonsTitle })).toBeVisible();

    const cards = section.locator(".card--lesson");
    await expect(cards).toHaveCount(2);
    const first = cards.first();
    await expect(first.getByRole("heading", { level: 4, name: T.lessonTitle })).toBeVisible();
    await expect(first.locator(".badge")).toHaveText(t.lessonBadge);
    await expect(first.locator(".lesson__body")).toHaveText(T.lessonBody);
    await expect(first.locator(".lesson__body")).toHaveAttribute("lang", "ar");
    await expect(first.getByRole("button", { name: t.readMore }), "short sections do not fold").toHaveCount(0);
    const link = first.locator(".ref__src a");
    await expect(link).toHaveAttribute("href", `${SOURCE_URL}#lesson`);
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");

    const second = cards.nth(1);
    await expect(second.locator(".lesson__body")).toHaveClass(/is-folded/);
    const fold = second.getByRole("button", { name: t.readMore });
    await expect(fold).toHaveAttribute("aria-expanded", "false");
    await fold.click();
    await expect(second.locator(".lesson__body")).not.toHaveClass(/is-folded/);
    await expect(second.getByRole("button", { name: t.readLess })).toHaveAttribute("aria-expanded", "true");
    // Covered: no gap note.
    await expect(exp.locator(".gap-note")).toHaveCount(0);
  });

  test("when the approved content does not cover the request, a calm note says so (not an error)", async ({ page }) => {
    await stubUnderstand(page, R.topics({ learning_focus: ["virtues"] }), R.journey({ learning_request: { focus: ["virtues"], covered: false } }));
    await ask(page, MSG);
    await experience(page).getByRole("button", { name: T.topicPatience }).click();
    const exp = experience(page);
    const note = exp.locator(".gap-note");
    await expect(note).toHaveText(t.gapNote);
    await expect(note).toHaveAttribute("role", "note");
    await expect(exp.locator(".lessons")).toHaveCount(0);
    // The journey itself is still there, and nothing looks like a failure.
    await expect(stage(page, "more").locator(".gap-note")).toBeVisible();
    await expect(stage(page, "verse")).toBeVisible();
    await expect(exp.getByRole("heading", { name: t.errorTitle })).toHaveCount(0);
  });

  test("English: lesson headings use the English label, the body stays Arabic with the note; non-http links are text", async ({ page }) => {
    await stubUnderstand(
      page,
      R.topics(),
      R.journey({ lessons: [lesson({ source: { name: "مصدر تجريبي", reference: "ص 1", url: "javascript:alert(1)" } })] }),
    );
    await page.getByRole("button", { name: t.langLabel }).click();
    await ask(page, "Teach me about patience");
    await experience(page).locator(".topic").first().click();
    const section = experience(page).getByRole("group", { name: en.lessonsTitle });
    const card = section.locator(".card--lesson");
    await expect(card.getByRole("heading", { level: 4, name: T.lessonTitleEn })).toBeVisible();
    await expect(card.locator(".lesson__body")).toHaveText(T.lessonBody);
    await expect(card).toContainText(en.arabicOnly);
    await expect(card.locator(".badge")).toHaveText(en.lessonBadge);
    await expect(card.getByRole("link")).toHaveCount(0);
  });
});

test.describe("other routes", () => {
  test("direct_learning goes straight to the learning result", async ({ page }) => {
    const calls = await stubUnderstand(page, R.direct());
    await ask(page, "سؤال تجريبي مباشر");
    const exp = experience(page);
    await expect(stage(page, "verse")).toBeVisible();
    await expect(focusTarget(page, "result")).toBeFocused();
    await expect(exp.locator(".topics")).toHaveCount(0);
    await expect(stage(page, "connect").locator(".cpoint__step")).toContainText(T.stepTitle);
    // Optional stages are absent when the payload does not carry them; bridges fall back to the copy.
    await expect(exp.locator('[data-stage="tafsir"], [data-stage="hadith"], [data-stage="seerah"], [data-stage="more"]')).toHaveCount(0);
    await expect(stage(page, "verse").getByRole("heading", { name: t.bridgeQuran })).toBeVisible();
    await expect(stage(page, "verse").locator(".lit")).toHaveText(T.verseHighlight);
    // «أختم رحلتي» returns to the composer, focused; no request.
    await stage(page, "dua").getByRole("button", { name: t.endJourney }).click();
    await expect(textarea(page)).toBeFocused();
    expect(calls).toHaveLength(1);
  });

  test("a result without an AI reading focuses the first stage's heading", async ({ page }) => {
    await stubUnderstand(page, {
      body: {
        ok: true,
        mode: "mock",
        route: "direct_learning",
        analyze: analyze({ context_summary: "", recommended_path: "direct_learning" }),
        payload: payload(),
      },
    });
    await ask(page, "سؤال تجريبي مباشر");
    const exp = experience(page);
    await expect(exp.locator(".understood")).toHaveCount(0);
    await expect(stage(page, "verse").getByRole("heading", { name: t.bridgeQuran })).toBeFocused();
  });

  test("knowledge · glossary: term, English equivalent, source text badge, reference and source link", async ({ page }) => {
    await stubUnderstand(page, R.knowledge(glossary()));
    await ask(page, "ما معنى مصطلح تجريبي؟");
    const card = experience(page).locator(".card--know");
    await expect(card).toBeVisible();
    await expect(focusTarget(page, "knowledge")).toBeFocused();
    await expect(card.locator(".card__top")).toContainText(t.knowGlossary);
    await expect(card.locator(".badge")).toContainText(t.sourceText);
    await expect(card.getByRole("heading", { name: T.glossaryTitle })).toBeVisible();
    await expect(card.locator(".term__en")).toHaveText(T.glossaryTermEn);
    await expect(card.locator(".source-quote")).toHaveText(T.glossaryBody);
    await expect(card.locator(".note"), "glossary is not an excerpt").toHaveCount(0);
    await expect(card.locator(".ref__what")).toContainText("قاموس تجريبي — ص 8");
    await expect(card.locator(".ref__src")).toContainText(`${t.source}: ${T.sourceName}`);
    const open = card.getByRole("link", { name: t.openSource });
    await expect(open).toHaveAttribute("href", SOURCE_URL);
    await expect(open).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("knowledge · Q&A: excerpt note, page reference and link to the page", async ({ page }) => {
    await stubUnderstand(page, R.knowledge(qa()));
    await ask(page, "لماذا سؤال تجريبي؟");
    const card = experience(page).locator(".card--know");
    await expect(card.locator(".card__top")).toContainText(t.knowQa);
    await expect(card.getByRole("heading", { name: T.qaTitle })).toBeVisible();
    await expect(card.locator(".source-quote")).toHaveText(T.qaBody);
    await expect(card.locator(".note")).toHaveText(t.excerptNote);
    await expect(card.locator(".ref__what")).toContainText("المسألة 9 — ص 42");
    await expect(card.locator(".ref__src")).toContainText("بينات (تجريبي)");
    await expect(card.getByRole("link", { name: t.openSource })).toHaveAttribute("href", `${SOURCE_URL}#page=42`);
  });

  test("knowledge · a non-http source URL is never rendered as a link", async ({ page }) => {
    await stubUnderstand(page, R.knowledge(qa({ source: { name: "مصدر تجريبي", reference: "ص 1", url: "javascript:alert(1)" } })));
    await ask(page, "لماذا سؤال تجريبي؟");
    const card = experience(page).locator(".card--know");
    await expect(card).toBeVisible();
    await expect(card.getByRole("link")).toHaveCount(0);
    await expect(card.locator(".ref__src")).toContainText("مصدر تجريبي");
  });

  test("referral · self_harm shows «أنت مهم» with a helpline, and drops any source pointer", async ({ page }) => {
    await stubUnderstand(page, R.selfHarm());
    await ask(page, "نص اختبار للإحالة");
    const care = experience(page).locator(".card--care");
    await expect(care).toBeVisible();
    // Literal on purpose: this safety screen's title must not change silently.
    await expect(care.getByRole("heading", { name: "أنت مهم" })).toBeFocused();
    for (const p of t.careBody) await expect(care).toContainText(p);
    await expect(care).toContainText(t.careAction);
    await expect(care).toContainText(t.careEmergency);
    const help = care.getByRole("link", { name: t.careHelpline });
    await expect(help).toHaveAttribute("href", HELPLINE_URL);
    await expect(help).toHaveAttribute("rel", "noopener noreferrer");
    // Human help only: no religious content, no pointer, no model text.
    await expect(experience(page).locator(".pointer, .jr, .card--know, .understood")).toHaveCount(0);
    await expect(experience(page)).not.toContainText(T.referralMessage);
  });

  test("referral · level_d shows the scholar referral, the server message, and the source pointer", async ({ page }) => {
    await stubUnderstand(page, R.levelD());
    await ask(page, "هل سؤال شخصي تجريبي؟");
    const exp = experience(page);
    await expect(exp.getByRole("heading", { name: t.referTitle })).toBeFocused();
    await expect(exp).toContainText(T.referralMessage);
    await expect(exp.locator(".refer-note")).toContainText(t.referNote);
    const ptr = exp.locator(".pointer");
    await expect(ptr).toContainText(t.pointerLeadRefer);
    await expect(ptr).toContainText(T.pointerLabel);
    await expect(ptr.locator(".pointer__rule")).toHaveText(T.pointerRule);
    await expect(ptr.getByRole("link", { name: T.pointerSource })).toHaveAttribute("href", SOURCE_URL);
  });

  test("insufficient · honest gap with pointer links; «اكتب بطريقة ثانية» returns to the composer", async ({ page }) => {
    await stubUnderstand(page, R.insufficient());
    await ask(page, MSG);
    const exp = experience(page);
    await expect(exp.getByRole("heading", { name: t.insuffTitle })).toBeFocused();
    await expect(exp).toContainText(t.insuffLabel);
    await expect(exp).toContainText(t.insuffBody);
    await expect(exp.locator(".pointer")).toContainText(t.pointerLead);
    await expect(exp.locator(".pointer")).toContainText(T.pointerLabel);
    await expect(exp.locator(".pointer").getByRole("link")).toHaveCount(1);
    await exp.getByRole("button", { name: t.rephrase }).click();
    await expect(textarea(page)).toHaveValue(MSG);
    await expect(textarea(page)).toBeFocused();
  });

  test("unclear · asks for more; «أكمل الكتابة» returns to the composer with the words kept", async ({ page }) => {
    await stubUnderstand(page, R.unclear());
    await ask(page, "همم");
    const exp = experience(page);
    await expect(exp.getByRole("heading", { name: t.unclearTitle })).toBeFocused();
    await expect(exp).toContainText(t.unclearBody);
    await exp.getByRole("button", { name: t.writeMore }).click();
    await expect(textarea(page)).toHaveValue("همم");
    await expect(textarea(page)).toBeFocused();
  });
});

test.describe("errors, retry and «عدّل»", () => {
  test("error → «حاول مرة ثانية» resends the same request and recovers", async ({ page }) => {
    const calls = await stubUnderstand(page, R.upstream(), R.topics());
    await ask(page, MSG);
    const exp = experience(page);
    await expect(exp.getByRole("heading", { name: t.errorTitle })).toBeFocused();
    await expect(exp).toContainText(t.errorBody);
    await exp.getByRole("button", { name: t.retry }).click();
    await expect(exp.locator(".topics")).toBeVisible();
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
  });

  test("a failed journey retries the journey, not the analyze", async ({ page }) => {
    const calls = await stubUnderstand(page, R.topics(), R.upstream(), R.journey());
    await ask(page, MSG);
    await experience(page).locator(".topic").first().click();
    await experience(page).getByRole("button", { name: t.retry }).click();
    await expect(stage(page, "verse")).toBeVisible();
    expect(calls.map((c) => c.stage)).toEqual(["analyze", "journey", "journey"]);
    expect(calls[2]).toEqual(calls[1]);
  });

  test("429 shows the rate-limit message", async ({ page }) => {
    await stubUnderstand(page, R.rate());
    await ask(page, MSG);
    await expect(experience(page)).toContainText(t.errorRate);
    await expect(experience(page).getByRole("button", { name: t.retry })).toBeVisible();
  });

  test("network failure, non-JSON 502 and malformed payloads all become an honest error", async ({ page }) => {
    await stubUnderstand(
      page,
      "abort",
      { raw: "<html>Bad gateway</html>", status: 502 },
      { status: 200, body: { ok: true, mode: "mock", route: "knowledge", analyze: null, answer: { kind: "qa" } } },
      { status: 200, body: { ok: true, mode: "mock", referral: { reason: "something_else" } } },
      R.topics(),
    );
    await ask(page, MSG);
    const exp = experience(page);
    const retry = exp.getByRole("button", { name: t.retry });
    for (let i = 0; i < 4; i++) {
      await expect(exp.getByRole("heading", { name: t.errorTitle }), `attempt ${i + 1}`).toBeVisible();
      await expect(exp.locator(".jr, .card--know, .card--care")).toHaveCount(0);
      await retry.click();
    }
    await expect(exp.locator(".topics")).toBeVisible();
  });

  test("«عدّل» returns to the composer with the text and chips kept", async ({ page }) => {
    await stubUnderstand(page, R.topics(), R.journey());
    const ta = textarea(page);
    await ta.scrollIntoViewIfNeeded();
    const broken = chips[3][0];
    await experience(page).getByRole("button", { name: broken }).click();
    await ask(page, MSG);
    await experience(page).locator(".topic").first().click();
    await expect(stage(page, "verse")).toBeVisible();
    await experience(page).getByRole("button", { name: t.edit }).click();
    await expect(ta).toHaveValue(MSG);
    await expect(ta).toBeFocused();
    await expect(experience(page).getByRole("button", { name: broken })).toHaveAttribute("aria-pressed", "true");
    await expect(experience(page).locator(".jr, .words")).toHaveCount(0);
    await expect(sendButton(page)).toBeEnabled();
  });

  test("«عدّل» while thinking aborts the request; a late response does not take over", async ({ page }) => {
    const hold = gate();
    const calls = await stubUnderstand(page, async () => {
      await hold.promise;
      return R.topics();
    });
    await ask(page, MSG);
    await expect(experience(page).getByRole("status")).toBeVisible();
    await experience(page).getByRole("button", { name: t.edit }).click();
    await expect(textarea(page)).toHaveValue(MSG);
    hold.open();
    await page.waitForTimeout(400);
    await expect(textarea(page)).toBeVisible();
    await expect(experience(page).locator(".topics")).toHaveCount(0);
    expect(calls).toHaveLength(1);
  });

  test("a request that never answers times out into the error state (20 s client timeout)", async ({ page }) => {
    await page.clock.install();
    await page.reload();
    await stubUnderstand(page, "hang", R.topics());
    await ask(page, MSG);
    await expect(experience(page).getByRole("status")).toBeVisible();
    // The thinking line moves on while the server works (every 2.4 s, resting on the last one).
    await page.clock.fastForward(2_500);
    await expect(experience(page).getByRole("status")).not.toContainText(t.thinkingAnalyze[0]);
    await page.clock.fastForward(18_000);
    await expect(experience(page).getByRole("heading", { name: t.errorTitle })).toBeVisible();
    await expect(experience(page)).toContainText(t.errorBody);
    await experience(page).getByRole("button", { name: t.retry }).click();
    await expect(experience(page).locator(".topics")).toBeVisible();
  });
});
