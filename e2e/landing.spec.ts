import { expect, openApp, test, textarea } from "./support/app";
import { en, t } from "./support/copy";

test.describe("landing", () => {
  test("loads in Arabic, right-to-left, with the hero heading and no errors", async ({ page }) => {
    await openApp(page);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");
    await expect(html).toHaveAttribute("lang", "ar");
    await expect(page.locator(".page")).toHaveAttribute("dir", "rtl");
    await expect(page).toHaveTitle(/طمأنينة/);

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText(t.heroLine1);
    await expect(h1).toContainText(t.heroLine2);

    // Landmarks and the composer's labelled textbox.
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("textbox", { name: t.question })).toBeAttached();

    // Nothing religious is rendered before a response.
    await expect(page.locator("#experience .card, #experience .verse")).toHaveCount(0);
    // The AI + privacy disclosure sits by the composer and describes the textarea.
    await expect(page.locator("#tm-note")).toContainText(t.aiNote);
    await expect(page.locator("#tm-note")).toContainText(t.privacyNote);
    await expect(textarea(page)).toHaveAttribute("aria-describedby", /(^|\s)tm-note(\s|$)/);
    // The `issues` fixture fails the test on console errors / page errors / failed requests.
  });

  test("within the page: any experience or question → discover topics → choose → learn from sources", async ({ page }) => {
    await openApp(page);
    await expect(page).toHaveTitle(t.docTitle);
    await expect(page.locator(".hero__lead")).toHaveText(t.heroLead);
    // Scene 2: the example writing and the topics it could open.
    await expect(page.locator("#human").getByRole("heading", { name: t.s2Lead })).toBeAttached();
    await expect(page.locator("#human .human__who")).toHaveText(t.s2Who);
    await expect(page.locator("#human .tag")).toHaveText(t.s2Topics);
    // Journey: four numbered stations (desktop rail).
    const rail = page.locator(".rail-d li");
    await expect(rail).toHaveCount(4);
    await expect(page.locator(".rail-d .st-num")).toHaveText(["01", "02", "03", "04"]);
    await expect(page.locator(".rail-d strong")).toHaveText(t.stations.map(([title]) => title));
    // Gateway: the topic's three sources (Quran, Hadith, Tafsir) and the source promise.
    await expect(page.locator("#story .story__item-h")).toHaveText(t.storyItems.map(([title]) => title));
    await expect(page.locator("#story .story__item")).toHaveCount(3);
    await expect(page.locator("#story .story__foot")).toHaveText(t.storyFoot);
    // Trust: the source pill, then the AI's role as a numbered list, and what it never does.
    await expect(page.locator("#trust .src__txt")).toContainText(t.source);
    await expect(page.locator("ol.ai-steps .ai-steps__txt")).toHaveText(t.aiRoleSteps);
    await expect(page.locator("ol.ai-steps .ai-steps__n")).toHaveText(["1", "2", "3"]);
    await expect(page.locator(".ai-role__note")).toHaveText(t.aiRoleNote);
    // Experience + closing.
    await expect(page.locator("#tm-sub")).toHaveText(t.questionSub);
    await expect(page.locator(".closing__lead")).toContainText(t.closingLead);
    await expect(page.locator(".closing__lead")).toContainText(t.closingBody);
    await expect(page.locator("body")).not.toContainText("Global AI Challenge");
    // The closing no longer repeats the brand + tagline; the footer keeps its brand and links (no tagline there either).
    await expect(page.locator("#begin")).not.toContainText(t.tagline);
    await expect(page.locator("#begin")).not.toContainText("Tamaninah");
    await expect(page.getByRole("contentinfo")).toContainText("Tamaninah");
    await expect(page.getByRole("contentinfo")).not.toContainText(t.tagline);
  });

  test("hero Teletype: the H1 types itself word by word in CSS, once, with real text", async ({ page }) => {
    await openApp(page);
    const words = page.locator("h1 .tw");
    await expect(words).toHaveCount(`${t.heroLine1} ${t.heroLine2}`.split(" ").length);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${t.heroLine1} ${t.heroLine2}`);
    // The typing is a silent ::before copy that grows with the caret at its edge; the real text waits underneath.
    const anim = await page.locator("h1 .tw").nth(1).evaluate((el) => {
      const cs = getComputedStyle(el, "::before");
      return { name: cs.animationName, count: cs.animationIterationCount, content: cs.content };
    });
    const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    // Plays once; with reduced motion it doesn't play at all.
    if (reduced) expect(anim.content).toBe("none");
    else expect(anim).toMatchObject({ name: "tw-grow, tw-ink, tw-caret", count: "1, 1, 1" });
    // The caret is drawn (a pseudo-element), never inserted into the text.
    expect(await page.locator("h1").evaluate((h) => h.textContent?.includes("|"))).toBe(false);
  });

  test("language toggle switches to English (ltr) and back", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: t.langLabel }).click();
    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "ltr");
    await expect(html).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(en.heroLine1);
    await expect(page.getByRole("textbox", { name: en.question })).toBeAttached();
    await expect(page).toHaveTitle(en.docTitle);
    await expect(page.locator(".ai-role__note")).toHaveText(en.aiRoleNote);

    await page.getByRole("button", { name: en.langLabel }).click();
    await expect(html).toHaveAttribute("dir", "rtl");
    await expect(html).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(t.heroLine1);
  });

  test("hero CTA «ابدأ من حيث أنت» scrolls to the experience and focuses the textarea", async ({ page }) => {
    await openApp(page);
    await expect(textarea(page)).not.toBeInViewport();
    await page.locator(".hero").getByRole("button", { name: t.heroCta }).click();
    await expect(textarea(page)).toBeFocused({ timeout: 6_000 });
    await expect(textarea(page)).toBeInViewport();
    await expect(page.locator("#tm-q")).toBeInViewport();
  });

  test("closing CTA «ابدأ رحلتي» also takes you to the composer, focused", async ({ page }) => {
    await openApp(page);
    const cta = page.locator("#begin").getByRole("button", { name: t.closingCta });
    await cta.scrollIntoViewIfNeeded();
    await cta.click();
    await expect(textarea(page)).toBeFocused({ timeout: 6_000 });
    await expect(textarea(page)).toBeInViewport();
  });

  test("skip link is the first tab stop and moves focus to main", async ({ page }) => {
    await openApp(page);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: t.skip });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
    await expect(page.getByRole("main")).toBeFocused();
  });

  test("«استكشف طمأنينة» scrolls to the next scene", async ({ page }) => {
    await openApp(page);
    await expect(page.locator("#human .human__lead")).not.toBeInViewport();
    await page.locator(".hero").getByRole("button", { name: t.explore }).click();
    await expect(page.locator("#human .human__lead")).toBeInViewport({ timeout: 6_000 });
  });

  test("scene 2 plays once, in time and in order: the intro, then the example writes itself, then the topics", async ({ page }) => {
    await openApp(page);
    const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    test.skip(reduced, "reduced motion shows the finished scene (reduced-motion.spec)");
    // Sample in the page, frame by frame: the scene as it is at the very frame the example's first word shows.
    await page.evaluate(() => {
      const scene = document.querySelector("#human")!;
      const op = (sel: string) => [...scene.querySelectorAll(sel)].map((e) => Number(getComputedStyle(e).opacity));
      const first = scene.querySelector(".human__phrases .w__i")!;
      const w = window as unknown as { __s2?: unknown };
      const tick = () => {
        if (Number(getComputedStyle(first).opacity) > 0) {
          w.__s2 = {
            intro: op(".human__lead .w__i, .human__body, .human__who"),
            marks: [...scene.querySelectorAll('[data-a="mk-bg"]')].map((e) => getComputedStyle(e).transform),
            tags: op(".tag"),
          };
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.locator(".hero").getByRole("button", { name: t.explore }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __s2?: unknown }).__s2 ?? null), { timeout: 15_000 }).not.toBeNull();
    const s2 = (await page.evaluate(() => (window as unknown as { __s2: { intro: number[]; marks: string[]; tags: number[] } }).__s2))!;
    // The example starts only once the intro is complete — lead, body, «قد تكون …» and both highlights —
    // and before any topic has arrived.
    expect(s2.intro.every((o) => o === 1)).toBe(true);
    for (const m of s2.marks) expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(m);
    expect(s2.tags).toEqual([0, 0, 0]);
    // …and it plays through by itself, without more scrolling.
    const scene = page.locator("#human");
    await expect
      .poll(() => scene.locator(".human__phrases .w__i, .tag, .human__note").evaluateAll((els) => els.every((e) => getComputedStyle(e).opacity === "1")), { timeout: 15_000 })
      .toBe(true);
  });

  test("scene 2: arriving past it early shows it finished — never half-written", async ({ page }) => {
    await openApp(page);
    const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    test.skip(reduced, "reduced motion shows the finished scene (reduced-motion.spec)");
    await page.evaluate(() => window.scrollTo(0, document.querySelector("#trust")!.getBoundingClientRect().top + window.scrollY));
    const scene = page.locator("#human");
    await expect
      .poll(() => scene.locator(".w__i, .human__body, .human__who, .tag, .human__note").evaluateAll((els) => els.every((e) => getComputedStyle(e).opacity === "1")), { timeout: 3_000 })
      .toBe(true);
  });

  test("footer «المصادر المعتمدة» opens a modal sheet that Escape closes", async ({ page }) => {
    await openApp(page);
    const trigger = page.getByRole("contentinfo").getByRole("button", { name: t.footerSources });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: t.sourcesTitle });
    await expect(dialog).toBeVisible();
    // Native modal: focus moves into the sheet.
    await expect.poll(() => dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    // Every external link in the sheet opens safely in a new tab.
    const links = dialog.getByRole("link");
    expect(await links.count()).toBeGreaterThan(5);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
      await expect(link).toHaveAttribute("href", /^https:\/\//);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger, "focus returns to the button that opened the sheet").toBeFocused();

    await page.getByRole("contentinfo").getByRole("button", { name: t.footerPrivacy }).click();
    const privacy = page.getByRole("dialog", { name: t.privacyTitle });
    await expect(privacy).toBeVisible();
    await expect(privacy).toContainText(t.privacyBody[0]);
    await privacy.getByRole("button", { name: t.close }).click();
    await expect(privacy).toBeHidden();
  });
});
