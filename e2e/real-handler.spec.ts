/**
 * The UI against the real dev handler — mock provider for the analyze stage, the verified
 * repository for content. No stubs: proves the browser ↔ handler wiring end to end.
 * Assertions are structural (the catalog's wording is owned by the content pipeline).
 *
 * 5 API calls in total — see the budget note in api.spec.ts.
 */
import { ask, expect, experience, focusTarget, openApp, test } from "./support/app";
import { t } from "./support/copy";

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test("feeling → topics → journey → verified verse stage with its source chip", async ({ page }) => {
  const exp = experience(page);
  const analyzed = page.waitForResponse((r) => r.url().endsWith("/api/understand"));
  await ask(page, "تعبت من كل شيء وأحس إني أحاول وما يتغير شيء");
  const res = await analyzed;
  expect(res.status()).toBe(200);
  expect((await res.json()).mode).toBe("mock");

  await expect(focusTarget(page, "topics")).toBeFocused();
  const topics = exp.locator(".topics__list .topic");
  expect(await topics.count()).toBeGreaterThan(0);
  await expect(exp.locator(".understood p")).not.toBeEmpty();

  const journeyReq = page.waitForRequest((r) => r.url().endsWith("/api/understand"));
  await topics.first().click();
  const body = (await journeyReq).postDataJSON();
  expect(body).toMatchObject({ stage: "journey", language: "ar", analyzeLevel: "A" });
  expect(typeof body.topicId).toBe("string");

  const verse = exp.locator('[data-stage="verse"]');
  await expect(verse).toBeVisible();
  await expect(verse.locator(".verse")).not.toBeEmpty();
  await expect(verse.locator(".verse")).toHaveAttribute("lang", "ar");
  await expect(verse.locator(".src-chip")).toContainText(/\d+:\d+/);
  await expect(verse.getByRole("heading", { level: 3 })).not.toBeEmpty();
  await expect(exp.locator('[data-stage="dua"]').getByRole("button", { name: t.endJourney })).toBeVisible();
});

test("«ما معنى التوحيد؟» → glossary card with page reference and source link", async ({ page }) => {
  await ask(page, "ما معنى التوحيد؟");
  const card = experience(page).locator(".card--know");
  await expect(card).toBeVisible();
  await expect(card.locator(".card__top")).toContainText(t.knowGlossary);
  await expect(card.getByRole("heading", { level: 3 })).toContainText("التوحيد");
  await expect(card.locator(".term__en")).not.toBeEmpty();
  await expect(card.locator(".source-quote")).not.toBeEmpty();
  await expect(card.locator(".ref__what")).toContainText("ص");
  await expect(card.getByRole("link", { name: t.openSource })).toHaveAttribute("href", /^https:\/\//);
});

test("«لماذا يعبد المسلمون الكعبة؟» → Q&A excerpt from «بينات» with a page reference", async ({ page }) => {
  await ask(page, "لماذا يعبد المسلمون الكعبة؟");
  const card = experience(page).locator(".card--know");
  await expect(card).toBeVisible();
  await expect(card.locator(".card__top")).toContainText(t.knowQa);
  await expect(card.locator(".note")).toHaveText(t.excerptNote);
  await expect(card.locator(".ref__src")).toContainText("بينات");
  await expect(card.locator(".ref__what")).toContainText(/ص\s*\d+/);
  await expect(card.getByRole("link", { name: t.openSource })).toHaveAttribute("href", /^https:\/\//);
});

test("self-harm phrasing → «أنت مهم» from the server's local guard", async ({ page }) => {
  await ask(page, "لدي أفكار عن الانتحار");
  const care = experience(page).locator(".card--care");
  await expect(care.getByRole("heading", { name: "أنت مهم" })).toBeFocused();
  await expect(care.getByRole("link", { name: t.careHelpline })).toBeVisible();
  await expect(experience(page).locator(".pointer, .jr")).toHaveCount(0);
});
