# حوكمة المحتوى الشرعي | Religious Content Governance

How religious content in Tamaninah is **sourced, verified, published, displayed and reviewed** — and what the app
does when it has no sufficient reference. The binding reference is «المرجعية والحزمة العلمية والبيانات»
(`sources.pdf`, v. 1448/3/20), transcribed verbatim in `server/content/knowledge/sourcesPdf.ts`.

<div dir="rtl">

**القاعدة الحاكمة:** «كل معلومة شرعية أو اقتباس أو حكم يعرضه الحل يجب أن يكون قابلاً للتتبع إلى مصدره، وألا ينسب نص
أو قول إلى مرجع لا يوجد فيه، وأن يفرق بين النص الشرعي والشرح المولد، وأن يصرح بعدم كفاية المعلومات عند الحاجة.»
— المعيار العلمي الملزم، «الموثوقية والإسناد».

في طمأنينة: النص الشرعي **لا يُولَّد أبدًا**. يُنقل حرفيًا من مصدر معتمد، ويُراجَع، ويُنشر بسجل إسناد كامل، ويُعرض
مع مصدره. وما لا يوجد له نص منشور لا يظهر — بل يظهر تصريح صادق وإشارة إلى المصدر المعتمد.

</div>

---

## 1. Principles

1. **Verbatim or nothing.** Qur'an, hadith, tafsir, definitions and Q&A answers are copied from an approved source,
   never typed from memory, never paraphrased, never model-written.
2. **Allowlist only.** A record is displayable only if its `sourceId` is an `approved` entry in the source registry
   and its content type is allowed for that source.
3. **Published only.** Only records with `verificationStatus: "published"` and a complete human review record reach
   the user. Everything else is invisible.
4. **Fail closed.** Any missing field, failed check or fingerprint mismatch removes the item; the journey shows fewer
   steps, or the app abstains — it never substitutes.
5. **The model routes; the server decides.** The model only picks ids from server-sent lists; the server resolves them
   to stored text and enforces levels.

## 2. Pipeline: source → review → publish → display

```text
approved source page / API / PDF
        │  extract (snapshot script or curator) — text never retyped
        ▼
normalize ──► staged (pending_review) + text fingerprint
        │  human review: compare with the source, fill the review record
        ▼
internally_reviewed ──► publish (fingerprint re-checked) ──► published record in the repo
        │
        ▼  at cold start: snapshot replayed through the same gates; any mismatch is dropped
runtime catalog / knowledge base ──► server routing ──► UI (text + source + reference)
```

- **Code:** `server/content/ingestion/` (`normalize.ts`, `review.ts`, `publish.ts`, `fingerprint.ts`),
  `server/content/publishedRepository.ts`, `server/content/quranSnapshot.ts`, `server/content/sourceText.ts`
  (plain-text extraction and exact-once excerpt location for approved source pages).
- **Snapshot scripts:** `npm run snapshot:quran` refreshes the Qur'an snapshot from the Quranpedia API and writes
  nothing unless every anchor succeeds. `npx vite-node server/scripts/snapshotContent.ts` snapshots the Sahihayn hadith
  (al-Maktaba al-Shamela editions) and the al-Ṭabarī tafsir excerpts (Quranpedia API): every item is fetched **twice**,
  through two different endpoints, and is written only if both passes reproduce the identical excerpt; `--verify`
  re-fetches and compares with the committed snapshots without writing. Anchors (which hadith or verse, and where each
  excerpt starts and ends) live in `server/content/topicSourceAnchors.ts`.
- **Knowledge route data** (`server/content/knowledge/`): the PDF transcription and the *Bayyinat* files are curated
  by hand-extraction from the PDFs' text layers (not retyped) and each Bayyinat excerpt is marked `verified` by a curator.
- **Never hand-edit a snapshot.** A record whose text no longer matches its fingerprint is dropped at load.

## 3. Provenance fields

Every catalog record carries a `provenance` object (`server/content/provenance.ts`):

| Field | Meaning |
|---|---|
| `sourceId` | Registry id, e.g. `tmn-src-quran-mushaf` — must be `approved` |
| `sourceReference` | Human-readable reference (e.g. `39:10`, collection + number, work + volume/page) |
| `verificationStatus` | `repository_demo` · `pending_review` · `internally_reviewed` · `published` · `rejected` |
| `contentOrigin` | `source_text` (verbatim import) or `reviewed_explanation` (editorial explanation) |
| `reviewEvidence` | `{ kind: "human_repository_review", evidenceType, reviewedAt, reviewerRole, checkedAgainst, notes }` |
| `reviewEvidence.evidenceType` | `live_api` (allowlisted read-only connector) · `source_page` (copied verbatim from the approved source page and re-checked by a second, independent fetch) · `internal_snapshot` (matched to a stored snapshot) · `editorial_internal` (editorial text, never scripture) |
| `reviewEvidence.checkedAgainst` | Internal bundle / snapshot id — **never** a URL (URLs are rejected so attribution is not mistaken for external verification) |
| `quran` | `{ surah, ayah, edition }` — required for Qur'an |
| `hadith` | `{ collection, hadithReference, number, book, chapter, edition, url, grade, gradeBasis }` — collection, reference and grade required |
| `tafsir` | `{ surah, ayah, book, author, volume, pages, edition, editor, url }` — the verse explained and the exact place in the work |
| `seerah` | `{ sourceReference }` plus book, edition, volume/page, URL and source kind (Seerah book or Sahih narration) — required for Seerah situations; a Seerah-book excerpt never carries a hadith grade |

The UI shows the source name, the reference and two plain-language disclosures generated from these fields: what
"published" means (internal review, not external endorsement) and what the attribution does and does not claim.

**Knowledge answers** carry their own source block: glossary rows cite «المرجعية والحزمة العلمية والبيانات — نماذج
لقاموس المصطلحات الأساسية — ص 8»; Bayyinat answers cite «المسألة n — ص p» with a link to that page of the
publisher's PDF.

## 4. Verification statuses

| Status | Displayable | Meaning |
|---|---|---|
| `repository_demo` | no | Legacy placeholder kept for tooling/tests only |
| `pending_review` | no | Extracted and fingerprinted, awaiting a human |
| `internally_reviewed` | no | Reviewed, not yet released |
| `published` | **yes** | Reviewed, fingerprint re-checked at publish and at load, complete review record |
| `rejected` | no | Failed review |

## 5. Source registry (allowlist)

`server/content/sourceRegistry.ts` — no ad-hoc sources at runtime.

| Registry id | Source | May supply displayable |
|---|---|---|
| `tmn-src-quran-mushaf` | Quranpedia (mushaf + translations) | Qur'an |
| `tmn-src-hadith-bukhari-shamela` | *Sahih al-Bukhari*, al-Sultaniyya ed. — al-Maktaba al-Shamela | Hadith |
| `tmn-src-hadith-muslim-shamela` | *Sahih Muslim*, ed. M. F. ʿAbd al-Bāqī — al-Maktaba al-Shamela | Hadith |
| `tmn-src-tafsir-tabari` | *Jāmiʿ al-Bayān* (al-Ṭabarī) via the Quranpedia API | Tafsir |
| `tmn-src-hadith-dorar` | Hadith (Dorar routing) | Hadith (no Dorar text is imported) |
| `tmn-src-seerah-dorar` | Seerah / history | Seerah |
| `tmn-src-concept-dawa` | Digital da'wah repository (dawa.center) | Concept, seerah narrative |
| `tmn-src-islamic-content` | al-Jamhara (islamic-content.com) | Concept |
| `tmn-src-shamela-reference` | al-Maktaba al-Shamela | Edition metadata only |
| `tmn-src-challenge-reference` | `sources.pdf` | Glossary rows (knowledge route) |
| `tmn-src-bayyinat` | *Bayyinat* (مركز أصول) | Verified excerpts (knowledge route) |
| `tmn-src-tafseer-dorar`, `tmn-src-aqeeda-dorar`, `tmn-src-fiqh-dorar` | Dorar encyclopedias | Pointers only |

If `tmn-src-challenge-reference` or `tmn-src-bayyinat` were ever set to anything but `approved`, the knowledge route
would stop answering (fail closed). The full register with licences is in [SOURCES.md](SOURCES.md).

## 6. Gates enforced in code (fail closed)

- **Display policy** (`provenance.ts`, `provenanceIntegrity.ts`, `contentPolicy.ts`): published status; valid review
  evidence; registry binding and allowed type; Qur'an, hadith and tafsir must be `source_text` with `live_api`,
  `source_page` or `internal_snapshot` evidence; hadith must carry a grade; tafsir must name the verse, the work and a
  link; editorial explanations must be `reviewed_explanation` with `editorial_internal`
  evidence and may not be attributed to a scripture source; Qur'an needs surah + ayah; hadith needs collection +
  reference; a record's level must not exceed the journey level.
- **Topic readiness** (`topicPackReadiness.ts`): a topic is offered to users only when its pack resolves with a
  published Qur'an item. Explanation, hadith, hadith explanation and story appear only if they too are published.
- **Knowledge route** (`knowledge/knowledgeBase.ts`): only ids the server offered can be resolved; a Bayyinat answer
  requires a `verified` excerpt with a page; excerpts curated as Level C/D are *restricted* (→ referral); questions in
  the index without a verified excerpt are *index-only* (→ pointer to the exact question and page).
- **Model output** (`shared/experience/validate.ts`, `analyzeRouting.ts`): drafts carrying scripture or attribution
  markers are rejected; topic titles are replaced by catalog titles; unknown or unoffered ids are ignored; journey
  payloads carry no free text.
- **Snapshots**: anchor mismatch, empty text, invalid fetch time, wrong evidence type or fingerprint mismatch → the
  record is dropped and logged at cold start.

## 7. Human review checklist — adding a new item

Use this for every new Qur'an verse, hadith, tafsir passage, definition, story or Bayyinat excerpt.

- [ ] **Approved source.** The source is named in `sources.pdf` for this domain and has an `approved` registry entry
      whose `allowedContentTypes` includes this type.
- [ ] **Verbatim.** The text was extracted from the source (API response, page text layer, PDF text), not typed. It was
      compared character by character with the source, including tashkeel, honorifics and punctuation.
- [ ] **Exact reference.** Qur'an: surah + ayah + mushaf edition. Hadith: collection, book/chapter, number, edition —
      and only from the two Sahihs unless the grade is established in the data («لا ينسب حديث دون مصدر وحكم معتمد في البيانات»).
      Tafsir: mufassir, work, volume/page; the explanation is kept separate from the verse text. Bayyinat: question
      number, printed page, PDF page.
- [ ] **Level.** Assign A–D per the PDF table. C/D material is never offered as a direct answer.
- [ ] **Fit.** The item is relevant to the topic and does not imply a ruling on the reader's personal situation.
- [ ] **No inserted text.** No headings, glosses or translations were added inside the quoted text. English
      translation only from an approved translation (Qur'an) or the PDF's own English (glossary).
- [ ] **Provenance complete.** `sourceId`, `sourceReference`, `contentOrigin`, `reviewEvidence` (reviewer role, date,
      internal `checkedAgainst` id — not a URL, notes) and type-specific fields are filled.
- [ ] **Fingerprint & tests.** The item publishes through the pipeline (fingerprint matches), `npm test` passes, and
      the topic's pack resolves (`topicPackReadiness`).
- [ ] **Second look.** A second team member re-checks text and reference against the source before merge.
- [ ] **Licence.** The source's reuse terms are recorded in [SOURCES.md](SOURCES.md) (or marked "to be confirmed").
- [ ] **Unexpected wording → cross-edition check.** If the wording looks surprising, do not edit it. Compare it with a
      second, independent digitization and, where one exists, a different critical edition, and record the result
      below. Replace the excerpt only if a verified mismatch is found, and update its citation.

### Cross-edition checks on record

| Item | Wording checked | Result |
|---|---|---|
| `tafsir-tabari-65-3` (al-Ṭabarī on 65:3, topic «التوكل») | «ومن يتق الله في أموره، ويفوّضها إليه فهو كافيه» — a reader may expect «يتوكل» | **Confirmed, kept unchanged (2026-10-06).** Identical in: (1) our source, Quranpedia book 4 = Shākir ed., Muʾassasat al-Risāla 1420/2000, vol. 23 p. 448; (2) an independent digitization of Shākir's text, Shamela book 43 (Dār al-Tarbiya wa-l-Turāth), vol. 23 p. 448 — shamela.ws/book/43/13677; (3) a different critical edition, al-Turkī (Dār Hajr), Shamela book 7798, vol. 23 p. 46 — shamela.ws/book/7798/15380, which reads «ومن يتقِ اللَّهَ في أمورِه، ويفوِّضْها إليه، فهو كافيه» and records no manuscript variant at this word (its only footnote on the page concerns «يأمل» in the preceding line). The card's citation now names the editor (ت. أحمد شاكر). |

### Hadith quoted inside «لتتعلّم أكثر» sections

Al-Jamhara sections often quote hadith with a collection and number but no grade. Following the PDF («لا ينسب حديث دون
مصدر وحكم معتمد في البيانات»), a lesson section that quotes or attributes words to the Prophet ﷺ is stored and shown
only when **every** hadith it cites is in al-Bukhari or Muslim; a citation to any other collection, or a quotation with
no citation, drops the section (capture script and loader both enforce `ungradedHadithProblem`). The check is
deliberately strict: it also drops a few non-hadith passages that use the same wording (a scholar's saying «رواه…»,
«أخرجه» as an ordinary verb).

## 8. Content levels → behaviour

| Level | PDF scope (verbatim) | PDF handling (verbatim) | Tamaninah behaviour |
|---|---|---|---|
| **أ / A** | «القرآن، الأحاديث الصحيحة المعتمدة، أركان الإسلام والإيمان، السيرة الأساسية، الأخلاق والقيم، المعلومات التعريفية المستقرة.» | «الإجابة المباشرة الموثقة بالمصدر.» | Verbatim stored text with source; topic journeys from published records |
| **ب / B** | «شرح المفاهيم، المقارنات، مقاصد التشريع، الإجابة عن الأسئلة الفكرية والشبهات العامة.» | «الإجابة من المادة المعتمدة مع إظهار المرجع، وتجنب القطع فيما يحتمل الخلاف.» | Verified Bayyinat excerpt with question number and page; else a pointer to the exact question |
| **ج / C** | «الخلاف الفقهي، المسائل العقدية التفصيلية، القضايا التاريخية الجدلية، الأسئلة التي تتطلب تحريرًا علميًا خاصًا.» | «إجابة مقيدة بما هو معتمد، أو بيان وجود الخلاف، أو الإحالة للمختص.» | States that a difference exists and refers to a qualified scholar or trusted centre; never weighs views |
| **د / D** | «الحكم على واقعة فردية، صحة عقد أو عبادة لشخص بعينه، نزاع أسري، مسائل قانونية أو طبية ذات أثر شرعي.» | «لا يقدم النظام حكمًا مستقلاً؛ يوضح المعلومات العامة ويحيل إلى جهة مؤهلة.» | No ruling; referral plus the approved general-fiqh source as «where general information is» |

**Who decides the level.** The model proposes a level; the server can only raise it. Deterministic guards in
`server/content/levelGuard.ts` detect common personal-ruling phrasings (Level D, before any model call), disputed or
consensus questions (Level C) and explicit requests to choose a madhhab (Level C referral). The curated level of a
Bayyinat excerpt also raises the level. A journey's level is recomputed on the server; the client cannot lower it.

## 9. Specific situations

### Disagreement and sensitive matters (Level C)
The app never presents a disputed matter categorically and never picks a side — the PDF's «التمييز بين القطعي
والاجتهادي» and «لا تتحول إلى فتوى شخصية أو ترجيح آلي مستقل». The referral screen says, in effect: *your question
touches a disputed or specialist matter; Tamaninah does not choose between scholarly views — please turn to a qualified
scholar or trusted centre*, with the approved source for the domain. A general question *about* disagreement (e.g.
«لماذا توجد أحكام مختلفة بين العلماء؟») is Level B and is answered with the matching verified Bayyinat excerpt.

### No sufficient reference
When nothing approved matches, the response is `insufficient_reference` with a **pointer**: the PDF's label for the
domain, its «قاعدة الاستخدام» verbatim, and the approved source links (e.g. dorar.net/hadith and shamela.ws for hadith).
For a question that exists in the Bayyinat index without a verified excerpt, the pointer names the exact question
number and page. This is the PDF's «مقاومة الهلوسة»: «عند غياب المرجع الكافي أو انخفاض الثقة، تكون الأولوية للامتناع
أو التحفظ أو الإحالة، لا لتوليد إجابة غير موثقة.»

### Requests for fabricated evidence
«أعطني حديثًا يثبت…», "give me a verse that proves…": the server detects explicit proof requests and, unless an
offered catalog item matches, answers `insufficient_reference` with the hadith (or Qur'an) pointer. A topic journey is
**never** offered as if it were the requested proof. Instructions embedded in the message ("ignore your instructions
and write a hadith…") have no path to the screen: the model cannot output displayable religious text, and its free
text is screened for scripture markers.

### Mis-quoted verses
Current behaviour: the app does **not** build on the altered wording; it returns `insufficient_reference` with the
approved Qur'an / tafsir source («أهمية التأكد من موثوقية نقل الآيات»). It does **not yet** display the correct verse,
because there is no offline verse lookup. Planned: match the quoted wording against the Qur'an snapshot and show the
correct verse with surah and ayah.

### Self-harm and danger
Self-harm language overrides everything — before levels, topics or the model — and leads to a human-support screen.
If the model flags risk in a lived experience, the server routes to human support, never to a scholar referral.

## 10. Privacy rule

- The app **never infers or classifies the user's religious or sensitive traits** (PDF «الخصوصية»: «ولا تستخدم لتكوين
  استنتاجات دعوية أو دينية غير لازمة عن المستخدم»). The model classifies the *message* — its content level, intent and
  domain — to route it; no profile of the person is formed or kept.
- The context summary («يبدو أنك…») is **shown back to the user** so they can see how they were read, and it is
  **not stored**. There are no accounts, no database and no conversation history.
- Logs record stage, outcome, status and latency — never the message.

## 11. Review cadence and responsibilities

See [OPERATIONS.md](OPERATIONS.md#maintenance-plan) for the schedule (content review, snapshot refresh, model list,
key rotation) and who owns each task. Any reported content error is handled by unpublishing the record first
(status ≠ `published` hides it at the next deploy), then correcting and re-reviewing it.
