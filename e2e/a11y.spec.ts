/**
 * Accessibility smoke without axe (package.json is frozen for this suite): accessible names,
 * decorative graphics hidden from AT, focus management, heading structure. For a full rule set
 * add `@axe-core/playwright` as a devDependency and run AxeBuilder over the same states.
 */
import type { Page } from "@playwright/test";
import { R, glossary, pointer, qa } from "./fixtures/understand";
import { ask, expect, experience, openApp, stubUnderstand, test } from "./support/app";
import { t } from "./support/copy";

/** Buttons and links exposed to assistive tech without a name (from the ARIA snapshot). */
async function unnamedControls(page: Page) {
  const snap = await page.locator("body").ariaSnapshot();
  return snap
    .split("\n")
    .filter((l) => /^\s*- (button|link|textbox|dialog|checkbox)(?:\s*\[[^\]]*\])?:?\s*$/.test(l))
    .map((l) => l.trim());
}

/** Graphics that are exposed to assistive tech without being explicitly meaningful. */
async function exposedGraphics(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("svg, img, canvas")]
      .filter((el) => !el.closest('[aria-hidden="true"]'))
      .filter((el) => {
        if (el instanceof HTMLImageElement) return !el.hasAttribute("alt");
        const role = el.getAttribute("role");
        const named = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
        return !(role === "img" && named);
      })
      .map((el) => el.outerHTML.slice(0, 120)),
  );
}

async function expectAccessible(page: Page, where: string) {
  expect(await unnamedControls(page), `unnamed controls (${where})`).toEqual([]);
  expect(await exposedGraphics(page), `graphics not hidden from AT (${where})`).toEqual([]);
  // Every button in the DOM has a non-empty accessible text (covers ones the snapshot hides).
  const blank = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => !(b.getAttribute("aria-label") || b.textContent || "").trim())
      .map((b) => b.outerHTML.slice(0, 120)),
  );
  expect(blank, `buttons without text (${where})`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test("landing: names, decorative graphics, one h1, headings in order", async ({ page }) => {
  await expectAccessible(page, "landing");
  const levels = await page.evaluate(() =>
    [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((h) => Number(h.tagName[1])),
  );
  expect(levels.filter((l) => l === 1)).toHaveLength(1);
  // No skipped heading levels going down (h1 → h3 without an h2, etc.).
  levels.reduce((prev, l) => {
    expect(l - prev, `heading jump h${prev} → h${l}`).toBeLessThanOrEqual(1);
    return l;
  }, 0);
});

test("English landing: names still present", async ({ page }) => {
  await page.getByRole("button", { name: t.langLabel }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expectAccessible(page, "landing en");
});

test("every experience state: names, hidden decoration, focus on the new state", async ({ page }) => {
  test.slow();
  const exp = experience(page);
  await stubUnderstand(
    page,
    R.topics(),
    R.journey(),
    R.knowledge(glossary()),
    R.knowledge(qa()),
    R.selfHarm(),
    R.levelD(),
    R.insufficient(),
    R.unclear(),
    R.upstream(),
  );
  const edit = () => exp.getByRole("button", { name: t.edit }).click();

  await ask(page, "نص تجريبي");
  await expect(exp.locator('[data-focus="topics"]')).toBeFocused();
  await expectAccessible(page, "topics");

  await exp.locator(".topic").first().click();
  await expect(exp.locator('[data-focus="result"]')).toBeFocused();
  await expectAccessible(page, "result");

  const states: [string, string][] = [
    ["knowledge", "glossary"],
    ["knowledge", "qa"],
    ["referral", "self_harm"],
    ["referral", "level_d"],
    ["insufficient", "insufficient"],
    ["unclear", "unclear"],
    ["error", "error"],
  ];
  for (const [step, label] of states) {
    await edit();
    await ask(page, "نص تجريبي");
    const target = exp.locator(`[data-focus="${step}"]`);
    await expect(target, label).toBeFocused();
    await expect(target).toBeInViewport();
    await expectAccessible(page, label);
  }
});

test("external links announce that they open a new tab", async ({ page }) => {
  await stubUnderstand(page, R.levelD());
  await ask(page, "نص تجريبي");
  const links = experience(page).locator('a[target="_blank"]');
  await expect(links).toHaveCount(pointer().sources.length);
  for (const link of await links.all()) {
    await expect(link.locator(".sr-only")).toHaveText(t.newTab);
    await expect(link).toHaveAttribute("rel", /noopener/);
  }
});
