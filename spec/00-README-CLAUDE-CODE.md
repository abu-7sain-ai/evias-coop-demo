# E-VIAS Coop Platform — Government Demo

Build brief for Claude Code. Read every file in this folder before writing code.

## What this is

A static, bilingual (Arabic RTL / English LTR) demo web app for the Kuwait cooperative-society ERP platform "E-VIAS". It runs entirely in the browser on generated fake data, has an interactive store map, a KPI dashboard with up/down indicators, and a working AI agent ("الوكيل") that answers questions about the demo data through the Anthropic API using an API key the presenter pastes in.

It will be shown to a government ministry. Nothing is real: no backend, no real integrations, no real transactions.

## Files in this folder

| File | What it holds |
| --- | --- |
| `00-README-CLAUDE-CODE.md` | This brief, stack, build order, acceptance checks |
| `01-SPEC.md` | Product spec: pages, layout, components, theming, i18n, API-key handling |
| `02-FLOORPLAN.md` | The branch geometry: 60 m × 30 m, two floors, every fixture with coordinates |
| `03-generate-data.mjs` | Deterministic seed-data generator → `public/data/*.json` (3 coops, 90 days of sales, planted stories) |
| `04-AGENT.md` | Agent system prompt, tools, guardrails, bilingual behaviour |
| `05-SCENARIOS.md` | The planted stories, the exact questions the presenter will ask, and the expected answers |
| `06-WORKING-RULES.md` | How you must work: two phases, backups, no secrets, DEV-NOTES, DECISIONS, the DONE / NOT DONE line |

**Read `06-WORKING-RULES.md` first. Phase 1 (study + PLAN.md + questions) must finish and be approved before any code is written.**

## Stack (do not change)

- Vite + React 18 + TypeScript
- Tailwind CSS (with `rtl:` variants via `tailwindcss-rtl` or logical properties)
- Zustand for state (theme, language, selected coop/branch, API key)
- `react-i18next` for strings; all UI strings live in `src/i18n/ar.json` and `src/i18n/en.json`
- SVG rendered by React for the store map (no canvas libs)
- Recharts for charts
- Anthropic API called directly from the browser via `fetch` (see `01-SPEC.md` → Agent & API key)
- No router library needed; a single-page app with a sidebar that switches views (match the existing demo)
- Deploy target: static hosting (Vercel/Netlify). `npm run build` must produce a `dist/` that works from any path.

## Build order

1. Run `node 03-generate-data.mjs` → confirm `public/data/` has all JSON files listed at the bottom of that script.
2. Scaffold Vite + React + TS + Tailwind. Implement theme (light/dark) and language (ar/en) toggles first; everything else inherits from them.
3. Shell: sidebar + topbar + role selector, exactly as described in `01-SPEC.md` § Shell.
4. Dashboard view (KPI cards with up/down deltas, charts).
5. Store map view (ground floor + mezzanine, click → side panel, colour layers, time slider for traffic).
6. Spaces & leasing view, Shelves view, Suppliers, Inventory, Sales, Finance, Members, HR, Ministry views.
7. Agent panel: API-key settings, chat UI, tool execution over the JSON data, streaming responses.
8. Run through every question in `05-SCENARIOS.md` and confirm the agent answers with the planted numbers.

## Acceptance checks

- [ ] `npm run build` succeeds with zero TypeScript errors.
- [ ] Switching language flips the whole layout direction and every string; no hard-coded Arabic or English in components.
- [ ] Light theme base `#F5F6F7`, dark theme base `#1C1E21`; toggle persists in `localStorage`.
- [ ] Store map: 60×30 m ground floor and mezzanine render; clicking any fixture or shop opens its panel with data from JSON.
- [ ] Traffic layer changes when the day/hour slider moves; Thursday 19:00–21:00 is visibly the busiest.
- [ ] Dashboard KPIs show a delta arrow vs. previous week, green up / red down (and inverted for "bad" metrics like waste).
- [ ] Agent refuses anything outside the demo data with the exact refusal text in `04-AGENT.md`.
- [ ] Agent answers all 18 scenario questions in `05-SCENARIOS.md` with the planted figures.
- [ ] API key is stored only in `localStorage`, never in code, never sent anywhere but `api.anthropic.com`; "Clear key" button works.
- [ ] Every screen carries the footer line: AR "ديمو مستقل ببيانات اصطناعية؛ لا ينفذ معاملات على أنظمة خارجية." / EN "Standalone demo with synthetic data; no transactions on external systems."
- [ ] No mention of vegetables/produce anywhere (no الخضار section, no produce products).
