# التشغيل والاستدامة | Operations & Sustainability

What it takes to keep Tamaninah running after the challenge: architecture, cost, critical dependencies and their
fallbacks, monitoring, maintenance and who does what.

> **All prices and limits below are estimates**, read from the providers' public pricing pages on **2026-10-05**
> (Gemini API pricing page last updated 2026-10-01). They change; check the linked pages before budgeting. Usage
> figures come from our own measurements (evaluation run of 2026-10-05 and a token probe on the production prompts).

<div dir="rtl">

**الخلاصة:** موقع ثابت ودالة واحدة على Netlify، والمحتوى كله داخل الحزمة بلا أي اتصال شبكي وقت التشغيل. التكلفة
المتغيرة الوحيدة هي استدعاء نموذج Gemini مرة واحدة لكل رسالة (≈ 0.002 دولار بالسعر المدفوع)، ويمكن التشغيل التجريبي على
الخطط المجانية. إذا تعطّل النموذج تبقى الحواجز الحتمية تعمل وتعرض الواجهة إعادة المحاولة بهدوء، ولا يُخترع أي جواب.

</div>

---

## 1. Architecture on Netlify

| Part | What | Notes |
|---|---|---|
| Static site | `dist/` from `npm run build` (one HTML shell, one JS bundle ≈ 152 KB gzip, one CSS file ≈ 5 KB gzip) | Hashed assets cached for a year; HTML always revalidated |
| One function | `netlify/functions/understand.mts` at `/api/understand` | Synchronous function (60 s platform limit); analyze stage deadline 18 s; journey stage never calls the model |
| Content | Bundled into the function as JSON/TS modules | PDF transcription, Bayyinat index + excerpts, published catalog, Qur'an snapshot — **zero network for content** |
| Secrets | `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_REASONING_EFFORT` | Netlify environment variables, scope *Functions*; never in the repo |
| External calls at runtime | Gemini API (analyze stage only); Google Fonts (from the browser) | Nothing else |

**Cold start.** ≈ 90 ms for the function to initialise — module load plus the Qur'an snapshot replay through the
publish gates (team measurement). No network is needed to load content, so a cold start never waits on a content source.

**Request budget.** Browser timeout 25 s → function limit 60 s → analyze deadline 18 s shared by every model attempt
(fallbacks, hedged request, one JSON repair). Measured model latency (90 live calls): p50 1.53 s, p90 2.26 s, max 6.58 s.

## 2. Cost estimate

### 2.1 Model (Gemini API)

One model call per analyze request (the journey stage costs nothing). Measured on the production prompts
(2026-10-05): **≈1.9–2.5 k input tokens** (system prompt with the PDF's scope and levels, ready topics, up to 12
candidate titles, the message) and **≈90–290 output tokens** (a small JSON object, including low-effort reasoning).

```text
cost_per_analyze = (input_tokens × input_price + output_tokens × output_price) / 1,000,000 × overhead
                   overhead ≈ 1.2  (hedged backup requests, rare JSON repair)
monthly_model_cost = sessions_per_month × analyze_calls_per_session × cost_per_analyze
```

| Model (paid tier) | Input / 1M | Output / 1M | Conservative cost per analyze (2,500 in, 300 out, ×1.2) | per 1,000 sessions | per 100,000 sessions |
|---|---|---|---|---|---|
| `gemini-3.5-flash-lite` (primary) | $0.30 | $2.50 | ≈ $0.0018 | ≈ $1.80 | ≈ $180 |
| `gemini-3.1-flash-lite` (fallback) | $0.25 | $1.50 | ≈ $0.0013 | ≈ $1.30 | ≈ $130 |

Assumes one analyze call per session; a person who rewrites their message three times costs three calls.

**Free tier.** Both Flash-Lite models are listed as *free of charge* on the free tier, with per-model rate limits
shown only in Google AI Studio. The free tier is fine for development, demos and judging, but (a) quota exhaustion
returns HTTP 429 — the app falls back to the next model and then shows a calm retry — and (b) under Google's terms
unpaid-tier inputs may be used to improve Google products and read by human reviewers. **For a real deployment,
enable billing** (paid-tier prompts are not used for product improvement). Sources:
[pricing](https://ai.google.dev/gemini-api/docs/pricing) · [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) ·
[terms](https://ai.google.dev/gemini-api/terms).

### 2.2 Hosting (Netlify)

Netlify's current plans are credit-based: **Free 300 credits/month**, **Personal $9/month for 1,000 credits**,
**Pro $20/month for 3,000 credits**. Consumption: production deploy **15 credits** each · compute **10 credits per
GB-hour** · bandwidth **20 credits per GB** · web requests **2 credits per 10k requests**
([netlify.com/pricing](https://www.netlify.com/pricing/)).

```text
per session ≈ bandwidth  0.17 MB  → 0.17/1024 GB × 20      ≈ 0.0033 credits   (first visit, gzip; fonts come from Google)
            + requests   ~6       → 6/10,000 × 2           ≈ 0.0012 credits   (HTML, JS, CSS, 1–2 API calls)
            + compute    1 GB × 2.5 s (analyze) + 0.1 s (journey)
                                  → 2.6/3600 GB-h × 10     ≈ 0.0072 credits   (assumes 1 GB function memory)
            ≈ 0.012 credits per session
monthly credits ≈ 15 × production_deploys + 0.012 × sessions
```

| Plan | Credits | Example: 4 production deploys / month | Sessions that fit (estimate) |
|---|---|---|---|
| Free | 300 | 60 credits for deploys | ≈ 20,000 / month |
| Personal ($9) | 1,000 | 60 | ≈ 78,000 / month |
| Pro ($20) | 3,000 | 60 | ≈ 245,000 / month |

Repeat visitors cost less (cached assets). Frequent production deploys are the largest fixed cost on the free plan —
use deploy previews for iteration. The pricing page does not say what happens when free credits run out; watch the
usage dashboard and upgrade before the limit.

### 2.3 Total, three scenarios (estimates)

| Scenario | Sessions / month | Netlify | Gemini | Total |
|---|---|---|---|---|
| Pilot / judging | ≤ 5,000 | Free plan | Free tier (or ≈ $9 paid) | **$0–9** |
| Small public launch | 20,000 | Free → Personal ($9) | ≈ $36 (paid) | **≈ $45** |
| Growth | 100,000 | Pro ($20) | ≈ $180 (paid) | **≈ $200** |

People time (content review) is the real cost — see §6.

## 3. Critical dependencies and fallbacks

| Dependency | Needed for | If it fails | Fallback / mitigation |
|---|---|---|---|
| **Gemini API** | Understanding and routing (analyze stage) | Model retired (404), busy or over quota (429/503), slow | Ordered model list in `AI_MODEL` with immediate fallback on 404/429/5xx, hedged backup after 2.5 s, retired models skipped for 10 min, one shared 18 s deadline. If all fail: `timeout` / `upstream` → calm retry screen. **Deterministic guards (self-harm, Level D, explicit Level C, out-of-scope, empty input) keep working with no model.** Provider is swappable without code changes: any OpenAI-compatible endpoint via `AI_BASE_URL` + `AI_MODEL` |
| **Gemini API key** | All model calls | Revoked, leaked, billing issue (401/403) | 401/403 stops immediately (no retries burning quota) → retry screen; rotate the key (§5) |
| **Netlify** | Hosting + function | Outage, plan limits | Static `dist/` runs on any static host; `server/http/understand.ts` is framework-agnostic (web `Request` → `Response`), so the same handler runs on any platform with web-standard functions, or on Node via `npm run preview` |
| **Content sources** (Quranpedia, al-Maktaba al-Shamela, dawa.center, al-Jamhara) | Only when **refreshing** snapshots | API change, site down | **None at runtime** — all content is bundled. Snapshot scripts write nothing unless every item succeeds; stored snapshots stay valid |
| **Dorar.net** | Pointer links only | Link changes | Pointers are static links from the PDF; fix the URL in `sourcesPdf.ts` if a path moves |
| **Google Fonts** | Typography | Blocked or down | CSS falls back to `system-ui` / `sans-serif` / Georgia; the app stays usable |
| **Node.js 22** | Build and function runtime | End of life **2027-04-30** | Move to the next LTS before that date |

## 4. Monitoring

The function logs **only** outcome and latency — never the user's text:

```text
[understand] stage=analyze outcome=knowledge_qa status=200 latency_ms=1532
[guidance]   outcome=level_d latency_ms=1
[content]    quran snapshot rejected 1 record(s): quran-…:TEXT_FINGERPRINT_MISMATCH     ← cold start only, should never appear
```

| Watch | Where | Act when |
|---|---|---|
| Share of `timeout` / `upstream` outcomes | Netlify → Logs → Functions (`understand`) | > 2 % of analyze requests over a day → check AI Studio quota, model availability, `AI_MODEL` order |
| p90 `latency_ms` for analyze | Function logs | > 5 s sustained → the primary model is slow; reorder or lower `AI_HEDGE_AFTER_MS` |
| `rate` (429 from our own limiter) | Function logs | Spikes → abuse; enable Netlify's platform rate limiting / firewall rules |
| `[content] … rejected` | Function logs at cold start | Any occurrence → a snapshot was edited by hand or corrupted; restore from git |
| Gemini usage and quota | Google AI Studio | Approaching the tier limit |
| Netlify credits | Netlify usage dashboard | 80 % of the monthly allowance |
| Behaviour drift | `npm run eval` (live) and `npm run e2e:live` | Pass rate or consistency drops vs. `docs/EVALUATION.md` |

## 5. Maintenance plan

| Cadence | Task | How |
|---|---|---|
| Every content change | Human review checklist, second reviewer, tests, live evaluation | [CONTENT-GOVERNANCE.md §7](CONTENT-GOVERNANCE.md#7-human-review-checklist--adding-a-new-item); `npm test`; `npm run eval` |
| Weekly (while live) | Read function-log outcomes and latency; check quota / credits | §4 |
| Monthly | Content spot check: sample displayed items and compare with their sources; check that source links still resolve; triage reported issues | Content reviewer |
| Monthly | Model list review: check Gemini model deprecations; update `AI_MODEL` (an env change + redeploy, no code change); re-run `npm run eval` | Engineer |
| Quarterly | Snapshot check and refresh: `npx vite-node server/scripts/snapshotContent.ts --verify` (hadith + tafsir) and `npm run snapshot:quran`; review any diff — changed text goes through review again | Engineer + content reviewer |
| Every 90 days, or at once on suspicion | Rotate `AI_API_KEY`: create a new key in AI Studio → `netlify env:set AI_API_KEY … --scope functions` → redeploy → delete the old key | Engineer |
| Monthly | Dependency updates and `npm audit`; rebuild and run all tests | Engineer |
| On a reported content error | Unpublish first (status ≠ `published` hides the item on the next deploy), then correct, re-review and republish | Content reviewer |

## 6. Responsibilities

A small team can run this. Minimum roles (one person may hold two, except the two reviewer roles):

| Role | Responsibilities |
|---|---|
| **Product / technical lead** | Deploys, environment variables and keys, model list, monitoring, budget |
| **Content lead (reviewer with Islamic-studies training)** | Approves every religious item and its level (A–D), owns the source register and the governance rules, answers content reports |
| **Second content reviewer** | Independent re-check of text and reference before merge |
| **Engineer** | Snapshot refreshes, dependency updates, tests and evaluation runs, incident fixes |

Estimated effort after launch: ~2–4 hours / week for monitoring and triage, plus reviewer time proportional to new
content (≈ 10–20 minutes per new item including the second check).

## 7. Adoption path

1. **Pilot** on the free tiers with the current verified set; collect feedback through a simple contact channel (no
   conversation logging).
2. **Expand content** topic by topic through the review pipeline; each new ready topic is announced only after
   `npm run eval` passes.
3. **Partner review**: invite a recognised Islamic institution to review the content set and the levels policy.
4. **Paid AI tier** before any public launch (privacy), with a monthly budget alert.
