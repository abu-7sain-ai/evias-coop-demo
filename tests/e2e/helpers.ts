import { expect, type Page } from "@playwright/test";

export const VIEWS = ["dashboard", "agent", "map", "spaces", "shelves", "inventory", "sales", "finance", "members", "staff", "complaints", "ministry", "settings"] as const;
export type View = (typeof VIEWS)[number];

export async function open(page: Page, opts: { lang?: "ar" | "en"; theme?: "light" | "dark"; extra?: Record<string, string> } = {}) {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(([lang, theme, extra]) => {
    if (sessionStorage.getItem("e2e-init")) return; // only seed once so reload tests can check persistence
    sessionStorage.setItem("e2e-init", "1");
    localStorage.clear();
    localStorage.setItem("evias.lang", lang as string);
    localStorage.setItem("evias.theme", theme as string);
    for (const [k, v] of Object.entries(extra as Record<string, string>)) localStorage.setItem(k, v);
  }, [opts.lang ?? "ar", opts.theme ?? "light", opts.extra ?? {}] as const);
  await page.goto("./");
  await expect(page.getByTestId("view-dashboard")).toBeVisible({ timeout: 30_000 });
  return errors;
}

export async function go(page: Page, view: View) {
  await page.getByTestId(`nav-${view}`).click();
  await expect(page.getByTestId(`view-${view}`)).toBeVisible();
}

/** Lets the whole page grow so a full-page screenshot shows everything (the app normally scrolls inside <main>). */
export async function unclip(page: Page) {
  await page.addStyleTag({ content: "html,body,#root,.h-full{height:auto!important} main{overflow:visible!important}" });
}
