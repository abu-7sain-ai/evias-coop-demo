// What the presenter does in the run-sheet (spec/05 §D), clicked through in a real browser.
import { expect, test, type Route } from "@playwright/test";
import { go, open, unclip } from "./helpers";

const SHOT_DIR = process.env.SHOT_DIR ?? "_screenshots/current";

test("language and theme toggles flip everything and persist", async ({ page }) => {
  await open(page, { lang: "ar", theme: "light" });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("nav-dashboard")).toHaveText("لوحة المعلومات");
  await page.getByTestId("lang-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByTestId("nav-dashboard")).toHaveText("Dashboard");
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(28, 30, 33)"); // #1C1E21
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(await page.evaluate(() => [localStorage.getItem("evias.theme"), localStorage.getItem("evias.lang")])).toEqual(["dark", "en"]);
  await page.getByTestId("theme-toggle").click();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(245, 246, 247)"); // #F5F6F7
});

test("dashboard KPI arrows: waste down = green, variance up = red, rent up = green", async ({ page }) => {
  await open(page, { lang: "en" });
  const pill = (k: string) => page.getByTestId(`kpi-${k}`).getByTestId("delta");
  await expect(pill("waste")).toHaveAttribute("data-good", "true");
  await expect(pill("variance")).toHaveAttribute("data-good", "false");
  await expect(pill("rent")).toHaveAttribute("data-good", "true");
  await expect(page.getByTestId("priorities").locator("li")).toHaveCount(7);
});

test("store map: second shelf panel, traffic slider, mezzanine contracts", async ({ page }) => {
  await open(page, { lang: "en" });
  await go(page, "map");
  await page.locator('[data-id="A02-END-C2"]').click();
  const panel = page.getByTestId("fixture-panel");
  await expect(panel).toContainText("SUP-04");
  await expect(panel).toContainText("180.000 KD");
  await expect(panel).toContainText("2026-12-16");
  await expect(panel).toContainText("45 days");
  await panel.getByRole("button", { name: "Close" }).click();

  await page.getByTestId("layer-traffic").click();
  await page.getByTestId("day-Thu").click();
  await page.getByTestId("hour-slider").fill("20");
  const thu = await page.locator('[data-id="ENT-MAIN"] rect').first().getAttribute("fill");
  await expect(page.getByTestId("traffic-controls")).toContainText("8.");
  await page.getByTestId("day-Mon").click();
  await page.getByTestId("hour-slider").fill("10");
  const mon = await page.locator('[data-id="ENT-MAIN"] rect').first().getAttribute("fill");
  expect(thu).not.toBe(mon);
  const alpha = (f: string | null) => Number(/,([\d.]+)\)$/.exec(f ?? "")?.[1] ?? 0);
  expect(alpha(thu)).toBeGreaterThan(alpha(mon));
  await page.getByTestId("day-Thu").click();
  await page.getByTestId("hour-slider").fill("20");
  await unclip(page);
  await page.screenshot({ path: `${SHOT_DIR}/flows/map-traffic-thu-20.png`, fullPage: true });
  await page.reload();
  await go(page, "map");

  await page.getByTestId("floor-tabs").getByRole("tab", { name: "Mezzanine" }).click();
  await expect(page.getByTestId("floor-svg")).toHaveAttribute("data-layer", "contracts");
  await page.locator('[data-id="M-07"]').click();
  await expect(panel).toContainText("1,060.000 KD");
  await expect(panel).toContainText("45 days late");
  await panel.getByRole("button", { name: "Close" }).click();
  await page.locator('[data-id="M-16"]').click();
  await expect(panel).toContainText("140 days");
  await page.screenshot({ path: `${SHOT_DIR}/flows/map-mezzanine-M16.png` });
  await page.getByTestId("ask-about-fixture").click();
  await expect(page.getByTestId("agent-input")).toHaveValue("What's the status of M-16?");
});

test("settings: key saved only in this browser, chip shows last 4, clear works", async ({ page }) => {
  await open(page, { lang: "en" });
  await go(page, "settings");
  await page.getByTestId("mode-tabs").getByRole("tab", { name: "API key" }).click();
  await expect(page.getByTestId("key-status")).toHaveText("No key");
  await page.getByTestId("key-input").fill("sk-ant-demo-ABCD1234");
  await page.getByTestId("key-save").click();
  await expect(page.getByTestId("key-status")).toHaveText("Key set (sk-…1234)");
  expect(await page.evaluate(() => localStorage.getItem("evias.anthropic_key"))).toBe("sk-ant-demo-ABCD1234");
  await expect(page.getByTestId("key-input")).toHaveValue("");
  await page.getByTestId("key-clear").click();
  await expect(page.getByTestId("key-status")).toHaveText("No key");
  expect(await page.evaluate(() => localStorage.getItem("evias.anthropic_key"))).toBeNull();
  await page.getByTestId("provider-tabs").getByRole("tab", { name: "OpenAI" }).click();
  await expect(page.getByTestId("model-select")).toHaveValue("gpt-4.1-mini");
  await page.getByTestId("provider-tabs").getByRole("tab", { name: "Anthropic" }).click();
  await expect(page.getByTestId("model-select")).toHaveValue("claude-sonnet-5-5");
});

test("agent, API mode (Anthropic, simulated stream): tool round, answer, sources, tokens; key only goes to api.anthropic.com", async ({ page }) => {
  const seen: string[] = [];
  page.on("request", (r) => { if ((r.headers()["x-api-key"] ?? "").length || (r.postData() ?? "").includes("sk-ant-e2e")) seen.push(new URL(r.url()).host); });
  let n = 0;
  await page.route("https://api.anthropic.com/v1/messages", async (route: Route) => {
    const body = JSON.parse(route.request().postData()!);
    const ev = (o: unknown) => `event: x\ndata: ${JSON.stringify(o)}\n\n`;
    if (n++ === 0) {
      expect(body.tools).toHaveLength(22);
      expect(body.system).toContain("Demo date: 2026-11-01");
      return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body:
        ev({ type: "message_start", message: { usage: { input_tokens: 2100, output_tokens: 1 } } }) +
        ev({ type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "t1", name: "shelf_performance", input: {} } }) +
        ev({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"coop_id":"C1","fixture_id":"A02-END-C2"}' } }) +
        ev({ type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 40 } }) });
    }
    const result = JSON.parse(body.messages.at(-1).content[0].content);
    const f = result.rows[0];
    const text = `**${f.fixture_id}** محجوز لـ ${f.reservations[0].supplier_id} بـ ${f.reservations[0].monthly_rent.toFixed(3)} د.ك، ينتهي ${f.reservations[0].ends_on} (${f.reservations[0].days_to_contract_end} يوم).\n\n| المؤشر | القيمة |\n|---|---|\n| ترتيب الحركة | ${f.traffic_rank} |\n| مبيعات المتر | ${f.vs_branch_median} الوسيط |`;
    return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body:
      ev({ type: "message_start", message: { usage: { input_tokens: 3000, output_tokens: 1 } } }) +
      ev({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }) +
      ev({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }) +
      ev({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 120 } }) });
  });
  await open(page, { lang: "ar", extra: { "evias.agent_mode": "api", "evias.api_provider": "anthropic", "evias.anthropic_key": "sk-ant-e2e-0000" } });
  await go(page, "map");
  await page.locator('[data-id="A02-END-C2"]').click();
  await page.getByTestId("ask-about-fixture").click();
  await expect(page.getByTestId("agent-input")).toHaveValue("وش وضع A02-END-C2؟");
  await page.getByTestId("agent-send").click();
  const msg = page.getByTestId("agent-message").last();
  await expect(msg).toContainText("SUP-04");
  await expect(msg).toContainText("180.000");
  await expect(msg).toContainText("2026-12-16");
  await expect(msg.locator("table")).toBeVisible();
  await expect(msg.getByTestId("sources")).toContainText("shelf_performance(coop_id=C1, fixture_id=A02-END-C2)");
  await expect(page.getByTestId("token-counter")).toContainText("5,100");
  await page.screenshot({ path: `${SHOT_DIR}/flows/agent-api-simulated.png` });
  expect([...new Set(seen)]).toEqual(["api.anthropic.com"]);
});

test("agent errors: 401 → invalid key, 429 → rate limited, no key → settings card", async ({ page }) => {
  let status = 401;
  await page.route("https://api.anthropic.com/v1/messages", (r) => r.fulfill({ status, headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ error: { message: "x" } }) }));
  await open(page, { lang: "en", extra: { "evias.agent_mode": "api", "evias.anthropic_key": "sk-bad" } });
  await page.getByTestId("agent-toggle").click();
  await page.getByTestId("agent-input").fill("Who is late on rent?");
  await page.getByTestId("agent-send").click();
  await expect(page.getByTestId("agent-error").last()).toHaveText("Invalid key");
  status = 429;
  await page.getByTestId("agent-input").fill("Who is late on rent?");
  await page.getByTestId("agent-send").click();
  await expect(page.getByTestId("agent-error").last()).toHaveText("Rate limited, retry shortly");
  await page.evaluate(() => localStorage.removeItem("evias.anthropic_key"));
  await page.reload();
  await page.getByTestId("agent-toggle").click();
  await expect(page.getByTestId("key-card")).toBeVisible();
});

test("agent, subscription mode via the local bridge (fake CLI → real MCP tools)", async ({ page }) => {
  await open(page, { lang: "ar", extra: { "evias.agent_mode": "bridge", "evias.bridge_cli": "claude", "evias.bridge_url": "http://127.0.0.1:5391" } });
  await go(page, "settings");
  await expect(page.getByTestId("bridge-status")).toContainText("9.9.9");
  await page.getByTestId("cli-tabs").getByRole("tab", { name: "Codex CLI" }).click();
  await expect(page.getByTestId("bridge-status")).toContainText("غير موجود");
  await page.getByTestId("cli-tabs").getByRole("tab", { name: "Claude Code CLI" }).click();
  await unclip(page);
  await page.screenshot({ path: `${SHOT_DIR}/flows/settings-bridge.png`, fullPage: true });
  await page.reload();
  await go(page, "agent");
  await page.getByTestId("agent-input").fill("منو متأخر بالإيجار؟");
  await page.getByTestId("agent-send").click();
  const msg = page.getByTestId("agent-message").last();
  await expect(msg).toContainText("FAKE-CLI M-07 45 prompt-ok");
  await expect(msg.getByTestId("sources")).toContainText("rent_arrears(coop_id=C1)");
  await expect(page.getByTestId("token-counter")).toContainText("123");
  await page.screenshot({ path: `${SHOT_DIR}/flows/agent-bridge-fake-cli.png` });
});

test("priority card opens the agent with the question pre-filled; inspector sees ministry", async ({ page }) => {
  await open(page, { lang: "ar" });
  await page.getByTestId("priorities").getByRole("button").first().click();
  await expect(page.getByTestId("agent-drawer")).toBeVisible();
  await expect(page.getByTestId("agent-input")).toHaveValue("فيه كاشير يجامل أحد؟");
  await expect(page.getByTestId("nav-ministry")).toHaveCount(0);
  await page.getByTestId("role-select").selectOption("inspector");
  await page.getByTestId("coop-select").selectOption("ALL");
  await go(page, "ministry");
  await expect(page.getByTestId("ministry-banner")).toHaveText("عرض توضيحي — لا اتصال فعلي بأنظمة الوزارة");
  await expect(page.getByTestId("ministry-compare")).toContainText("×");
  await expect(page.getByTestId("breaches-table").locator("tbody tr")).toHaveCount(4);
});
