import { R } from "./fixtures/understand";
import { expect, experience, openApp, sendButton, stubUnderstand, test, toComposer } from "./support/app";
import { chips, en, t } from "./support/copy";

/** Kind-of-writing hints: «تجربة جديدة», «سؤال يشغلني», … — optional, appended to typed words. */
const [newExperience, question] = [chips[0], chips[1]];

test.describe("composer", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test("send needs typed words; a kind chip alone is not enough and the hint says so", async ({ page }) => {
    const ta = await toComposer(page);
    const send = sendButton(page);
    const hint = experience(page).locator("#tm-hint");
    await expect(send).toHaveText(t.sendLabel);
    await expect(send).toBeDisabled();
    await expect(hint).toHaveText(t.sendHint);

    await ta.fill("   ");
    await expect(send, "whitespace alone is not a message").toBeDisabled();

    const chip = experience(page).getByRole("button", { name: newExperience[0] });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(send, "a chip alone is too thin to send").toBeDisabled();
    await expect(hint).toBeVisible();

    await ta.fill("كلام تجريبي");
    await expect(send).toBeEnabled();
    await expect(hint).toHaveCount(0);

    await ta.fill("");
    await expect(send).toBeDisabled();
  });

  test("an example fills the composer, focuses it with the caret at the end, and the examples fold away", async ({ page }) => {
    const ta = await toComposer(page);
    const examples = experience(page).getByRole("list", { name: t.examplesLabel });
    await expect(examples.getByRole("button")).toHaveCount(t.examples.length);
    await examples.getByRole("button", { name: t.examples[0] }).click();
    await expect(ta).toHaveValue(t.examples[0]);
    await expect(ta).toBeFocused();
    expect(await ta.evaluate((el: HTMLTextAreaElement) => el.selectionStart === el.value.length)).toBe(true);
    await expect(examples).toHaveCount(0);
    await expect(sendButton(page)).toBeEnabled();
    // Clearing the words brings the examples back.
    await ta.fill("");
    await expect(experience(page).getByRole("list", { name: t.examplesLabel })).toBeVisible();
  });

  test("kind chips toggle aria-pressed", async ({ page }) => {
    await toComposer(page);
    const all = experience(page).locator(".chips .chip");
    await expect(all).toHaveCount(chips.length);
    for (const chip of await all.all()) await expect(chip).toHaveAttribute("aria-pressed", "false");

    const one = all.filter({ hasText: newExperience[0] });
    await one.click();
    await expect(one).toHaveAttribute("aria-pressed", "true");
    await one.click();
    await expect(one).toHaveAttribute("aria-pressed", "false");
  });

  test("Ctrl+Enter sends; the request is {stage, message, language}", async ({ page }) => {
    const calls = await stubUnderstand(page, R.topics());
    const ta = await toComposer(page);
    await ta.fill("  تعبت من الانتظار  ");
    await ta.press("Control+Enter");
    await expect(experience(page).locator(".topics")).toBeVisible();
    expect(calls).toHaveLength(1);
    // Exactly the documented analyze body, with the words trimmed.
    expect(calls[0]).toEqual({ stage: "analyze", message: "تعبت من الانتظار", language: "ar" });
  });

  test("Ctrl+Enter with an empty composer sends nothing", async ({ page }) => {
    const calls = await stubUnderstand(page, R.topics());
    const ta = await toComposer(page);
    await ta.focus();
    await ta.press("Control+Enter");
    await page.waitForTimeout(300);
    expect(calls).toHaveLength(0);
    await expect(ta).toBeVisible();
  });

  test("picked kinds are appended to the words with a neutral prefix; without words nothing is sent", async ({ page }) => {
    const calls = await stubUnderstand(page, R.topics());
    const ta = await toComposer(page);
    await ta.fill("كلام تجريبي");
    await experience(page).getByRole("button", { name: newExperience[0] }).click();
    await experience(page).getByRole("button", { name: question[0] }).click();
    await sendButton(page).click();
    await expect(experience(page).locator(".topics")).toBeVisible();
    expect(calls[0]).toEqual({
      stage: "analyze",
      message: `كلام تجريبي\n\n(${t.chipsPrefix} ${newExperience[0]}، ${question[0]})`,
      language: "ar",
    });
    // The words shown back to the person, with the kinds as tags.
    await expect(experience(page).locator(".words__quote")).toHaveText("كلام تجريبي");
    await expect(experience(page).locator(".words__tags li")).toHaveText([newExperience[0], question[0]]);

    // «عدّل» → chips stay pressed; with the words removed, chips alone cannot be sent (button or Ctrl+Enter).
    await experience(page).getByRole("button", { name: t.edit }).click();
    await ta.fill("");
    await expect(experience(page).getByRole("button", { name: question[0] })).toHaveAttribute("aria-pressed", "true");
    await expect(sendButton(page)).toBeDisabled();
    await ta.press("Control+Enter");
    await page.waitForTimeout(300);
    expect(calls).toHaveLength(1);
  });

  test("textarea caps input at 2000 characters", async ({ page }) => {
    const ta = await toComposer(page);
    await expect(ta).toHaveAttribute("maxlength", "2000");
    // Typed/pasted input (not a scripted value assignment) is what maxlength limits.
    await ta.focus();
    await page.keyboard.insertText("ج".repeat(2100));
    await expect.poll(async () => (await ta.inputValue()).length).toBe(2000);
  });

  test("English composer sends language: en", async ({ page }) => {
    const calls = await stubUnderstand(page, R.topics());
    await page.getByRole("button", { name: t.langLabel }).click();
    const ta = await toComposer(page);
    await ta.fill("What does patience mean in Islam?");
    await experience(page).getByRole("button", { name: question[1] }).click();
    await expect(sendButton(page)).toHaveText(en.sendLabel);
    await sendButton(page).click();
    await expect(experience(page).locator(".topics")).toBeVisible();
    expect(calls[0]).toEqual({
      stage: "analyze",
      message: `What does patience mean in Islam?\n\n(${en.chipsPrefix} ${question[1]})`,
      language: "en",
    });
  });
});
