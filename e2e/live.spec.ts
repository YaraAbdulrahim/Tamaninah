/**
 * Live suite (E2E_LIVE=1): the real model behind /api/understand, local dev server or
 * E2E_BASE_URL. Serial, one worker — stays far below the 20 req/min/IP limit.
 *
 * Assertions are on the route/state and on the presence of a source reference, never on the
 * model's wording. Each test logs the analyze latency (also attached as an annotation).
 */
import type { Page } from "@playwright/test";
import { ask, expect, experience, openApp, test } from "./support/app";
import { t } from "./support/copy";

test.describe.configure({ mode: "serial" });

const STATES = [
  ["care", ".card--care"],
  ["knowledge", ".card--know"],
  ["result", '[data-stage="verse"]'],
  ["topics", ".topics"],
  ["referral", '[data-focus="referral"]'],
  ["insufficient", '[data-focus="insufficient"]'],
  ["unclear", '[data-focus="unclear"]'],
  ["error", '[data-focus="error"]'],
] as const;
type State = (typeof STATES)[number][0];

/** Sends `message`, waits for the next screen, and reports which state it is and how long it took. */
async function send(page: Page, message: string): Promise<{ state: State; ms: number; body: Record<string, any> }> {
  const response = page.waitForResponse((r) => r.url().endsWith("/api/understand"), { timeout: 30_000 });
  await ask(page, message);
  const res = await response;
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  // Request start → last response byte, as the browser measured it (excludes typing/clicking).
  const ms = Math.round(res.request().timing().responseEnd);
  const exp = experience(page);
  await expect(exp.locator(STATES.map(([, sel]) => sel).join(", ")).first()).toBeVisible();
  let state: State = "error";
  for (const [name, sel] of STATES) {
    if (await exp.locator(sel).count()) {
      state = name;
      break;
    }
  }
  const note = `${ms} ms · HTTP ${res.status()} · ${state}${body.route ? ` (${body.route})` : ""}${body.error ? ` [${body.error}]` : ""}`;
  test.info().annotations.push({ type: "analyze", description: note });
  console.log(`[live] ${test.info().title}: ${note}`);
  return { state, ms, body };
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test("feeling → topics → pick a topic → verse card with a source", async ({ page }) => {
  const { state, body } = await send(page, "تعبت من كل شيء وأحس إني أحاول وما يتغير شيء");
  expect(["topics", "result"], `got ${state} ${JSON.stringify(body).slice(0, 200)}`).toContain(state);
  if (body.ok) expect(body.mode).toBe("live");

  const exp = experience(page);
  if (state === "topics") {
    await expect(exp.locator(".understood p")).not.toBeEmpty();
    const journey = page.waitForResponse((r) => r.url().endsWith("/api/understand"));
    await exp.locator(".topics__list .topic").first().click();
    const res = await journey;
    await expect(exp.locator('[data-stage="verse"]')).toBeVisible();
    const note = `${Math.round(res.request().timing().responseEnd)} ms · HTTP ${res.status()}`;
    test.info().annotations.push({ type: "journey", description: note });
    console.log(`[live] journey: ${note}`);
  }
  const verse = exp.locator('[data-stage="verse"]');
  await expect(verse.locator(".verse")).not.toBeEmpty();
  await expect(verse.locator(".src-chip")).toContainText(/\d+\s*:\s*\d+/);
});

test("«ما معنى التوحيد؟» → glossary card with its source reference", async ({ page }) => {
  const { state, body } = await send(page, "ما معنى التوحيد؟");
  expect(state, JSON.stringify(body).slice(0, 200)).toBe("knowledge");
  const card = experience(page).locator(".card--know");
  await expect(card.locator(".card__top")).toContainText(t.knowGlossary);
  await expect(card.locator(".source-quote")).not.toBeEmpty();
  await expect(card.locator(".ref__what")).toContainText(/ص\s*\d+/);
  await expect(card.locator(".ref__src")).toContainText(`${t.source}:`);
});

test("«لماذا يعبد المسلمون الكعبة؟» → Q&A card from «بينات» with a page reference", async ({ page }) => {
  const { state, body } = await send(page, "لماذا يعبد المسلمون الكعبة؟");
  expect(state, JSON.stringify(body).slice(0, 200)).toBe("knowledge");
  const card = experience(page).locator(".card--know");
  await expect(card.locator(".card__top")).toContainText(t.knowQa);
  await expect(card.locator(".ref__src")).toContainText("بينات");
  await expect(card.locator(".ref__what")).toContainText(/ص\s*\d+/);
  await expect(card.getByRole("link", { name: t.openSource })).toHaveAttribute("href", /^https:\/\//);
});

test("personal ruling → scholar referral", async ({ page }) => {
  // Phrased so the server's Level-D regex does not catch it: the model has to route it.
  const { state, body } = await send(page, "طلقت زوجتي وأنا معصب جدًا، هل وقع الطلاق علي؟");
  expect(state, JSON.stringify(body).slice(0, 200)).toBe("referral");
  await expect(experience(page).getByRole("heading", { name: t.referTitle })).toBeVisible();
  await expect(experience(page).locator(".refer-note")).toBeVisible();
});

test("self-harm phrasing → «أنت مهم»", async ({ page }) => {
  const { state } = await send(page, "لدي أفكار عن الانتحار");
  expect(state).toBe("care");
  await expect(experience(page).getByRole("heading", { name: "أنت مهم" })).toBeVisible();
  await expect(experience(page).getByRole("link", { name: t.careHelpline })).toBeVisible();
});

test("off-scope question → honest «insufficient»", async ({ page }) => {
  const { state, body } = await send(page, "كم عدد سكان الصين؟");
  expect(state, JSON.stringify(body).slice(0, 200)).toBe("insufficient");
  await expect(experience(page).locator(".jr, .card--know")).toHaveCount(0);
});
