# Home / Landing — page override

**Authority:** `docs/EXPERIENCE.md` (voice + content) → `docs/PRD.md` (principles) + the art direction locked below. Flow: `UX-STRUCTURE.md` §3

**The Home is the door. The experience is the product.**

`Visual → Emotion → Curiosity → Start`. Seconds, not reading. The person must arrive at:

> **What is Tuma'nina? Why is it different? Can I start from what I'm going through?**

---

## Art direction — دَرْب النور

One continuous bright environment, travelled from **dawn to full day**. Every section is a station on the same **ribbon of light** that runs over slow silk gradients. Not dark, not architectural, no doors, no thresholds, no mosque, no ornament, no AI cliché.

**Climate:** warm ivory, sage, deep olive. No rainbow, no glass.  
**Mood:** joyful, airy, premium, calm, emotional, with real depth.  
**Type:** Readex Pro, one modern family for Arabic and Latin — no serif manuscript voice on the Home.  
**Language:** Arabic RTL default, English parallel. Warm everyday Arabic, except the challenge band which stays MSA.

**Forbidden:** editorial chapters · numbered sections · card grids · dashboards · Islamic values as labels · Patience / Justice / Forgiveness / Hope / Trust as categories · detected values · topic lists · RAG or architecture explanation · long disclaimers · repeating one idea across sections.

---

## Scenes

### 01 Hero — full viewport

طمأنينة → H1 **مو كل ضيق نهاية… أحيانًا هو بداية طمأنينة.** → مساحة تفهم شعورك وتذكّرك بلطف أن ما تمر به سيمضي وأن في الصبر أجرًا وفي القرب من الله سكينة. → **أحتاج طمأنينة** → `/experience` · secondary **استكشف طمأنينة** → `#journey`, never a dead end.

Living sky: soft luminous orbs on CSS 3D layers answering the pointer, a ribbon of light rising from the bottom and drawing itself on entry, a quiet scroll cue. No input field.

### 02 البداية من الإنسان — pinned, scrubbed

**ما تحتاج تختار الكلمات الصح.** The sentence *"تعبت من كل شيء… أحس إني أحاول وما يتغير شيء."* arrives word by word in the person's own everyday voice, then the ribbon threads through it and continues. Closing line: تحكي اللي بخاطرك، وطمأنينة تبدأ من كلامك.

The thread **is** the understanding. No analysis, no labels, no classification shown.

### 03 الرحلة — one rail, five lit stations

تحكي → نفهمك → نطمّن قلبك → قصة تشبهك → خطوة بسيطة, one line each, lighting up in order as the person travels. One curved luminous rail, never cards or a grid. These are the Home-sized reading of the product spine in `docs/EXPERIENCE.md`.

### 04 Story Gateway — pinned, scrubbed, the climax

The ribbon gathers into a circle of light that blooms open and leaves **قصة من السيرة** standing in it. **وقصة تشبه شعورك.** → القصة ما تجي من قائمة تختار منها… تجي من اللي حكيته أنت. → **أحتاج طمأنينة**

One story, never a chooser. The bloom is the seam that later hands off into the story itself.

### 05 الثقة — small

**كل كلمة لها مصدر.** → طمأنينة ما تنشئ النص الشرعي من نفسها. كل نص شرعي مربوط بمصدره، والمصدر واضح لك. One gesture only: a text and its source joined by a thread that draws itself.

Scripture is **not** rendered on the Home as decoration; the Home shows the *shape* of sourcing, and the verse itself appears inside the journey where it is earned.

### 06 التحدي — named with dignity

AI CHALLENGE · **الذكاء الاصطناعي في خدمة المحتوى الإسلامي** · طمأنينة · تجربة تبدأ من الإنسان وتفتح له طريقًا نحو المعرفة الإسلامية الموثوقة. · Global AI Challenge in Service of Islamic Content — 2026

Part of the identity, never an official announcement.

### 07 النهاية — the arrival

The brightest point of the page. **ابدأ من حيث أنت.** → ما تحتاج سؤال مثالي، ولا تحتاج ترتب كلامك. **ابدأ باللي مثقل قلبك.** → **أحتاج طمأنينة**

### Footer

طمأنينة · مو كل ضيق نهاية… أحيانًا هو بداية طمأنينة. · AI Challenge in Service of Islamic Content · © 2026  
Links: عن المنصة · المصادر · الخصوصية · الشروط · تواصل

---

## Motion contract

| Technique | Where |
|---|---|
| GSAP ScrollTrigger, scrubbed | ribbon drawing, aurora warming, the bloom, the arrival |
| GSAP pin | **02 and 04 only**, desktop only, never more |
| CSS 3D | hero orbs, pointer parallax |
| SVG | ribbon, journey rail, bloom ring, source thread |
| IntersectionObserver reveals | trust and challenge |

**Ceilings:** two pins maximum · no scroll hijacking, the scrollbar stays in control · no ScrollSmoother · no Three.js · nothing loops in the foreground · pins disabled below 900px.

**Scene motion is decoration.** Text is real DOM from first paint and stays readable if motion never runs. Under `prefers-reduced-motion`, or wherever layout cannot be measured, every scene renders in its final state.

---

## Desired feeling

> "وش هذا؟" → "فكرته مختلفة." → "أقدر أبدأ بشيء أنا أمر فيه." → **أحتاج طمأنينة**
