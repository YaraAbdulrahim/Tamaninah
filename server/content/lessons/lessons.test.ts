import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import snapshot from "../snapshots/lessons.published.json";
import { LESSON_ASPECTS } from "../../../shared/experience/validate";
import { getRegistrySource, isRegistrySourceApproved } from "../sourceRegistry";
import { extractJamharaPage, lessonTextProblem, splitLessonBody, WORD_PASTE_ARTIFACT } from "./jamharaExtract";
import { detectLearningFocus, mergeLearningFocus } from "./learningFocus";
import {
  JAMHARA_LESSON_ENTRIES,
  JAMHARA_SOURCE_ID,
  MAX_LESSON_CHARS,
  TOPIC_LESSON_SOURCES,
  jamharaEntryUrl,
} from "./lessonAnchors";
import type { LessonSnapshotFile } from "./lessonFormat";
import { loadLessonSnapshot, publishedLessons, selectLessons } from "./lessonRepository";

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const file = snapshot as unknown as LessonSnapshotFile;

describe("al-Jamhara lessons snapshot", () => {
  it("is registered as an approved source", () => {
    expect(isRegistrySourceApproved(JAMHARA_SOURCE_ID)).toBe(true);
    expect(getRegistrySource(JAMHARA_SOURCE_ID)?.domain).toBe("islamic-content.com");
    expect(file.sourceId).toBe(JAMHARA_SOURCE_ID);
  });

  it("loads every committed record (nothing rejected)", () => {
    const load = publishedLessons();
    expect(load.rejected).toEqual([]);
    expect(load.records.length).toBe(file.records.length);
    expect(load.records.length).toBeGreaterThanOrEqual(45);
  });

  it("every lesson is verbatim, clean, sized, cited and double-fetched", () => {
    for (const r of file.records) {
      expect(r.url, r.id).toBe(jamharaEntryUrl(r.entryId));
      expect(r.url).toMatch(/^https:\/\/islamic-content\.com\/t\/\d+$/);
      expect(sha256(r.body_ar), r.id).toBe(r.bodySha256);
      expect(r.body_ar.length, r.id).toBeLessThanOrEqual(MAX_LESSON_CHARS);
      expect(lessonTextProblem(r.body_ar), r.id).toBeNull();
      expect(r.body_ar).not.toContain(WORD_PASTE_ARTIFACT);
      expect(LESSON_ASPECTS).toContain(r.aspect);
      expect(r.requests).toEqual([r.url, r.url]);
      expect(Date.parse(r.fetchedAt)).toBeLessThanOrEqual(Date.parse(r.verifiedAt));
      expect(r.verification_note).toMatch(/twice/);
      // «(n/m)» lives only in the English label — never in the source text.
      if (r.parts > 1) expect(r.title_en).toContain(`(${r.part}/${r.parts})`);
      expect(r.body_ar).not.toMatch(/\(\d+\/\d+\)$/);
    }
  });

  it("maps each printed section to the right aspect", () => {
    const expected: Record<string, string> = {
      التعريف: "meaning",
      الفضل: "virtues",
      "وسائل الاكتساب": "how",
      "الفوائد والمصالح": "fruits",
      الأدلة: "evidence",
      الصور: "types",
      "نماذج وقصص": "examples",
      الآداب: "etiquette",
    };
    for (const r of file.records) {
      if (r.card) expect(r.aspect, r.id).toBe(expected[r.card]);
      const anchor = JAMHARA_LESSON_ENTRIES.find((e) => e.entryId === r.entryId)!.sections.find(
        (s) => s.card === r.card && s.sub === r.sub,
      );
      expect(anchor?.aspect, r.id).toBe(r.aspect);
    }
    // Lesson-plan pages: «ماذا نفعل بعد ذلك» is the how-to.
    expect(file.records.find((r) => r.entryId === 80974 && r.sub === "ماذا نفعل بعد ذلك")?.aspect).toBe("how");
    // Du'a: the printed «آداب الدعاء» (not the dhikr etiquette).
    const dua = file.records.filter((r) => r.entryId === 2366 && r.aspect === "etiquette");
    expect(dua.length).toBeGreaterThan(0);
    expect(dua.every((r) => r.sub === "ثانيًا- آداب الدعاء:")).toBe(true);
    // Item 1 cites al-Tirmidhi (no grade in the data) so it is left out; the stored runs start at item 2.
    expect(dua[0]!.body_ar.startsWith("2- أن يتحرى الأوقات الشريفة")).toBe(true);
    expect(dua.some((r) => r.body_ar.includes("1- أن يخلص في الدعاء"))).toBe(false);
  });

  it("every journey topic has lesson material", () => {
    for (const [topicId, sources] of Object.entries(TOPIC_LESSON_SOURCES)) {
      const count = file.records.filter((r) => sources.some((s) => s.entryId === r.entryId)).length;
      expect(count, topicId).toBeGreaterThan(0);
    }
  });

  it("fails closed: tampered, foreign or garbled rows are dropped", () => {
    const good = file.records[0]!;
    const tampered = structuredClone(file) as LessonSnapshotFile;
    tampered.records = [
      good,
      { ...good, id: "jamhara-646-meaning-1-9", body_ar: `${good.body_ar} زيادة` },
      { ...good, id: good.id.replace(/-1$/, "-2"), part: 2, parts: 2, body_ar: "نص بلا بصمة" },
      { ...good, id: "x", url: "https://example.com/t/646" },
      { ...good, id: "jamhara-999-meaning-1-1", entryId: 999 },
      { ...good, id: "jamhara-646-meaning-1-3", body_ar: `نص ${String.fromCharCode(0xfb65)} مشوه`, bodySha256: sha256(`نص ${String.fromCharCode(0xfb65)} مشوه`) },
      { ...good, id: "jamhara-646-bogus-1-1", aspect: "bogus" as never },
      { ...good, id: "jamhara-646-meaning-1-4", requests: [] },
    ];
    const load = loadLessonSnapshot(tampered);
    expect(load.records.map((r) => r.id)).toEqual([good.id]);
    expect(load.rejected).toHaveLength(7);
    expect(loadLessonSnapshot({ ...tampered, kind: "other" }).records).toEqual([]);
    expect(loadLessonSnapshot({ ...tampered, sourceId: "tmn-src-unknown" }).records).toEqual([]);
  });
});

describe("Jamhara page extraction", () => {
  const card = (title: string, inner: string) =>
    `<div class="border-radius-10 border bg-white mb-30 p-30 wow fadeIn"><h4 class="title-font was-ruqaa-font mt-2 py-1" data-card="1">${title}</h4>${inner}</div>`;
  const page = (cards: string) =>
    `<html><body><main class="bg-grey"><h1 class="entry-title font-small">\n التوكل \n</h1>${cards}</main></body></html>`;

  it("keeps honorific text, tashkeel, verse marks and citations; drops icons, nav headings and the Word artifact", () => {
    const html = page(
      card(
        "التعريف",
        `<h1 class='head-4-title'>التعريف اصطلاحًا</h1>\n   اعتماد القلبِ على الله <i class='icon-words-3azza-wa-jall-1'></i><span class='font-0'>عزّ وجل</span>. انظر &quot;مدارج السالكين&quot; (2 /127) ${WORD_PASTE_ARTIFACT} `,
      ) +
        card(
          "الأدلة",
          `<h1 class='head-4-title'>القرآن الكريم</h1><h5><a href="https://islamic-content.com/t/646/ayat">التوكل في القرآن الكريم</a></h5> قال تعالى: <span data-quranpedia='surah=5&ayah=23'><span class="ayah-font text-primary">﴿وَعَلَى اللَّهِ فَتَوَكَّلُوا﴾</span></span> [المائدة: 23]`,
        ),
    );
    const out = extractJamharaPage(html);
    expect(out.title).toBe("التوكل");
    expect(out.sections).toEqual([
      { card: "التعريف", sub: "التعريف اصطلاحًا", text: 'اعتماد القلبِ على الله عزّ وجل. انظر "مدارج السالكين" (2 /127)' },
      { card: "الأدلة", sub: "القرآن الكريم", text: "قال تعالى: ﴿وَعَلَى اللَّهِ فَتَوَكَّلُوا﴾ [المائدة: 23]" },
    ]);
  });

  it("drops a section with any garbled part instead of repairing it", () => {
    const html = page(
      card("الفضل", `نص فيه رموز المصحف ${String.fromCharCode(0xfb65, 0xfb66)} هنا.`) +
        card("وسائل الاكتساب", "وقال @ في موضع آخر: كذا.") +
        card("الصور", `نص ${WORD_PASTE_ARTIFACT} ثم نص آخر.`),
    );
    const out = extractJamharaPage(html);
    expect(out.sections).toEqual([]);
    expect(out.dropped.map((d) => d.card)).toEqual(["الفضل", "وسائل الاكتساب", "الصور"]);
  });

  it("splits long sections at the page's own list markers, verbatim and in order", () => {
    const item = (n: number) => `${n}- ${"أن يحسن الظن بالله تعالى ويجتهد في الأخذ بالأسباب، ".repeat(9).trim()}.`;
    const text = [1, 2, 3, 4, 5].map(item).join(" ");
    const split = splitLessonBody(text, 1200, 3)!;
    expect(split.parts.length).toBeGreaterThan(1);
    expect(split.parts.every((p) => p.length <= 1200)).toBe(true);
    expect(split.parts.every((p) => /^\d- /.test(p))).toBe(true);
    if (split.complete) expect(split.parts.join(" ")).toBe(text);
    else expect(text.startsWith(split.parts.join(" "))).toBe(true);
  });

  it("never separates a quotation from the citation that follows it", () => {
    const long = "كلام طويل في الرضا بالقضاء والقدر وثمراته على القلب. ".repeat(14);
    const text = `${long}قال ابن القيم: «الرضا باب الله الأعظم». "مدارج السالكين" (2 /172)`;
    const split = splitLessonBody(text, 700, 3)!;
    expect(split.parts.some((p) => p.startsWith('"مدارج'))).toBe(false);
  });
});

describe("learning cues → focus", () => {
  it.each([
    ["كيف أدعي؟", ["how"]],
    ["أبي أتعلم عن التوكل", ["meaning", "how"]],
    ["اشرح لي التوكل", ["meaning", "how"]],
    ["أبي أفهم كيف يكون التوكل", ["how"]],
    ["علمني عن الصبر", ["meaning", "how"]],
    ["أبي أعرف أكثر عن الشكر", ["meaning", "how"]],
    ["وش معنى الرجاء؟", ["meaning"]],
    ["وش فضل الشكر", ["virtues"]],
    ["ما ثمرات التوكل؟", ["fruits"]],
    ["ما آداب الدعاء؟", ["etiquette"]],
    ["ما أنواع الصبر؟", ["types"]],
    ["أعطني أمثلة على الصبر", ["examples"]],
    ["teach me about patience", ["meaning", "how"]],
    ["How do I make dua?", ["how"]],
    ["what is the meaning of tawakkul", ["meaning"]],
  ])("%s", (message, focus) => {
    expect(detectLearningFocus(message)).toEqual(focus);
  });

  it.each(["تعبت من الضغط", "ما أفهم ليش صار كذا، أبوي توفى", "كيف حالك", "أنا أفضل الآن", "how are you"])(
    "feelings and greetings are not learning requests: %s",
    (message) => {
      expect(detectLearningFocus(message)).toEqual([]);
    },
  );

  it("merges cues first, then the model, at most 3, canonical order", () => {
    expect(mergeLearningFocus(["how"], ["examples", "meaning", "virtues"])).toEqual(["meaning", "how", "examples"]);
    expect(mergeLearningFocus([], undefined)).toEqual([]);
  });
});

describe("lesson selection", () => {
  const bodies = new Set(file.records.map((r) => r.body_ar));

  it("tawakkul, meaning + how → up to 3 verbatim lessons, covered", () => {
    const sel = selectLessons({ topicId: "tawakkul", focus: ["how", "meaning"], message: "أبي أتعلم عن التوكل" })!;
    expect(sel.learning_request).toEqual({ focus: ["meaning", "how"], covered: true });
    // «التعريف اصطلاحًا» quotes a report via al-Khallal (no Sahihayn grade) → dropped; the linguistic definition remains.
    expect(sel.lessons.map((l) => l.id)).toEqual(["jamhara-646-meaning-2-1", "jamhara-646-how-1-1", "jamhara-646-how-1-2"]);
    for (const l of sel.lessons) {
      expect(bodies.has(l.body_ar)).toBe(true);
      expect(l.topicId).toBe("tawakkul");
      expect(l.source).toMatchObject({ name: "موسوعة مفردات المحتوى الإسلامي: الجمهرة", url: "https://islamic-content.com/t/646" });
      expect(l.source.reference.startsWith("التوكل — ")).toBe(true);
    }
  });

  it("is deterministic", () => {
    const a = selectLessons({ topicId: "gratitude", focus: ["virtues", "meaning"], message: "x" });
    const b = selectLessons({ topicId: "gratitude", focus: ["meaning", "virtues"], message: "x" });
    expect(a).toEqual(b);
  });

  it("«كيف أدعي؟» on the nearness journey → the printed etiquette of du'a", () => {
    const sel = selectLessons({ topicId: "nearness", focus: ["how"], message: "كيف أدعي؟" })!;
    expect(sel.learning_request.covered).toBe(true);
    expect(sel.lessons.length).toBe(3);
    expect(sel.lessons.every((l) => l.id.startsWith("jamhara-2366-etiquette-"))).toBe(true);
    // Without du'a in the person's words, nearness leans on الإنابة instead.
    const other = selectLessons({ topicId: "nearness", focus: ["how"], message: "أبي أعرف كيف أقرب من الله" })!;
    expect(other.lessons.map((l) => l.id)).toEqual(["jamhara-656-how-1-1"]);
  });

  it("states honestly when the approved content does not cover the requested part", () => {
    expect(selectLessons({ topicId: "tawakkul", focus: ["etiquette"], message: "ما آداب التوكل؟" })).toEqual({
      lessons: [],
      learning_request: { focus: ["etiquette"], covered: false },
    });
    // A related concept's definition never stands in for the word that was asked about.
    const grief = selectLessons({ topicId: "grief", focus: ["meaning", "how"], message: "علمني عن الحزن" })!;
    expect(grief.learning_request.covered).toBe(false);
    expect(grief.lessons.every((l) => l.aspect !== "meaning")).toBe(true);
    // The steps of a ritual are fiqh, not concept lessons.
    expect(selectLessons({ topicId: "nearness", focus: ["how"], message: "كيف أصلي صلاة الاستخارة بالتفصيل؟" })).toEqual({
      lessons: [],
      learning_request: { focus: ["how"], covered: false },
    });
  });

  it("no focus → no learning request at all", () => {
    expect(selectLessons({ topicId: "patience", focus: [], message: "تعبت" })).toBeNull();
    expect(selectLessons({ topicId: "patience", focus: undefined })).toBeNull();
  });
});

describe("hadith inside lessons follow the reference pack's grade rule", () => {
  it("publishes a section only when every hadith it cites is in al-Bukhari or Muslim", async () => {
    const { ungradedHadithProblem } = await import("./lessonRepository");
    expect(ungradedHadithProblem("نص بلا حديث.")).toBeNull();
    expect(ungradedHadithProblem("قال ﷺ: «...» [أخرجه البخاري (6470)].")).toBeNull();
    expect(ungradedHadithProblem("قال ﷺ: «...» [أخرجه مسلم (2999)]. وقال: «...» [أخرجه البخاري (1)].")).toBeNull();
    expect(ungradedHadithProblem("قال ﷺ: «...» [أخرجه الترمذي: (3479)].")).toMatch(/outside the Sahihayn/);
    expect(ungradedHadithProblem("قال ﷺ: «...» [أخرجه البخاري (1)]. «...» [أخرجه أبو داود (1522)].")).toMatch(/outside the Sahihayn/);
    expect(ungradedHadithProblem("قال النبي ﷺ: «...».")).toMatch(/no citation/);
  });

  it("no published lesson quotes an ungraded hadith", async () => {
    const { publishedLessons, ungradedHadithProblem } = await import("./lessonRepository");
    for (const r of publishedLessons().records) expect(ungradedHadithProblem(r.body_ar)).toBeNull();
  });
});

describe("named subject and honest gaps", () => {
  const records = publishedLessons().records;

  it("a named subject is answered only by its own entry — never by a neighbouring concept", () => {
    const withoutDuaHowTo = records.filter((r) => !(r.entryId === 2366 && r.aspect === "etiquette"));
    const sel = selectLessons({ topicId: "nearness", focus: ["how"], message: "كيف أدعي؟", records: withoutDuaHowTo })!;
    // No clean du'a how-to → not covered, and الإنابة's means are not offered in its place;
    // the du'a entry's own clean definition is shown as context.
    expect(sel.learning_request).toEqual({ focus: ["how"], covered: false });
    expect(sel.lessons.map((l) => l.id)).toEqual(["jamhara-2366-meaning-1-1"]);
    expect(sel.lessons.some((l) => l.source.url.endsWith("/t/656"))).toBe(false);
  });

  it("every stored du'a etiquette part cites only al-Bukhari/Muslim or no hadith at all", async () => {
    const { ungradedHadithProblem } = await import("./lessonRepository");
    const dua = records.filter((r) => r.entryId === 2366 && r.aspect === "etiquette");
    expect(dua.length).toBeGreaterThan(0);
    for (const r of dua) {
      expect(ungradedHadithProblem(r.body_ar)).toBeNull();
      expect(r.body_ar).not.toMatch(/الترمذي|أبو داود|ابن ماجه|الطبراني|النسائي|ابن حبان/);
    }
  });

  it("an uncited quotation of the Prophet ﷺ counts as an ungraded hadith", async () => {
    const { ungradedHadithProblem } = await import("./lessonRepository");
    expect(ungradedHadithProblem("وهذا رسوله ﷺ قد أظهر العجز؛ فقال في مناجاته: «لا أحصي ثناء عليك»")).toMatch(/no citation/);
    expect(ungradedHadithProblem("كان النّبي صلى الله عليه وسلّم يقول في دعائه: «ربِّ اجعلني لَكَ شَكَّارًا»")).toMatch(/no citation/);
    expect(ungradedHadithProblem("قال ابن القيم: «الرضا باب الله الأعظم» \"مدارج السالكين\" (2 /172)")).toBeNull();
  });
});
