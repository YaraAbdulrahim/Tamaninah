/**
 * Refresh the committed offline Quran snapshot from the live Quranpedia API v1.
 *
 *   npm run snapshot:quran
 *
 * Fetches every LIVE_TOPIC_QURAN_ANCHORS ayah (mushaf text + English translation), runs each one
 * through the same normalize → review → publish gates the runtime uses, and writes
 * server/content/snapshots/quran.published.json. Nothing is written unless every anchor
 * succeeds, so a partial outage never shrinks the published set.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TMN_QURAN } from "../content/catalogProvenance";
import { fetchQuranpediaAyah, liveApiCheckedAgainst } from "../content/connectors/quranpedia";
import { liveQuranFingerprint, publishLiveQuranBundle } from "../content/ingestion/liveQuranPipeline";
import {
  QURAN_SNAPSHOT_KIND,
  QURAN_SNAPSHOT_SCHEMA,
  type QuranSnapshotFile,
  type QuranSnapshotRecord,
} from "../content/quranSnapshotFormat";
import { LIVE_TOPIC_QURAN_ANCHORS } from "../content/topicQuranAnchors";

const API_BASE = "https://api.quranpedia.net/v1";
const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../content/snapshots/quran.published.json");

async function main() {
  const records: QuranSnapshotRecord[] = [];
  for (const anchor of LIVE_TOPIC_QURAN_ANCHORS) {
    const fetched = await fetchQuranpediaAyah(anchor.surah, anchor.ayah, anchor.mushafId, {
      useFixtures: false,
    });
    if (!fetched.ok) {
      throw new Error(`Quranpedia fetch failed for ${anchor.contentId}: ${fetched.code} ${fetched.message}`);
    }
    const fetchedAt = new Date().toISOString();
    const bundle = fetched.bundle;
    const published = publishLiveQuranBundle(anchor, bundle, fetchedAt);
    if (!published) throw new Error(`Pipeline rejected ${anchor.contentId}`);

    records.push({
      contentId: anchor.contentId,
      topicId: anchor.topicId,
      surah: bundle.surah,
      ayah: bundle.ayah,
      mushafId: bundle.mushafId,
      translationBookId: bundle.translationBookId,
      arabic: bundle.arabic,
      translationEn: bundle.translationEn,
      fetchedAt,
      requests: [
        `${API_BASE}/mushafs/${bundle.mushafId}/${bundle.surah}/${bundle.ayah}`,
        `${API_BASE}/translations/${bundle.surah}/${bundle.ayah}/en`,
      ],
      evidence: {
        evidenceType: "live_api",
        reviewerRole: "connector:quranpedia",
        checkedAgainst: liveApiCheckedAgainst(bundle.mushafId, bundle.surah, bundle.ayah),
      },
      textFingerprint: liveQuranFingerprint(anchor, bundle),
    });
    console.info(`[snapshot] ${anchor.contentId} ${bundle.surah}:${bundle.ayah} ok`);
  }

  const file: QuranSnapshotFile = {
    kind: QURAN_SNAPSHOT_KIND,
    schema: QURAN_SNAPSHOT_SCHEMA,
    sourceId: TMN_QURAN,
    source: `Quranpedia API v1 (${API_BASE}) — read-only, allowlisted connector`,
    generatedAt: new Date().toISOString(),
    generator: "npm run snapshot:quran (server/scripts/snapshotQuran.ts)",
    notes:
      "Verbatim API responses captured by the live pipeline. Loaded synchronously at server start so " +
      "Quran items need zero network at runtime. Do not hand-edit: records whose text no longer matches " +
      "textFingerprint are dropped at load.",
    records,
  };

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  console.info(`[snapshot] wrote ${records.length} records → ${target}`);
}

main().catch((error) => {
  console.error(`[snapshot] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
