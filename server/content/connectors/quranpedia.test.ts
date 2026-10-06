import { describe, expect, it } from "vitest";
import { fetchQuranpediaAyah, quranpediaFixtureFetch } from "./quranpedia";

describe("Quranpedia connector", () => {
  it("fixture fetch returns typed ayah bundle", () => {
    const result = quranpediaFixtureFetch(1, 39, 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.arabic.length).toBeGreaterThan(10);
    expect(result.bundle.translationEn.length).toBeGreaterThan(10);
    expect(result.bundle.surah).toBe(39);
    expect(result.bundle.ayah).toBe(10);
  });

  it("uses fixtures under Vitest without network", async () => {
    const result = await fetchQuranpediaAyah(39, 10, 1, { useFixtures: true });
    expect(result.ok).toBe(true);
  });

  it("rejects unknown fixture keys", () => {
    const result = quranpediaFixtureFetch(1, 1, 1);
    expect(result.ok).toBe(false);
  });
});
