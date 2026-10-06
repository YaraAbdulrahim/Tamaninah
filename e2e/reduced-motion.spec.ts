/**
 * prefers-reduced-motion: no smooth scroller, no pinned scenes, everything in its final state.
 * (states.spec.ts and landing.spec.ts also run in this project.)
 */
import { R } from "./fixtures/understand";
import { ask, expect, experience, focusTarget, openApp, stubUnderstand, test, textarea } from "./support/app";
import { t } from "./support/copy";

test("reduced motion: static page, no Lenis, no pin spacers, content at full opacity", async ({ page }) => {
  await openApp(page);
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  // Lenis marks <html class="lenis"> when it runs; ScrollTrigger pins add .pin-spacer wrappers.
  await expect(page.locator("html")).not.toHaveClass(/\blenis\b/);
  await expect(page.locator(".pin-spacer")).toHaveCount(0);

  // Scene text that motion would fade in is already at its final state.
  const opacities = await page.evaluate(() =>
    [
      '[data-a="h"]',
      '[data-a="s2-lead"]',
      '[data-a="ph"]',
      '[data-a="s2-close"]',
      '[data-a="s4-text"]',
      '[data-a="s4-item"]',
      '[data-a="rv"]',
      '[data-a="c"]',
    ].flatMap((sel) => [...document.querySelectorAll(sel)].map((el) => [sel, getComputedStyle(el).opacity] as const)),
  );
  for (const [sel, o] of opacities) expect(o, sel).toBe("1");
  // The gateway's final state: its scattered lights have already gathered into the circle.
  const lights = await page.evaluate(() => [...document.querySelectorAll(".gl")].map((el) => getComputedStyle(el).opacity));
  expect(new Set(lights)).toEqual(new Set(["0"]));

  // Signature moments: no typing, no caret, every split word and node already lit, the closing's lights
  // already converged into the dawn, nothing breathing or travelling.
  const still = await page.evaluate(() => ({
    typing: [...document.querySelectorAll("h1 .tw__real")].map((el) => getComputedStyle(el).animationName),
    caret: [...document.querySelectorAll("h1 .tw")].map((el) => getComputedStyle(el, "::before").content),
    words: [...document.querySelectorAll(".w__i, .w__node, .tag, .cnode__t, .cnode__dot")].map((el) => getComputedStyle(el).opacity),
    closingLights: [...document.querySelectorAll(".cl")].map((el) => getComputedStyle(el).opacity),
    border: getComputedStyle(document.querySelector(".composer")!, "::before").animationName,
  }));
  expect(new Set(still.typing)).toEqual(new Set(["none"]));
  expect(new Set(still.caret)).toEqual(new Set(["none"]));
  expect(new Set(still.words)).toEqual(new Set(["1"]));
  expect(new Set(still.closingLights)).toEqual(new Set(["0"]));
  expect(still.border).toBe("none");

  // Native, instant scroll + focus from the hero CTA.
  await page.locator(".hero").getByRole("button", { name: t.heroCta }).click();
  await expect(textarea(page)).toBeFocused();
  await expect(textarea(page)).toBeInViewport();
});

test("reduced motion: a state change lands focused and in view without animation", async ({ page }) => {
  await stubUnderstand(page, R.topics(), R.journey());
  await openApp(page);
  await ask(page, "نص تجريبي");
  await expect(focusTarget(page, "topics")).toBeFocused();
  await experience(page).locator(".topic").first().click();
  const target = focusTarget(page, "result");
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport();
  const cardOpacity = await experience(page).locator(".vfield").evaluate((el) => getComputedStyle(el).opacity);
  expect(cardOpacity).toBe("1");
  // The staged journey is simply all there: every stage lit, every run, light and thread in its final state.
  await expect(experience(page).locator(".jr--staged")).toHaveCount(0);
  await expect(experience(page).locator("[data-stage]:not(.is-on)")).toHaveCount(0);
  const dim = await experience(page).evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>(".rise, .vr, .beat__t, .cpoint__t, .st__dot")]
      .filter((el) => getComputedStyle(el).opacity !== "1")
      .map((el) => el.className),
  );
  expect(dim).toEqual([]);
  const lit = await experience(page).locator(".verse .lit").evaluate((el) => getComputedStyle(el).backgroundSize);
  expect(lit).toBe("100% 100%");
});
