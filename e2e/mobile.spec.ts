/**
 * Main flow on phone viewports (390×844 and 360×740, touch): no horizontal scroll anywhere,
 * and every button in the experience is at least 44×44 CSS px.
 */
import type { Page } from "@playwright/test";
import { R, T, pointer } from "./fixtures/understand";
import {
  expect,
  expectNoHorizontalScroll,
  experience,
  focusTarget,
  openApp,
  sendButton,
  stubUnderstand,
  test,
  textarea,
} from "./support/app";
import { chips, t } from "./support/copy";

const MIN = 44;

/** Visible buttons (and button-like links) in the experience smaller than 44×44. */
async function smallTargets(page: Page) {
  return experience(page).evaluate((root, min) => {
    const out: string[] = [];
    for (const el of root.querySelectorAll<HTMLElement>("button, a.btn-primary, a.chip, a.src-chip, .src-link--open")) {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue; // not rendered
      if (r.width < min - 0.5 || r.height < min - 0.5) {
        out.push(`${el.tagName.toLowerCase()}.${el.className} "${el.textContent?.trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    }
    return out;
  }, MIN);
}

test.slow();

async function checkLayout(page: Page, where: string) {
  await expectNoHorizontalScroll(page, where);
  expect(await smallTargets(page), `tap targets < ${MIN}px at ${where}`).toEqual([]);
}

test("main flow fits the phone: compose → topics → the staged journey → back to the composer", async ({ page }) => {
  const calls = await stubUnderstand(page, R.topics(), R.journey({ related_topics: [] }));
  await openApp(page);
  await expectNoHorizontalScroll(page, "landing");

  // Scroll through every section once (mobile scenes play on enter) and check overflow on the way.
  for (const id of ["human", "journey", "story", "trust", "experience", "begin"]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await expectNoHorizontalScroll(page, `#${id}`);
  }

  const ta = textarea(page);
  await ta.scrollIntoViewIfNeeded();
  await ta.tap();
  await ta.fill("رسالة تجريبية من الجوال");
  await experience(page).getByRole("button", { name: chips[1][0] }).tap();
  await checkLayout(page, "composer");
  await sendButton(page).tap();

  await expect(focusTarget(page, "topics")).toBeFocused();
  await checkLayout(page, "topics");
  await experience(page).getByRole("button", { name: T.topicPatience }).tap();

  const exp = experience(page);
  await expect(exp.locator('[data-stage="verse"]')).toBeVisible();
  await expect(focusTarget(page, "result")).toBeFocused();
  await checkLayout(page, "result");
  // Walk the stages with «تابع», opening both full texts — the widest content on the page.
  for (const k of ["verse", "tafsir", "hadith", "seerah", "connect"]) {
    const st = exp.locator(`[data-stage="${k}"]`);
    if (k === "tafsir") await st.getByRole("button", { name: t.showFullTafsir }).tap();
    if (k === "hadith") await st.getByRole("button", { name: t.showFullHadith }).tap();
    await st.getByRole("button", { name: t.continueLabel }).tap();
    await checkLayout(page, `after ${k}`);
  }
  // The Seerah scene is wider than the column but never wider than the screen.
  const seerah = await exp.locator(".seerah").boundingBox();
  const vw = await page.evaluate(() => document.documentElement.clientWidth);
  expect(seerah!.x).toBeGreaterThanOrEqual(0);
  expect(seerah!.x + seerah!.width).toBeLessThanOrEqual(vw);

  const box = exp.locator('[data-stage="dua"]').getByRole("textbox", { name: t.duaTitle });
  await box.tap();
  await box.fill("دعاء تجريبي من الجوال");
  await checkLayout(page, "du‘a");
  await exp.getByRole("button", { name: t.endJourney }).tap();
  await expect(textarea(page)).toBeFocused();
  await checkLayout(page, "back to the composer");
  expect(calls.map((c) => c.stage)).toEqual(["analyze", "journey"]);
});

test("referral, insufficient and error screens fit the phone", async ({ page }) => {
  await stubUnderstand(page, R.selfHarm(), R.levelD(), R.insufficient(), R.upstream());
  await openApp(page);
  const exp = experience(page);
  for (const step of ["referral", "referral", "insufficient", "error"]) {
    if (await exp.getByRole("button", { name: t.edit }).count()) await exp.getByRole("button", { name: t.edit }).tap();
    const ta = textarea(page);
    await ta.scrollIntoViewIfNeeded();
    await ta.fill("رسالة تجريبية");
    await sendButton(page).tap();
    await expect(focusTarget(page, step)).toBeFocused();
    await checkLayout(page, step);
  }
});

test("long unbroken words (a pasted URL, a long source name) do not widen the page", async ({ page }) => {
  const long = `https://example.org/${"a".repeat(180)}`;
  await stubUnderstand(page, {
    status: 422,
    body: {
      ok: false,
      error: "insufficient_reference",
      pointer: { ...pointer(), label_ar: "ب".repeat(120), sources: [{ name: "ق".repeat(150), url: long }] },
    },
  });
  await openApp(page);
  const ta = textarea(page);
  await ta.scrollIntoViewIfNeeded();
  await ta.fill(long);
  await expectNoHorizontalScroll(page, "composer with a long URL");
  await sendButton(page).tap();
  await expect(focusTarget(page, "insufficient")).toBeFocused();
  await checkLayout(page, "insufficient with long words");
});

test("English (ltr) composer and result fit the phone", async ({ page }) => {
  await stubUnderstand(page, R.topics(), R.journey());
  await openApp(page);
  await page.getByRole("button", { name: t.langLabel }).tap();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expectNoHorizontalScroll(page, "landing en");
  const ta = textarea(page);
  await ta.scrollIntoViewIfNeeded();
  await ta.fill("A test message from a phone");
  await checkLayout(page, "composer en");
  await sendButton(page).tap();
  await experience(page).locator(".topic").first().tap();
  await expect(experience(page).locator(".verse-en")).toBeVisible();
  await checkLayout(page, "result en");
});
