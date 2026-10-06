import { describe, expect, it } from "vitest";
import { getDefaultKnowledgeBase } from "../content/knowledge/knowledgeData";
import { englishStems } from "../content/knowledge/knowledgeBase";
import { isTooThin } from "./orchestrate";

describe("thin messages", () => {
  it("treats interjections and punctuation as too thin to understand", () => {
    for (const m of ["هممم", "hmm", "...", "؟؟", "اه", "ok"]) expect(isTooThin(m)).toBe(true);
  });
  it("keeps a single real word, Arabic or English", () => {
    for (const m of ["حزين", "قلقان", "tired", "تعبت"]) expect(isTooThin(m)).toBe(false);
  });
});

describe("English retrieval over Bayyinat keywords", () => {
  it("stems common English forms", () => {
    expect(englishStems("Why do Muslims pray five times a day?")).toEqual(["pray", "five", "time", "day"]);
    expect(englishStems("prayers praying prayer")).toEqual(["pray", "pray", "pray"]);
  });
  it("finds the five-daily-prayers question from plain English", () => {
    const kb = getDefaultKnowledgeBase();
    const ids = kb.findCandidates("Why do Muslims pray five times a day?").map((c) => c.id);
    expect(ids).toContain("byn-0205");
  });
  it("does not select an answer from generic words alone", () => {
    const kb = getDefaultKnowledgeBase();
    expect(kb.findCandidates("What is the weather today in Riyadh?").filter((c) => c.kind === "qa")).toEqual([]);
  });
});
