import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GuidanceResult } from "@/Journey";
import { copy } from "@/copy";
import { buildRepositoryJourneyPayload } from "../../server/ai/orchestratePayload";
import { resolveTopicLearningPack } from "../../server/content/topicLearning";

/** Renders the real repository payload (committed snapshots) — no hand-made fixtures. */
function renderTopic(topicId: "patience" | "nearness", lang: "ar" | "en") {
  const { pack } = resolveTopicLearningPack(topicId, "A", lang);
  const payload = buildRepositoryJourneyPayload(topicId, pack!, "A", lang);
  render(<GuidanceResult analyze={null} payload={payload} t={copy[lang]} ar={lang === "ar"} onNext={null} onRestart={() => {}} />);
  return payload;
}

const stage = (k: string) => document.querySelector<HTMLElement>(`[data-stage="${k}"]`)!;

describe("journey stages with verified source content", () => {
  it("hadith: its focal line, then the verbatim text; collection + number, كتاب/باب, grade, and the exact Shamela page", () => {
    const payload = renderTopic("patience", "ar");
    const hadith = payload.hadith!;
    const s = stage("hadith");
    const quote = s.querySelector("blockquote")!;
    if (hadith.highlight) {
      expect(quote.querySelector(".hq__line")!.textContent).toBe(hadith.highlight);
      fireEvent.click(within(s).getByRole("button", { name: copy.ar.showFullHadith }));
    }
    expect(quote.textContent).toBe(hadith.arabic);
    expect(s.querySelector(".src-chip")).toHaveTextContent("صحيح البخاري · 1469");
    expect(s.textContent).toContain("كتاب الزكاة");
    expect(s.querySelector(".grade-tag")).toHaveTextContent(`${copy.ar.grade}: صحيح`);
    expect(within(s).getByRole("link").getAttribute("href")).toBe("https://shamela.ws/book/1681/2367");
  });

  it("tafsir: the Tabari excerpt with its editor, volume/page and a link; the step sits under the connection", () => {
    const payload = renderTopic("patience", "ar");
    const tafsir = payload.quran_explanation!;
    const s = stage("tafsir");
    const text = s.querySelector(".aside__text")!;
    const more = within(s).queryByRole("button", { name: copy.ar.showFullTafsir });
    if (more) fireEvent.click(more);
    expect(text.textContent).toBe(tafsir.arabic);
    expect(s.querySelector(".src-chip")).toHaveTextContent("ج21 ص269–270");
    expect(within(s).getByRole("link").getAttribute("href")).toContain("quranpedia.net/embed?surah=39&ayah=10");
    const step = stage("connect").querySelector(".cpoint__step")!;
    expect(within(step as HTMLElement).getByText(payload.suggested_action.title)).toBeTruthy();
    expect(within(step as HTMLElement).getByText(payload.suggested_action.description)).toBeTruthy();
  });

  it("verse and Seerah: the curated light is an exact part of the text; the beats rejoin to the passage", () => {
    const payload = renderTopic("patience", "ar");
    const lit = [...stage("verse").querySelectorAll(".verse .lit")].map((l) => l.textContent).join("");
    if (payload.content?.highlight) expect(lit).toBe(payload.content.highlight);
    const beats = [...stage("seerah").querySelectorAll(".beat")].map((b) => b.textContent);
    expect(beats.join(" ")).toBe(payload.story!.body.join(" "));
    for (const k of stage("seerah").querySelectorAll(".kq")) expect(payload.story!.key_quotes).toContain(k.textContent);
  });

  it("in English, Arabic-only source text is labelled as such and the step is in English", () => {
    const payload = renderTopic("nearness", "en");
    expect(payload.hadith?.provenance.hadith?.collection).toBe("صحيح مسلم");
    expect(screen.getAllByText(copy.en.arabicOnly).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(payload.suggested_action.title)).toBeTruthy();
    expect(payload.suggested_action.title).toMatch(/^[\x20-\x7e]+$/);
  });
});
