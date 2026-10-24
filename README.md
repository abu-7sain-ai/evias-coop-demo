# E-VIAS Coop Platform — Government Demo

A standalone, bilingual (Arabic RTL / English LTR) demo of the E-VIAS cooperative-society platform. It runs on generated synthetic data, with a KPI dashboard, an interactive store map, 12 working views and an AI agent ("الوكيل") that answers only from the demo data.

> Standalone demo with synthetic data; no transactions on external systems.
> ديمو مستقل ببيانات اصطناعية؛ لا ينفذ معاملات على أنظمة خارجية.

## Start the demo (macOS and Windows)

1. Install **Node.js 22 LTS** (minimum 20.19) from <https://nodejs.org>. If it is missing, the launcher says so in Arabic and English and shows this link.
2. Double-click the launcher in this folder:
   - **macOS:** `start-demo.command`. The first time, macOS may block it: right-click → *Open* → *Open*.
   - **Windows:** `start-demo.bat`
3. **First run only** (needs internet): the launcher installs the packages and builds the demo, which takes about a minute.
4. The browser opens at <http://127.0.0.1:5317>. Keep the black launcher window open during the presentation; close it (or press Ctrl+C) to stop.

From a terminal, the same thing is: `npm install` then `npm run demo`.

Once installed, the demo works **offline**: the fonts and data are bundled. Only the agent needs the internet.

## Agent connection: two modes (Settings → Agent connection)

| Mode | What it uses | What the presenter does |
| --- | --- | --- |
| **Subscription (local bridge)** | The **Claude Code CLI** (`claude`) or the **Codex CLI** (`codex`) installed on the same computer, with your own subscription | Install the CLI and log in **once** in a terminal (`claude`, or `codex`, then follow its login). Start the demo with the launcher. In Settings choose *Subscription*, then the CLI, then *Test connection*. |
| **API key** | Anthropic or OpenAI API, called directly from the browser | In Settings choose *API key*, pick the provider, paste a demo key that has a spending limit, and pick the model. |

How the subscription bridge works:
- **Where it runs:**
  - The launcher starts `bridge/server.mjs`. It serves the app and listens on **127.0.0.1 only**.
  - Requests from any other website or host name are refused.
- **What happens per question:**
  - It runs the CLI once, in an empty temporary folder:
    - `claude -p …` for Claude Code
    - `codex exec …` for Codex
  - The CLI's own shell, file and web tools are switched off.
  - The CLI can only call the **22 demo tools**. They are served by `bridge/mcp-tools.mjs` and are the same code the browser uses.
- **Your credentials:** your CLI login stays inside the CLI. The demo never sees it.
- **Models:** the CLI's default model is used unless you type one in Settings.
- **Codex answers** appear in one piece instead of word by word, because the Codex CLI does not stream partial text.

How API keys are handled:
- Keys are stored only in this browser's `localStorage`:
  - `evias.anthropic_key`
  - `evias.openai_key`
- An Anthropic key is sent only to `api.anthropic.com`, and an OpenAI key only to `api.openai.com`.
- *Clear key* removes it.

Models offered:
- **Anthropic:**
  - `claude-sonnet-5-5` (default)
  - `claude-haiku-5-5`
  - `claude-opus-5-5`
- **OpenAI:**
  - `gpt-4.1-mini` (default)
  - `gpt-4.1`
  - `gpt-4o`
- Each provider also has a *custom model* field.

## Presenter run-sheet

See `spec/05-SCENARIOS.md` §D. The planted stories behind each question are checked automatically (`npm run check:data`). The suggested-question chips in the agent panel are the scenario questions.

## For developers

| Command | What it does |
| --- | --- |
| `npm run data` | Generate `public/data/*.json` (deterministic; `scripts/generate-data.mjs`) |
| `npm run check:data` | Assert every planted story figure in the data |
| `npm run build` | Data + story check → typecheck → `dist/` → bundle bridge tools |
| `npm run dev` | Vite dev server (API-key mode; the bridge also accepts localhost origins) |
| `npm run bridge` | Bridge only, on 127.0.0.1:5317 (serves `dist/`) |
| `npm test` | Unit tests: 22 tools vs. the 18 scenarios, providers, CLI parsers |
| `npm run test:e2e` | Playwright: every view × light/dark × ar/en, map, agent flows, bridge with a fake CLI |
| `npm run check:i18n` | ar/en keys match, no hard-coded UI text, logical CSS only |
| `node scripts/smoke-bridge.mjs` | Cross-platform bridge smoke test (used by CI on macOS and Windows) |

Main layout:

```
src/lib/metrics.ts      pure functions — the screens and the agent tools share them
src/agent/tools.ts      the 22 tools (spec/04-AGENT.md)
src/agent/providers/    anthropic.ts · openai.ts · bridge.ts
src/views/              the 13 views; map/ holds the SVG store map
src/i18n/ar.json, en.json   all UI text
bridge/                 local bridge: server.mjs, cli-claude.mjs, cli-codex.mjs, mcp-tools.mjs
scripts/                data generator (patched copy of spec/03), checks, demo launcher, smoke test
spec/                   the original brief (unchanged)
```

The static `dist/` also works on any static host in API-key mode. Subscription mode needs the local bridge.

## Known limits

- Live model answers have not been tested in this build: no key or CLI login was available. The tool layer is unit-tested against every scenario, and the agent loops are tested with simulated streams. See `DEV-NOTES.md`.
- The macOS and Windows checks run in CI (build, unit tests and a bridge smoke test with a fake CLI). Running a real logged-in CLI on each OS is a manual check: open Settings → Subscription → *Test connection*, then ask one question.
