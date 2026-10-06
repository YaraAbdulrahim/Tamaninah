# سجل المصادر والأدوات والتراخيص | Sources, Tools & Licenses Register

> Last reviewed: 2026-10-05. Where a publisher's reuse terms are not stated publicly, this register says
> **"terms to be confirmed with the publisher"** rather than assuming permission. Nothing in this register is a
> legal opinion.

<div dir="rtl">

**ملخص:** كل نص شرعي أو معرفي يظهر في طمأنينة مأخوذ حرفيًا من مصدر سمّته «المرجعية والحزمة العلمية والبيانات»
(`sources.pdf`)، ومحفوظ داخل المستودع مع مرجعه، ولا يُجلب من الشبكة وقت التشغيل، ولا يكتبه نموذج الذكاء الاصطناعي.
المصادر التي لم يُستورد منها نص بعدُ تظهر **إشارةً فقط** (اسم المصدر ورابطه) عند الامتناع أو الإحالة.

</div>

**Summary.** Every religious or scholarly text shown by Tamaninah is copied verbatim from a source named in the
challenge's reference pack (`sources.pdf`), stored in this repository with its reference, served with zero runtime
network, and never written by the AI model. Sources from which no text has been imported are used **as pointers
only** (name + link) when the app abstains or refers.

---

## (a) Knowledge sources | المصادر المعرفية

Usage modes: **Verbatim snapshot** = exact text stored in the repo and displayed with its reference ·
**Index** = metadata (question titles, numbers, pages) used for retrieval and pointers · **Pointer only** = the
source's name and URL are shown; no text is copied.

| # | Source (as named in sources.pdf) | What we use | How | Where in the repo | Verification | License / terms |
|---|---|---|---|---|---|---|
| 1 | **«المرجعية والحزمة العلمية والبيانات»** — `sources.pdf`, v. 1448/3/20 (the challenge's scholarly reference pack) | Scope (p.2), content levels A–D (p.2), approved-sources table with each domain's «قاعدة الاستخدام» (pp.3–4), output standards (p.5), safety test cases (p.6), glossary sample of 10 terms (p.8) | **Verbatim transcription.** Glossary rows are displayed on the knowledge route; usage rules are displayed in pointers; scope and level wording ground the model prompt (Arabic, verbatim); p.6 cases drive tests and the evaluation | `sources.pdf`; `server/content/knowledge/sourcesPdf.ts` | Transcribed from the PDF text layer with RTL-extraction artefacts fixed, checked against page renders; tests assert glossary answers equal the transcription byte-for-byte | Provided to participants with the challenge; reproduced here for the purposes of the challenge. Redistribution beyond that: to be confirmed with the issuer |
| 2 | **«بينات: أسئلة وأجوبة عن الإسلام»** — مركز أصول، 1445هـ; distributed free by the digital da'wah repository (dawa.center/file/7937). Named by the PDF as «مصدرًا أساسيًا للحلول الحوارية في الشبهات» | Index of **263** questions (number, part, section, printed page, PDF page); **69** reviewed verbatim excerpts — the opening complete paragraph(s) of each answer's «مختصر الإجابة» | **Index + verbatim snapshot.** Excerpts shown with question number, printed page and a `#page=` link to the publisher's PDF; index-only questions become pointers to the exact question and page. Domain, level and keywords are the team's metadata, not the book's | `server/content/knowledge/data/bayyinat.index.json`, `bayyinat.answers.json` | Copied from the PDF text layer (glyph-level extraction), not retyped; honorific glyphs transcribed as words; Qur'an verses (set in glyph fonts with no Unicode text) are **never** reproduced; each excerpt is marked `verified` by a curator; tests assert verbatim resolution | Free da'wah publication. Quoted with attribution, question number and page; reuse/redistribution terms **to be confirmed with the publisher (مركز أصول)** |
| 3 | **Qur'an — Quranpedia** (quranpedia.net, API v1), which the PDF lists for «النص القرآني بالرسم والنص المعتمد، مع ترجمات معتمدة» | Mushaf text (mushaf id 1) of each topic's anchor verse(s) and the English translation (Quranpedia translation book 13638, preferred as *Saheeh International*). Quranpedia also serves the tafsir in #5 | **Verbatim snapshot** captured by `npm run snapshot:quran`; each record carries the request URLs, fetch time and a text fingerprint and is replayed through the publish pipeline at cold start (a mismatch drops the record) | `server/content/snapshots/quran.published.json`, `server/content/topicQuranAnchors.ts`, `server/content/connectors/quranpedia.ts`, `server/scripts/snapshotQuran.ts` | Live API evidence (`live_api`) + fingerprint; surah:ayah anchors must match; the PDF rule «أهمية التأكد من موثوقية نقل الآيات» is enforced by never typing verses by hand | Quranpedia API terms and the English translation's copyright (*Saheeh International*): **to be confirmed with the publishers**; attribution shown on every verse |
| 4 | **Hadith — the two Sahihs** in approved editions on **al-Maktaba al-Shamela** (shamela.ws), per the PDF: «الأحاديث الصحيحة من الصحيحين … أو الطبعات المعتمدة لكتب السنة النبوية في المكتبة الشاملة». *Sahih al-Bukhari*, al-Sultaniyya edition (Bulaq 1311 AH) with M. F. ʿAbd al-Bāqī's numbering (shamela.ws/book/1681); *Sahih Muslim*, ed. M. F. ʿAbd al-Bāqī (shamela.ws/book/1727) | One hadith per topic: the matn as printed (Companion → end of matn), with كتاب / باب, hadith number, edition, page URL and the grade «صحيح» (in the Sahihayn) | **Verbatim snapshot.** `server/scripts/snapshotContent.ts` fetches each anchor twice through two different Shamela endpoints and writes it only if both reproduce the identical excerpt; the editor's footnotes (hamesh) are never included; each record stores fetch/verify times, request URLs and a sha256 | `server/content/snapshots/hadith.published.json`, `server/content/topicSourceAnchors.ts`, `server/content/sourceSnapshot*.ts`, `server/content/sourceText.ts` | Two independent fetches must agree; review evidence `source_page`; a hadith without collection, number and grade is not displayable («لا ينسب حديث دون مصدر وحكم معتمد في البيانات») | Classical texts are public domain. Shamela pages are public library pages; a handful of hadith are quoted with page links, no bulk copy. Formal reuse terms of the digital editions: **to be confirmed** |
| 5 | **Tafsir — *Jāmiʿ al-Bayān* of Ibn Jarīr al-Ṭabarī (d. 310 AH)**, a source of the first three centuries (PDF: «أي مصادر إسلامية في القرون الثلاثة الأولى»), ed. Aḥmad Shākir (Muʾassasat al-Risāla, 1420 AH), read through the Quranpedia API (tafsir book 4) | 1–3 verbatim paragraphs explaining each topic's exact anchor verse, cut at sentence boundaries | **Verbatim snapshot** (same script and double-fetch check as #4). Qur'anic words stay inside their brackets so the mufassir's words remain distinct from the verse, as the PDF requires («يستخدم لشرح الآية مع تمييز كلام المفسر عن النص القرآني») | `server/content/snapshots/tafsir.published.json`, `server/content/topicSourceAnchors.ts` | As #4; tafsir records must carry surah, ayah, book, author, volume/pages and a link | Quranpedia API terms: **to be confirmed**; short excerpts with a link back to the tafsir page |
| 6 | **«موسوعة الجمهرة — مفردات المحتوى الإسلامي»** (islamic-content.com) — named by the PDF as a comprehensive reference for da'wah topics and terminology | Verbatim sections of concept entries for «لتتعلّم أكثر»: الصبر (/t/641), الشكر (/t/642), الرجاء (/t/644), التوكل (/t/646), الرضا (/t/650), الإنابة (/t/656), آداب الذكر والدعاء (/t/2366), الأمانة (/t/80974), العزم (/t/81045) — 53 stored parts (definitions, how-to, fruits, types, etiquette…) | **Verbatim snapshot** by `npm run snapshot:lessons` (double fetch, sha256, `npm run verify:lessons`). Shown only when the person asks to learn more, on top of the fixed journey core. **Rule:** a section that quotes hadith is stored only if every cited hadith is in al-Bukhari or Muslim (al-Jamhara states no grades; PDF: «لا ينسب حديث دون مصدر وحكم معتمد في البيانات») | `server/content/snapshots/lessons.published.json`, `server/content/lessons/**`, `server/scripts/snapshotLessons.ts` | Double fetch + sha256; loader re-checks text, anchors and the hadith rule and drops any failing row | Public encyclopedia pages, quoted with entry links; reuse terms **to be confirmed with the publisher** |
| 7 | **الدرر السنية (dorar.net)** — `/hadith`, `/tafseer`, `/aqeeda`, `/feqhia`, `/history` | Names, URLs and the PDF's usage rules | **Pointer only.** Shown when the app abstains or refers in that domain. No Dorar text is fetched, scraped or stored; the hadith API is browser-oriented and its server-side reuse needs licence clarification | `server/content/sourceRegistry.ts`, `server/content/connectors/dorarHadith.ts` (status: `license_clarification_needed`) | n/a (no text displayed) | n/a — linking only |
| 9 | **Seerah — *al-Sīra al-Nabawiyya* of Ibn Hishām** (d. 213/218 AH, within the PDF's «القرون الثلاثة الأولى»), ed. al-Saqqā, al-Abyārī, Shalabī (Muṣṭafā al-Bābī al-Ḥalabī, 2nd ed. 1375/1955), Shamela book 23833; and Seerah narrations inside the two Sahihs (#4) | One verbatim Seerah situation per topic (e.g. the trench, 'Alī returning the trusts, the cave of the Hijra, the day of al-Ṭā'if) | **Verbatim snapshot** by `npm run snapshot:content` (HTML page + page JSON must match byte for byte; footnote markers, poetry and unbalanced quotes fail the item). Ibn Hishām excerpts carry **no** hadith grade | `server/content/snapshots/seerah.published.json`, `server/content/topicSeerahAnchors.ts` | As #4 | Classical text, public domain; digital edition terms **to be confirmed** |
| 8 | **المستودع الدعوي الرقمي** (dawa.center) | Name and URL for the da'wah domain; host of *Bayyinat* | **Pointer only** (plus #2) | `sourcesPdf.ts` | n/a | Linking only |

**Source registry (allowlist).** Every displayable record must reference an `approved` entry in
`server/content/sourceRegistry.ts`, and its content type must be allowed for that source; anything else is not shown
(fail closed). See [CONTENT-GOVERNANCE.md](CONTENT-GOVERNANCE.md).

**Topic coverage** — which topics currently have published Qur'an / explanation / hadith / story items — is tracked
in the *Topic coverage* table of the [README](../README.md#topic-coverage).

---

## (b) AI services | خدمات الذكاء الاصطناعي

| Service | How it is used | Models | Data sent | Data kept by Tamaninah |
|---|---|---|---|---|
| **Google Gemini API** via its OpenAI-compatible endpoint (`https://generativelanguage.googleapis.com/v1beta/openai`, Chat Completions, JSON mode) | Understanding and routing only: neutral reading, level A–D, intent, domain, ids picked from server-sent lists. Never authors religious text | Ordered fallback list in `AI_MODEL`; deployed with `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-flash-lite-latest` (alias); `reasoning_effort=low` | From the user: **the message only** (≤ 2000 chars). From the app: the router system prompt (incl. the PDF's scope and levels), the list of ready topics, and up to 12 candidate glossary terms / Bayyinat question titles | Nothing. Function logs record stage, outcome, HTTP status and latency only |

Google's terms differ by tier: on the **unpaid** tier Google may use submitted content and responses to improve its
products, and human reviewers may read them; on **paid** (billing-enabled) services prompts are not used for product
improvement and are logged for a limited period for abuse monitoring only (Gemini API Additional Terms, checked
2026-10-05). A paid key is recommended for real deployments. The provider is swappable: any OpenAI-compatible endpoint
works through `AI_BASE_URL` / `AI_MODEL`.

AI tools used to **build** the project (not part of the running product): the interface was designed in Claude Design;
development used AI coding assistants under human review.

---

## (c) Software dependencies | المكتبات البرمجية

Direct dependencies as installed (`node_modules/<name>/package.json`, 2026-10-05). Transitive dependencies are listed
in `package-lock.json`.

### Runtime (shipped to the browser)

| Package | Range | Installed | License |
|---|---|---|---|
| `react` | ^19.1.1 | 19.3.0 | MIT |
| `react-dom` | ^19.1.1 | 19.3.0 | MIT |
| `@phosphor-icons/react` | ^2.1.10 | 2.1.10 | MIT |
| `gsap` | ^3.15.0 | 3.15.0 | GSAP Standard "no charge" license (gsap.com/standard-license) — free to use, not an OSI license |
| `lenis` | ^1.3.26 | 1.3.26 | MIT |

### Development, build and test

| Package | Range | Installed | License |
|---|---|---|---|
| `@netlify/functions` | ^6.0.2 | 6.0.2 | MIT |
| `@playwright/test` | ^1.63.0 | 1.63.0 | Apache-2.0 |
| `@testing-library/jest-dom` | ^6.8.0 | 6.9.1 | MIT |
| `@testing-library/react` | ^16.3.0 | 16.3.3 | MIT |
| `@testing-library/user-event` | ^14.6.1 | 14.6.7 | MIT |
| `@types/node` | ^22.20.5 | 22.20.5 | MIT |
| `@types/react` | ^19.1.12 | 19.3.0 | MIT |
| `@types/react-dom` | ^19.1.9 | 19.3.0 | MIT |
| `@vitejs/plugin-react` | ^5.0.2 | 5.2.0 | MIT |
| `cross-env` | ^10.1.0 | 10.1.0 | MIT |
| `jsdom` | ^26.1.0 | 26.1.0 | MIT |
| `typescript` | ^5.9.2 | 5.9.3 | Apache-2.0 |
| `vite` | ^7.1.5 | 7.3.6 | MIT |
| `vite-node` | ^3.2.4 | 3.2.4 | MIT |
| `vitest` | ^3.2.4 | 3.2.7 | MIT |

Regenerate this table with:

```bash
node -e 'const p=require("./package.json");for(const d of [p.dependencies,p.devDependencies])for(const n in d){const m=require("./node_modules/"+n+"/package.json");console.log(n,d[n],m.version,m.license)}'
```

### Platform

| Service | Use | Terms |
|---|---|---|
| Netlify | Static hosting + one serverless function (`/api/understand`) | Netlify terms of use; see [OPERATIONS.md](OPERATIONS.md) for limits and cost |
| Node.js 22 | Build and function runtime | MIT |

---

## (d) Fonts and icons | الخطوط والأيقونات

| Asset | Use | Delivered by | License |
|---|---|---|---|
| IBM Plex Sans Arabic | Arabic interface text | Google Fonts | SIL Open Font License 1.1 |
| Noto Naskh Arabic | Arabic display / source texts | Google Fonts | SIL Open Font License 1.1 |
| Source Sans 3 | Latin interface text | Google Fonts | SIL Open Font License 1.1 |
| Source Serif 4 | Latin display text | Google Fonts | SIL Open Font License 1.1 |
| Phosphor Icons (`@phosphor-icons/react`) | Interface icons | npm bundle | MIT |

Fonts are requested from `fonts.googleapis.com` / `fonts.gstatic.com` at page load (allowed by the CSP in
`netlify.toml`).

---

## (e) Design | التصميم

The interface was designed in **Claude Design** and implemented by the team. Visual direction and constraints are in
`PRODUCT.md`; the design system notes live in `design-system/`. No third-party illustrations or photographs are used.

---

## (f) Data | البيانات

- **Only synthetic test data.** All test messages (unit tests, end-to-end fixtures, the evaluation set) were written
  by the team or taken from the PDF's own p.6 test cases. No real user conversations are collected, used or stored.
- **No user data is retained** by the application: no accounts, database, cookies or analytics; logs hold outcome and
  latency only.
- Generated evaluation outputs (`docs/evaluation-results.json`) contain only the synthetic test messages, routes, ids,
  the model's classification fields, HTTP status codes and timings — no keys and no personal data.
