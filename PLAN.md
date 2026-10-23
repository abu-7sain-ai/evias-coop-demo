# PLAN.md — E-VIAS Coop Demo (Phase 1)

Status: **waiting for approval.** No code is written until the owner approves this plan and answers the open questions (bottom of this file).

Sources: `spec/00`–`spec/06` plus the owner's added requirements (2026-10-23):

- **R1:** Agent settings offer two modes:
  - (a) **Subscription:** a local bridge that calls the Claude Code CLI or the Codex CLI on the same computer.
  - (b) **API key:** Anthropic or OpenAI.
- **R2:** The demo runs on **macOS and Windows**.

---

## 0. What I found while studying (generator run in a scratch folder, not in the repo)

I ran `spec/03-generate-data.mjs` into a scratch folder and checked each planted story against the output. Several stories **do not hold** in the data as generated. The rule is that the screens, the agent and `05-SCENARIOS.md` must never disagree, so each mismatch needs a decision (see questions Q1–Q8).

| # | Story | Spec says | Data actually gives |
| --- | --- | --- | --- |
| 1 | Khalid favours one phone | 9 invoices this month, same phone | The friend's phone appears on **16** of Khalid's sales in the last 30 days: the 9 planted ones plus 7 random ones. Another phone is tied at 16. Random sales by other cashiers also use the friend's phone. The pattern does not stand out. |
| 1b | Post-cash voids "this month" | 6 this month | 6 exist, but they are spread over 90 days. **Only 1** falls in the last 30 days. |
| 2 | Tuesday PM shortage | 13/13 disputed, ≈ −8 KD, 3 no-sale opens | ✅ 13/13, −8.075 KD average |
| 3 | LOT-4471 yogurt | 3 complaints, 96 units, expires in 6 days | ✅ |
| 4 | Margin leaks | 14 products, P054 −0.227, P045 −0.173 | ✅ exact |
| 5 | Juice promo | 90 sold / 180 KD saved | ✅ (hard-coded) |
| 6 | Dead shelf (saffron P049) | 61 days without a sale | ❌ P049 has **430 sale lines** in branch B1 in the last 61 days. Random sales pick every product. |
| 8 | "The second shelf" A02-END-C2 | traffic top-5 in branch | ❌ ranks **17th of 98** by traffic base (78). Top 5: A06-END-C2 98, ENT-MAIN 95, A06-END-C1 95, VEST 90, CH-03/04 88. Sales per metre is undefined because sales are not linked to fixtures. |
| 9 | M-07 arrears | 2 × 530 KD, oldest 45 days | ✅; M-16 ≈ 400 KD/month ✅ |
| 12 | Thursday queue | ≈ 8 per lane with 6 lanes; ≈ 6 with 8 lanes | ❌ The formula `traffic × 0.09` gives ≈ **12.9** per lane: Thursday 20:00 POS score ≈ 143 × 0.09. The 8 → 6 ratio only works if the constant is calibrated. |
| 13 | SUP-12 scorecard | short deliveries **2** | ❌ the generator has **4**. A code comment says "short twice". |
| 16 | C3 waste | ≈ 3× **network average** | ❌ C3 is 1,789 KD and the network average is 1,004 KD, so **1.8×**. C3 is 2.9× the average of the *other two* coops. |
| 17 | Ghost employees | 6, ≈ 2,400 KD/month | ✅ 6, 2,496 KD |
| — | No produce | no vegetables anywhere | ❌ `P052 خضار مشكلة / Mixed frozen veg` exists. |
| — | Dates | "this month" | The demo date is **2026-11-01**, so "this month" (November) holds one day. "Rent collected vs due (month)" has nothing due in November: invoices fall due on the 17th. |
| — | Dashboard script | "waste down, rent up, variance up (red)" | The direction of the deltas is random in the data. It is not guaranteed. |

**Proposed fix (Q1):** copy the generator to `scripts/generate-data.mjs` and patch only the story injections above. The original stays untouched in `spec/` and gets a backup in `_backup/`. Every patch is listed in `DECISIONS.md` and marked `// STORY-FIX`. Generation stays deterministic.

---

## 1. Architecture

```
┌───────────────────────────── Browser (React SPA) ─────────────────────────────┐
│ views ─► useData() (Zustand) ◄── public/data/*.json                            │
│            │                                                                    │
│            └─► src/lib/metrics.ts (pure fns) ◄── src/agent/tools.ts (22 tools)  │
│                                                                                 │
│ Agent panel ─► AgentProvider interface                                          │
│   ├─ AnthropicApiProvider  → https://api.anthropic.com/v1/messages (stream+tools)│
│   ├─ OpenAiApiProvider     → https://api.openai.com/v1/... (stream+tools)        │
│   └─ BridgeProvider        → http://127.0.0.1:<port>/agent (SSE)                 │
└───────────────────────────────────────────────────────────────────────────────┘
                                         │ (subscription mode only)
┌──────────────── Local bridge (Node, same computer) ──────────────────────────┐
│ bridge/server.mjs: serves dist/ + /agent + /health, bound to 127.0.0.1 only    │
│ spawns:  claude -p … --mcp-config <evias tools>   OR   codex exec … (MCP)       │
│ bridge/mcp-tools.mjs: MCP server exposing the SAME 22 tools                     │
│   (bundled from src/agent/tools.ts + src/lib/metrics.ts with esbuild)           │
└───────────────────────────────────────────────────────────────────────────────┘
```

Key points:

- **One tool implementation.** `src/agent/tools.ts` calls `src/lib/metrics.ts`. The browser imports it directly (API modes). The bridge runs an esbuild bundle of the same files as an MCP stdio server (subscription mode). This keeps the "screens and agent never disagree" rule in all three modes.
- **The browser runs the tool loop in API mode** (≤ 6 rounds, 1500 tokens out, temperature 0.2, last 12 messages), as `01-SPEC §5.1` describes. Both providers share one loop with provider-specific adapters:
  - Anthropic: `tool_use` / `tool_result`
  - OpenAI: function calls
- **The CLI runs the tool loop in subscription mode**, calling our MCP tools. The bridge turns the CLI's streamed JSON events into one SSE format for the browser: text deltas, tool calls (for the "Sources" line), usage, and errors.
- **Guardrails are the same in every mode:** the verbatim system prompt from `04-AGENT.md`, the same tools, and the same refusal lines. In subscription mode the CLI is locked down:
  - its built-in tools (shell, file edit, web) are disabled
  - only the `evias` MCP server is allowed
  - it runs in an empty temp working directory
  - the user's CLAUDE.md, settings and other MCP servers are ignored
  - the exact flags are verified against the installed CLI versions in Phase 2; see Risks
- **Rule 8 of the prompt** ("never mention Anthropic or the model name") is kept. The Settings page has to name the providers. That is UI, not agent output.

### Settings → Agent (replaces `01-SPEC §4.12` "Agent API key")

```
Connection mode:  ( ) Subscription (local bridge)   ( ) API key

Subscription:
  CLI:  [Claude Code ▾ | Codex]
  Bridge status chip: "Connected · claude 2.x found" / "Bridge not running" / "CLI not found" / "CLI not logged in"
  [Test connection]
  Help text: how to start the bridge on macOS / Windows (one command / double-click file)

API key:
  Provider: [Anthropic ▾ | OpenAI]
  Key: [••••••••] [Save] [Clear key]   chip "Key set (sk-…last4)" / "No key"
  Model: [preset list ▾] (see Q9)
  Text: "The key stays in this browser only and is sent only to api.anthropic.com / api.openai.com. Use a demo key with a spending limit."
```

localStorage keys:

| Key | Holds |
| --- | --- |
| `evias.agent_mode` | `bridge` or `api` |
| `evias.bridge_cli` | which CLI the bridge calls |
| `evias.api_provider` | `anthropic` or `openai` |
| `evias.anthropic_key` | Anthropic key |
| `evias.openai_key` | OpenAI key |
| `evias.model.anthropic` / `evias.model.openai` | chosen model per provider |

Keys are never logged, never sent to the bridge, and never written to files.

### macOS + Windows (R2)

- Pure Node 20+ and the browser. There are no native modules and no shell scripts in the build path. All paths go through `path.join`.
- The bridge spawns CLIs with `cross-spawn`. Windows global npm installs are `.cmd` shims, which plain `spawn` cannot run without a shell.
- One command for both OSes: `npm run demo` builds if needed, starts the bridge (serving `dist/` plus `/agent` on `http://127.0.0.1:5317`) and opens the browser.
- Double-click launchers: `start-demo.command` (macOS) and `start-demo.bat` (Windows). See Q11.
- Serving the app and the bridge from the same origin avoids CORS and Chrome's local-network-access prompts. Those prompts would appear if a page hosted on Vercel called `localhost`.
- The static `dist/` still works on any host in API-key mode (relative `base: './'`).

---

## 2. Files to create

```
PLAN.md  DEV-NOTES.md  DECISIONS.md  README.md (rewritten; original backed up)
package.json  vite.config.ts  tsconfig*.json  tailwind.config.ts  postcss.config.js  index.html
start-demo.command  start-demo.bat
scripts/generate-data.mjs        (patched copy of spec/03, see §0)
scripts/build-bridge-tools.mjs   (esbuild bundle of tools for the MCP server)
scripts/check-stories.mjs        (asserts every planted figure in public/data — the data test)
public/data/*.json               (generated, 35 files, ~12 MB)
bridge/server.mjs  bridge/cli-claude.mjs  bridge/cli-codex.mjs  bridge/mcp-tools.mjs
src/main.tsx  src/App.tsx
src/i18n/ar.json  src/i18n/en.json  src/i18n/index.ts
src/store/ui.ts (theme, lang, coop, branch, role, agent settings)  src/store/data.ts (useData)
src/lib/metrics.ts  src/lib/format.ts (Latin digits, 3-decimal KD)  src/lib/types.ts
src/agent/tools.ts  src/agent/prompt.ts  src/agent/loop.ts
src/agent/providers/{anthropic,openai,bridge}.ts
src/components/shell/{Topbar,Sidebar,Footer,RoleSelect}.tsx
src/components/ui/{KpiCard,DeltaPill,Table,Chip,Drawer,Tabs,SidePanel}.tsx
src/components/agent/{AgentDrawer,Message,SourcesLine,KeyCard,SuggestedChips}.tsx
src/views/{Dashboard,StoreMap,Spaces,ShelvesSuppliers,Inventory,Sales,Finance,Members,Staff,Complaints,Ministry,Settings}.tsx
src/views/map/{FloorSvg,Layers,TrafficControls}.tsx
tests/e2e/*.spec.ts              (Playwright)
tests/unit/metrics.test.ts  tests/unit/tools.test.ts  tests/unit/providers.test.ts  (Vitest)
_screenshots/reference/  _screenshots/current/
```

Existing files touched: only `README.md` (backed up to `_backup/README.md.bak-<date>` first). `spec/` is not modified.

New dependencies (npm, needs network):

- **App:** react, react-dom, typescript, vite, @vitejs/plugin-react, tailwindcss, postcss, autoprefixer, zustand, i18next, react-i18next, recharts, lucide-react, react-markdown, remark-gfm
- **Bridge:** cross-spawn, @modelcontextprotocol/sdk, esbuild
- **Tests:** vitest, @playwright/test (uses the pre-installed Chromium; no browser download)

---

## 3. Build order (Phase 2)

1. Patch generator → `public/data/` → `scripts/check-stories.mjs` passes every story figure.
2. Scaffold Vite/React/TS/Tailwind and the theme tokens. Theme and language toggles go first: `dir` flip, Latin digits, IBM Plex fonts.
3. Shell: topbar, sidebar (13 items), role selector (14 roles; Ministry visible to the first 3), coop/branch selectors, footer disclaimer.
4. `metrics.ts` + Dashboard: 8 KPIs with deltas and inverted colours, 30-day line chart, 7×16 heatmap, Priorities list with "Ask the agent".
5. Store map: G + M floors in SVG, 5 layers, day picker + hour slider, side panel, tooltips.
6. Remaining views 4.3–4.12.
7. `tools.ts` (22 tools, ≤ 60 rows each) and Vitest checks of each tool against the planted figures.
8. Agent drawer + API mode (Anthropic and OpenAI): streaming, tool loop, Sources line, token counter, error messages (401 / 429 / network).
9. Bridge + MCP tools + Claude Code / Codex adapters, launchers, Settings mode switch.
10. Scenario run (18 questions + 7 guardrails) in every mode I can reach (see Testing). Screenshots, DEV-NOTES, DECISIONS, report.

---

## 4. How each part is tested

| Part | Test | Proof |
| --- | --- | --- |
| Data | `node scripts/check-stories.mjs` asserts every figure in `05-SCENARIOS.md` (9 invoices, 6 voids, 13/13, −8 KD, 14 leaks, 61 days, top-5, 45 days, 2 × 530, 33 %/4/2/3, 4 breaches, ~3×, 6 ghosts, ≈ 8 → 6 queue, no produce) | script output |
| Build | `npm run build`, 0 TS errors; `tsc --noEmit` | log |
| metrics / tools | Vitest: each of the 22 tools returns the planted figures and ≤ 60 rows; screens and tools call the same function | test output |
| Providers | Vitest with mocked `fetch`: Anthropic and OpenAI stream parsing, tool loop stops at 6 rounds, 401/429 messages; bridge SSE parsing from recorded CLI event fixtures | test output |
| i18n | Script fails if any `.tsx` has a literal Arabic/English UI string or `ml-`/`mr-`/`pl-`/`pr-` classes; ar/en key sets are identical | script output |
| UI | Playwright, every view × {light, dark} × {ar, en}: no console errors, footer present, no overflow or clipping (bounding-box checks), plus my own look at each screenshot | `_screenshots/reference/` then `current/` |
| Map | Playwright: click A02-END-C2 and M-07 → panel shows JSON values; move slider to Thu 20:00 → entrance, checkout and dairy cells are the hottest | screenshots |
| Agent API mode | Live run of all 18 scenarios + 7 guardrails **only if the owner gives a demo key for this session** (Q13); otherwise mocked runs only and reported as not live-tested | transcript + screenshots |
| Agent subscription mode | Claude Code CLI is installed in this container. I can test the bridge end to end with it only if it is logged in here (Q13). Codex is **not** installed here. | transcript |
| macOS / Windows | I am on Linux. I cannot run on macOS or Windows here, so I will not claim it is tested. Cross-platform coding rules (cross-spawn, path.join, no bash in npm scripts) plus a GitHub Actions matrix (macos-latest, windows-latest) that runs build + unit tests + a bridge smoke test with a fake CLI (Q12). The real-CLI check on each OS is a manual step for the owner, with a checklist in README. | CI log |

---

## 5. Permissions I need (Phase 2)

- **Network:**
  - `npm install` (registry)
  - Google Fonts at runtime. Fonts can be self-hosted instead, see Q10.
- **File writes:** in this repo only. Records go to `_backup/`, `_screenshots/`, `DEV-NOTES.md` and `DECISIONS.md`.
- **Recycle bin:** there is no OS recycle bin in this cloud container. I propose `_trash/` (git-ignored) as the "recycle bin" (Q14).
- **Running:**
  - the Vite dev/preview server and the bridge on 127.0.0.1
  - Playwright with the pre-installed Chromium. I will use Playwright directly; the Playwright *MCP* is not configured in this session.
- **Git:** commit and push to `claude/compassionate-goldberg-xaoj32` only. No PR unless you ask.
- **Not needed:** OS settings, global installs, any real API key in code.

---

## 6. Risks

1. **CLI flags.** The flags that lock the Claude Code / Codex CLI down need checking against the installed versions. These are: disable built-in tools, replace the system prompt, strict MCP config, ignore user settings, stream JSON. Codex in particular may not allow a full system-prompt replacement. In that case our prompt goes in as developer instructions, and the guardrail tests show whether that is enough. I will report the result honestly.
2. **Speed.** Subscription mode starts one CLI process per question, so the first token comes slower than with the API (expect a few seconds). The run-sheet's "pre-warm" advice still applies.
3. **Data size.** The data is about 12 MB of JSON (`sale_items` 5.8 MB). It loads once and is fine on a laptop. If first load feels slow, I can gzip-serve it or pre-aggregate it; that would be a new decision and goes in DECISIONS.md.
4. **Spec model list.** The spec offers `claude-sonnet-4-5 / haiku-4-5 / opus-4-1`. These are older models (Q9).

---

## Open questions (must be answered before Phase 2)

See the message that accompanies this plan. The answers will be recorded here.
