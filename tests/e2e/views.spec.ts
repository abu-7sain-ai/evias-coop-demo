// Every view × {light, dark} × {ar, en}: renders, no console errors, footer, direction, no page-level horizontal overflow, screenshot.
import { expect, test } from "@playwright/test";
import { VIEWS, go, open, unclip } from "./helpers";

const SHOT_DIR = process.env.SHOT_DIR ?? "_screenshots/current";
const FOOTER = { ar: "ديمو مستقل ببيانات اصطناعية؛ لا ينفذ معاملات على أنظمة خارجية.", en: "Standalone demo with synthetic data; no transactions on external systems." };

for (const theme of ["light", "dark"] as const) {
  for (const lang of ["ar", "en"] as const) {
    test(`all views — ${theme}/${lang}`, async ({ page }) => {
      const errors = await open(page, { lang, theme, extra: { "evias.anthropic_key": "" } });
      // Ministry view is only for ministry roles
      await page.getByTestId("role-select").selectOption("ministry_admin");
      await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      for (const v of VIEWS) {
        if (v === "ministry") await page.getByTestId("coop-select").selectOption("ALL");
        if (v === "settings") await page.getByTestId("coop-select").selectOption("C1");
        await go(page, v);
        await expect(page.getByTestId("footer")).toHaveText(FOOTER[lang]);
        if (v === "ministry") await expect(page.getByTestId("ministry-banner")).toBeVisible();
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${v} horizontal overflow`).toBeLessThanOrEqual(1);
        await unclip(page);
        await page.screenshot({ path: `${SHOT_DIR}/${theme}-${lang}/${String(VIEWS.indexOf(v) + 1).padStart(2, "0")}-${v}.png`, fullPage: true });
        await page.reload(); // drop the unclip style; storage keeps theme/lang
        await page.getByTestId("role-select").selectOption("ministry_admin");
        if (v === "ministry") await page.getByTestId("coop-select").selectOption("ALL");
      }
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }
}
