import { describe, expect, it, vi } from "vitest";
import snapshot from "./snapshots/quran.published.json";
import { loadQuranSnapshot } from "./quranSnapshot";
import { LIVE_TOPIC_QURAN_ANCHORS } from "./topicQuranAnchors";
import { assessTopicPackReadiness, readyTopicIds } from "./topicPackReadiness";
import { getPublishedContentRecord } from "./publishedRepository";

describe("committed Quranpedia snapshot (zero network at runtime)", () => {
  it("covers every live topic anchor and loads without rejections", () => {
    const loaded = loadQuranSnapshot();
    expect(loaded.rejected).toEqual([]);
    expect(loaded.records.map((r) => r.id).sort()).toEqual(LIVE_TOPIC_QURAN_ANCHORS.map((a) => a.contentId).sort());
  });

  it("records keep live_api provenance with the original fetch time", () => {
    for (const record of loadQuranSnapshot().records) {
      const row = snapshot.records.find((r) => r.contentId === record.id)!;
      expect(record.provenance.verificationStatus).toBe("published");
      expect(record.provenance.reviewEvidence?.evidenceType).toBe("live_api");
      expect(record.provenance.reviewEvidence?.reviewedAt).toBe(row.fetchedAt);
      expect(record.provenance.reviewEvidence?.checkedAgainst).toBe(row.evidence.checkedAgainst);
      expect(record.arabic).toBe(row.arabic);
      expect(record.source.name).toBe("Quranpedia");
    }
  });

  it("drops a record whose text was edited after the fetch (fingerprint mismatch)", () => {
    const tampered = structuredClone(snapshot);
    tampered.records[0]!.arabic = `${tampered.records[0]!.arabic} زيادة`;
    const loaded = loadQuranSnapshot(tampered);
    expect(loaded.rejected).toEqual([{ contentId: snapshot.records[0]!.contentId, reason: "TEXT_FINGERPRINT_MISMATCH" }]);
    expect(loaded.records).toHaveLength(snapshot.records.length - 1);
  });

  it("rejects records for unknown anchors or a malformed file", () => {
    const bad = structuredClone(snapshot);
    bad.records[0]!.contentId = "quran-unknown";
    expect(loadQuranSnapshot(bad).rejected[0]?.reason).toBe("UNKNOWN_ANCHOR");
    expect(loadQuranSnapshot({ kind: "x" }).records).toEqual([]);
  });

  it("every published topic is ready offline — without any fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const all = ["amanah", "anxiety", "effort", "gratitude", "grief", "hope", "loss", "nearness", "patience", "tawakkul"];
    for (const id of all) {
      expect([id, assessTopicPackReadiness(id).ready]).toEqual([id, true]);
    }
    expect(readyTopicIds().sort()).toEqual(all);
    expect(getPublishedContentRecord("quran-zumar-10")?.provenance.reviewEvidence?.evidenceType).toBe("live_api");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("ready topics are journey-safe", () => {
  it("every topic the model may suggest opens a journey in both languages", async () => {
    const { runJourney } = await import("../ai/orchestrate");
    for (const topicId of readyTopicIds()) {
      for (const language of ["ar", "en"] as const) {
        const result = await runJourney(
          { message: "x", language, context: [], topicId, analyzeLevel: "A" },
          { name: "live" },
        );
        expect([topicId, language, result.ok]).toEqual([topicId, language, true]);
      }
    }
  });
});
