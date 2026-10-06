import { describe, expect, it } from "vitest";
import {
  hadithChip,
  leadOf,
  litRuns,
  markPieces,
  seerahChip,
  shortName,
  storyBeats,
  tafsirChip,
  verseChip,
  verseRuns,
} from "@/journeyText";
import type { VerifiedContent, VerifiedStory } from "../../shared/experience/guidance";

const V286 =
  "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَا إِنْ نَسِينَا أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِنْ قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِ ۖ وَاعْفُ عَنَّا وَاغْفِرْ لَنَا وَارْحَمْنَا ۚ أَنْتَ مَوْلَانَا فَانْصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ";
const WORDS = new Set(V286.split(" "));

const content = (over: Partial<VerifiedContent>): VerifiedContent =>
  ({
    content_id: "c",
    type: "quran",
    topicId: "anxiety",
    level: "A",
    published: true,
    verified: true,
    arabic: V286,
    translation: "",
    place: "سورة البقرة",
    reference: "2:286",
    source: { name: "Quranpedia", reference: "2:286" },
    provenance: { sourceId: "s", sourceReference: "2:286", verificationStatus: "published", contentOrigin: "source_text", verificationDisclosure: "", attributionDisclosure: "" },
    ...over,
  }) as VerifiedContent;

const story = (over: Partial<VerifiedStory>): VerifiedStory =>
  ({
    story_id: "s",
    topicId: "anxiety",
    level: "A",
    published: true,
    verified: true,
    title: "حين رهن النبي ﷺ درعه",
    headline: "",
    opening: "",
    body: ["الجزء الأول، الجزء الثاني"],
    lessons: [],
    takeaway: "",
    keep: "",
    source: { name: "صحيح البخاري (ط. السلطانية) — المكتبة الشاملة", reference: "صحيح البخاري 2916", url: "https://shamela.ws/book/1681/4626" },
    provenance: { sourceId: "s", sourceReference: "صحيح البخاري 2916", verificationStatus: "published", contentOrigin: "source_text", verificationDisclosure: "", attributionDisclosure: "" },
    ...over,
  }) as VerifiedStory;

describe("verbatim cutting", () => {
  it("cuts a verse into short runs at pause marks and spaces only — joined, they are the verse", () => {
    const runs = verseRuns(V286);
    expect(runs.join("")).toBe(V286);
    expect(runs.length).toBeGreaterThan(4);
    for (const r of runs) {
      // every run is whole words (never a cut inside a word)
      for (const w of r.trim().split(" ")) expect(WORDS.has(w)).toBe(true);
      expect(r.trim().split(" ").length).toBeLessThanOrEqual(7);
    }
    expect(runs[0].trim()).toBe("لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ");
  });

  it("lights a clause across runs without changing a character", () => {
    const hl = "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا";
    const pieces = litRuns(verseRuns(V286), hl);
    expect(pieces.flat().map((p) => p.text).join("")).toBe(V286);
    expect(pieces.flat().filter((p) => p.lit).map((p) => p.text).join("")).toBe(hl);
    // a highlight that is not in the text lights nothing
    expect(litRuns(verseRuns(V286), "نص غير موجود").flat().some((p) => p.lit)).toBe(false);
  });

  it("marks exact substrings only; pieces always rejoin to the source", () => {
    const text = "عَنْ عَائِشَةَ قَالَتْ: «تُوُفِّيَ رَسُولُ اللهِ ﷺ وَدِرْعُهُ مَرْهُونَةٌ»";
    const pieces = markPieces(text, ["وَدِرْعُهُ مَرْهُونَةٌ", "غير موجود", undefined, ""]);
    expect(pieces.map((p) => p.text).join("")).toBe(text);
    expect(pieces.filter((p) => p.lit).map((p) => p.text)).toEqual(["وَدِرْعُهُ مَرْهُونَةٌ"]);
  });

  it("uses a tafsir lead only when it is a shorter, exact opening", () => {
    const full = "الجملة الأولى. الجملة الثانية.";
    expect(leadOf(content({ arabic: full, lead: "الجملة الأولى." }))).toBe("الجملة الأولى.");
    expect(leadOf(content({ arabic: full, lead: full }))).toBeUndefined();
    expect(leadOf(content({ arabic: full, lead: "جملة أخرى." }))).toBeUndefined();
    expect(leadOf(content({ arabic: full }))).toBeUndefined();
  });

  it("uses Seerah beats only when they rejoin to the passage; otherwise the paragraphs", () => {
    expect(storyBeats(story({ beats: ["الجزء الأول،", "الجزء الثاني"] }))).toEqual(["الجزء الأول،", "الجزء الثاني"]);
    expect(storyBeats(story({ beats: ["الجزء الأول،", "نص آخر"] }))).toEqual(["الجزء الأول، الجزء الثاني"]);
    expect(storyBeats(story({}))).toEqual(["الجزء الأول، الجزء الثاني"]);
  });
});

describe("source chips", () => {
  it("verse: surah, reference, source", () => {
    expect(verseChip(content({}))).toEqual(["البقرة 2:286", "Quranpedia"]);
  });

  it("tafsir: book with its editor, then volume and page", () => {
    const c = content({
      reference: "2:286 · ج6 ص131",
      source: { name: "تفسير الطبري — جامع البيان في تأويل آي القرآن (Quranpedia)", reference: "2:286 · ج6 ص131" },
      provenance: {
        ...content({}).provenance,
        tafsir: { surah: 2, ayah: 286, book: "جامع البيان", author: "الطبري", volume: 6, pages: [131], editor: "أحمد شاكر", url: "https://quranpedia.net" },
      },
    });
    expect(tafsirChip(c)).toEqual(["تفسير الطبري، ت. أحمد شاكر", "ج6 ص131"]);
    // without provenance: the name and the locator part of the reference
    expect(tafsirChip(content({ reference: "39:10 · ج21 ص269–270", source: { name: "تفسير الطبري — جامع البيان", reference: "" } }))).toEqual([
      "تفسير الطبري",
      "ج21 ص269–270",
    ]);
  });

  it("hadith: collection and number", () => {
    const c = content({
      provenance: { ...content({}).provenance, hadith: { collection: "صحيح البخاري", hadithReference: "5641", number: 5641, grade: "صحيح" } },
    });
    expect(hadithChip(c)).toEqual(["صحيح البخاري", "5641"]);
  });

  it("Seerah: a Sahih narration by number; a Seerah book by volume and page", () => {
    const base = story({}).provenance;
    expect(seerahChip(story({ provenance: { ...base, seerah: { sourceReference: "صحيح البخاري 2916", book: "صحيح البخاري", sourceKind: "sahih", number: 2916 } } }))).toEqual([
      "صحيح البخاري",
      "2916",
    ]);
    expect(
      seerahChip(story({ provenance: { ...base, seerah: { sourceReference: "سيرة ابن هشام ج1 ص236", book: "سيرة ابن هشام", sourceKind: "seerah_book", volume: 1, page: 236 } } })),
    ).toEqual(["سيرة ابن هشام", "ج1 ص236"]);
    expect(seerahChip(story({}))).toEqual(["صحيح البخاري 2916"]);
  });

  it("short names drop the edition and the platform", () => {
    expect(shortName("صحيح البخاري (ط. السلطانية) — المكتبة الشاملة")).toBe("صحيح البخاري");
  });
});
