# DEV-NOTES.md

Running log for the next session. Decisions are in `DECISIONS.md`; the approved plan and the owner's answers are in `PLAN.md`.

## Session 2026-10-23 (Phase 1 → Phase 2)

- Phase 1:
  - Studied `spec/`, ran the generator in a scratch folder and found 9 broken or ambiguous stories.
  - Wrote `PLAN.md`. The owner approved it and answered Q1–Q14.
- Data: `scripts/generate-data.mjs` is a patched copy of `spec/03` (the spec is untouched). `scripts/check-stories.mjs` asserts all story figures — all pass.
- App:
  - Vite + React 18 + TS + Tailwind + Zustand + react-i18next + Recharts.
  - 13 views, the store map (2 floors, 5 layers, traffic day/hour) and the agent drawer.
- Agent:
  - API-key mode for Anthropic and OpenAI (browser tool loop ≤ 6 rounds, streaming, Sources line, token counter).
  - Subscription mode through the local bridge (Claude Code CLI / Codex CLI + MCP server with the same 22 tools).
- Tests:
  - `npm test`: 34 unit tests — tools vs. all scenarios, providers with simulated streams, CLI parsers with recorded output.
  - `npx playwright test`: 12 e2e tests — every view × theme × language, plus run-sheet flows.
  - `node scripts/smoke-bridge.mjs`: bridge smoke test.
  - All pass on Linux.
- Verified against real CLIs without any login:
  - Claude Code 2.1.309 connects to the evias MCP server and sees exactly the 22 tools, no built-ins. An invalid key maps to "CLI not logged in".
  - Codex CLI 0.164.0 accepts all the flags.
  - No live model answer was produced in either mode (no key, no subscription login — by owner instruction).
- Screenshots:
  - `_screenshots/reference/` holds the first successful build: 4 combos × 13 views + flows.
  - `_screenshots/current/` holds the latest run.
- Not verifiable here (Linux container):
  - Real macOS and Windows runs. CI (`.github/workflows/ci.yml`) builds and smoke-tests on both.
  - A real logged-in CLI on either OS.

## How to resume
- `npm ci && npm run build && npm test && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npx playwright test`
- Before changing a view: re-run the e2e suite with `SHOT_DIR=_screenshots/current` and compare with `_screenshots/reference/`.

## Files (one line each: why it exists)
| File | Why |
| --- | --- |
| `PLAN.md` | Approved Phase-1 plan + owner answers |
| `DEV-NOTES.md` | This log |
| `DECISIONS.md` | Every decision taken without asking |
| `README.md` | How to start the demo on macOS/Windows, agent modes, developer commands (original backed up in `_backup/`) |
| `_backup/README.md.bak-2026-10-23` | Backup of the original README before rewriting |
| `.gitignore` / `.gitattributes` | Ignore generated output; CRLF for `.bat`, LF for `.command` |
| `.github/workflows/ci.yml` | CI: build + i18n + unit + bridge smoke on Ubuntu/macOS/Windows; Playwright on Ubuntu |
| `package.json` / `package-lock.json` | Dependencies and scripts |
| `index.html` | Entry page; applies theme/direction before first paint |
| `vite.config.ts` | Vite with `base: "./"` so `dist/` works from any path |
| `vitest.config.ts` | Unit test config |
| `playwright.config.ts` | E2E config: serves the app through the real bridge with a fake CLI |
| `tsconfig*.json` | TypeScript configs (app / node+tests) |
| `tailwind.config.ts` / `postcss.config.js` | Colour tokens as CSS variables, dark mode via `data-theme` |
| `public/favicon.svg` | Tab icon |
| `start-demo.command` | macOS double-click launcher (checks Node, installs, starts) |
| `start-demo.bat` | Windows double-click launcher (same) |
| `scripts/launcher/*.txt` | Bilingual launcher messages (UTF-8, printed by both launchers) |
| `scripts/demo.mjs` | `npm run demo`: build if needed, start the bridge, open the browser |
| `scripts/generate-data.mjs` | Patched copy of `spec/03-generate-data.mjs` (STORY-FIX marks) |
| `scripts/check-stories.mjs` | Asserts every planted figure in `public/data` |
| `scripts/check-i18n.mjs` | ar/en key parity, no hard-coded UI text, logical CSS only |
| `scripts/build-bridge-tools.mjs` | Bundles `src/agent/tools.ts` for the bridge's MCP server |
| `scripts/smoke-bridge.mjs` | Cross-platform bridge smoke test (CI on macOS/Windows) |
| `bridge/server.mjs` | Local bridge: serves `dist/`, `/health`, `/agent` (SSE), 127.0.0.1 only |
| `bridge/cli-claude.mjs` | Claude Code CLI arguments + stream-json parser |
| `bridge/cli-codex.mjs` | Codex CLI arguments + JSONL parser |
| `bridge/mcp-tools.mjs` | MCP stdio server exposing the 22 tools to the CLIs |
| `src/main.tsx` / `src/App.tsx` | Fonts, i18n, data gate, layout, view switch |
| `src/index.css` | Colour tokens (light/dark) and base component classes |
| `src/lib/types.ts` | Shapes of the generated JSON |
| `src/lib/metrics.ts` | All numbers: KPIs, stories, ministry metrics — shared by screens and tools |
| `src/lib/format.ts` | Latin digits, 3-decimal KD, name by language |
| `src/lib/useTokens.ts` | Resolves colour tokens for SVG/Recharts |
| `src/i18n/ar.json` / `en.json` / `index.ts` | All UI strings and i18next setup |
| `src/store/ui.ts` | Theme, language, scope, role, view, agent settings (localStorage keys) |
| `src/store/data.ts` | Loads all JSON once (`useData`) |
| `src/store/chat.ts` | Agent conversation, provider dispatch, token usage |
| `src/agent/prompt.ts` | Spec system prompt (verbatim) + placeholder filling |
| `src/agent/tools.ts` | The 22 tools over `metrics.ts` |
| `src/agent/types.ts` / `sse.ts` | Event types, limits, SSE reader |
| `src/agent/providers/anthropic.ts` | Anthropic Messages API stream + tool loop |
| `src/agent/providers/openai.ts` | OpenAI Chat Completions stream + tool loop |
| `src/agent/providers/bridge.ts` | Client for the local bridge (health + agent SSE) |
| `src/components/ui/index.tsx` | Card, DeltaPill, Table, Tabs, SidePanel, Badge… |
| `src/components/shell/Shell.tsx` | Topbar, sidebar, mobile nav, footer |
| `src/components/agent/ChatPanel.tsx` / `AgentDrawer.tsx` | Agent chat UI (drawer + full page) |
| `src/views/*.tsx` | The 13 views |
| `src/views/map/StoreMap.tsx` / `FixturePanel.tsx` | SVG store map and the shared fixture/space side panel |
| `tests/unit/*.ts` | Tool/scenario tests, provider + parser tests, data loader |
| `tests/e2e/*.ts` | Browser tests and screenshots |
| `tests/fixtures/fake-claude.mjs` | Stand-in CLI for tests/CI; calls the real MCP server |
| `_screenshots/reference/`, `_screenshots/current/` | Visual proof (reference = first successful build) |
