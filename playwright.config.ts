import { defineConfig } from "@playwright/test";

// The app is served by the real local bridge (same as the presenter's machine), with a fake CLI standing in for Claude Code.
const PORT = 5391;
const chromium = process.env.PW_CHROMIUM_PATH; // pre-installed Chromium in the cloud sandbox; CI uses Playwright's own

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    viewport: { width: 1440, height: 900 },
    launchOptions: chromium ? { executablePath: chromium } : {},
  },
  webServer: {
    command: "node bridge/server.mjs",
    url: `http://127.0.0.1:${PORT}/health`,
    reuseExistingServer: false,
    env: { EVIAS_PORT: String(PORT), EVIAS_CLAUDE_BIN: "tests/fixtures/fake-claude.mjs", EVIAS_CODEX_BIN: "codex-not-installed-in-tests" },
  },
});
