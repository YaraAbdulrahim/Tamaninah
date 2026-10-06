# Experience — page override

**Authority:** `docs/EXPERIENCE.md` (voice) → `docs/PRD.md` (principles).
Route: `/experience`. Visual language: the shared dawn surface.

Free text is the path. Shortcuts only fill the field. Analysis is a real AI
behind `/api/understand`, never keyword matching.

---

## What is built

| Step | Screen | Behaviour |
|---|---|---|
| start | وش اللي مثقل قلبك اليوم؟ | Large quiet textarea. Optional chips. CTA: أحتاج طمأنينة |
| processing | خلني أفهم اللي تمر فيه… | Staged waiting while the server analyses |
| understanding | أفهم ليه هذا الشعور ثقيل عليك | Their words, then a probable reading, then تذكّر |
| meaning | خلنا نذكّر قلبك بشيء مهم | Verified verse from the catalog, with its source |
| story | a Seerah story | Verified narrative chosen for this moment |
| action | خلنا نسوي شيء بسيط الآن | One small doable step |
| error / unclear | تعثر or ما قدرت أفهم | Retry or write more — never an invented fill |
| safety | واضح إن اللي تمر فيه ثقيل جدًا | Interrupts any step. No fatwa, diagnosis, or therapy |

---

## Rules this screen holds

**The reading is about the feeling, never about facts.** It never states anything the person did not
say, never names a value or a category, and never shows a verdict.

**Personalisation and scripture are separate.** The model writes the human reading. Qur’an, hadith,
and Seerah come only from the verified catalog, by ID, with المصدر beside them. Verse in Naskh,
`lang="ar"` `dir="rtl"` even in the English interface.

**The key never ships.** `/api/understand` runs on the Vite server. Danger is decided locally first
so those words need not leave the device. Invalid JSON, scripture in the model's prose, or a missing
catalog match become an error or unclear state — not a canned keyword reply.

**Safety comes before flow.** The safety screen is `role="alert"`, stays warm, points to a human
being, and offers no continue-as-normal path.

**Never a chat UI.** No bubbles, no avatars, no typing dots, no thread list.

## Motion

None of the Home's cinema. A single quiet pulse while the companion is listening. Focus lands at
the top of each new step.
