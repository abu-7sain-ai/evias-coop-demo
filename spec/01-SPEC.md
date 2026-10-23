# 01 — Product Spec

## 1. Design language

Keep the visual identity of the existing E-VIAS demo: calm, institutional, dense with information, no decoration for its own sake.

### Colours

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg` | `#F5F6F7` | `#1C1E21` | page background |
| `surface` | `#FFFFFF` | `#25282C` | cards, panels, sidebar |
| `surface-2` | `#ECEEF0` | `#2E3136` | table header, hover |
| `border` | `#DDE0E4` | `#3A3E44` | hairlines |
| `text` | `#1C1E21` | `#ECEEF0` | primary text |
| `text-2` | `#5F6672` | `#A0A7B1` | secondary text |
| `accent` | `#0F5C4D` | `#2FA58C` | brand green (buttons, active nav, agent) |
| `accent-soft` | `#E3F1ED` | `#163C34` | accent tint |
| `good` | `#1E8E5A` | `#3CC98A` | up arrows, healthy |
| `warn` | `#B7791F` | `#E0A94A` | expiring, watch |
| `bad` | `#C0392B` | `#F0665A` | down arrows, late, critical |
| `info` | `#2C5AA0` | `#6C9BE8` | reserved, neutral highlight |

Theme is set with `data-theme="light|dark"` on `<html>`, follows `prefers-color-scheme` on first visit, persists in `localStorage("evias.theme")`.

### Type

Arabic: `IBM Plex Sans Arabic` (Google Fonts). English: `IBM Plex Sans`. Numbers always in Latin digits (0-9), never Arabic-Indic, in both languages. Money: `1,234.500 KD` / `1,234.500 د.ك` with 3 decimals.

### Spacing & shape

8-px grid, cards `rounded-xl`, 1-px borders, no drop shadows except the agent drawer. Tables are dense (`py-2`). Icons: `lucide-react`.

## 2. Language

- `react-i18next`, strings in `src/i18n/ar.json` and `src/i18n/en.json`. No literal UI text in components.
- `dir` on `<html>` flips with language. Use logical CSS (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`), never `ml/mr` for layout.
- Data records carry both `name_ar` and `name_en`; display by current language.
- Persist in `localStorage("evias.lang")`. Default: Arabic.
- The agent replies in the language of the question (see `04-AGENT.md`).

## 3. Shell (match the existing demo)

```
┌──────────────────────────────────────────────────────────────┐
│ topbar: [E-VIAS logo] [coop selector ▾] [branch selector ▾]   │
│         [role selector ▾] [search] [lang] [theme] [الوكيل ●]  │
├────────────┬─────────────────────────────────────────────────┤
│ sidebar    │ view                                             │
│ nav items  │                                                  │
│            │                                                  │
│            │                                                  │
├────────────┴─────────────────────────────────────────────────┤
│ footer disclaimer                                            │
└──────────────────────────────────────────────────────────────┘
```

Sidebar order (AR / EN):

1. لوحة المعلومات / Dashboard
2. الوكيل / Agent
3. خريطة الفرع / Store Map
4. المساحات والإيجارات / Spaces & Leasing
5. الرفوف والموردون / Shelves & Suppliers
6. المخزون والصلاحية / Inventory & Expiry
7. المبيعات ونقاط البيع / Sales & POS
8. المالية / Finance
9. المساهمون / Members
10. الموظفون والحضور / Staff & Attendance
11. الشكاوي / Complaints
12. لوحة الوزارة / Ministry
13. الإعدادات / Settings

Role selector options (changes which views are visible, cosmetic only): مشرف المنصة (Ministry Admin), مفتش (Inspector), مدقق (Auditor), مدير الجمعية (Coop Admin), رئيس مجلس الإدارة (Chair), أمين الصندوق (Treasurer), المحاسب (Accountant), المشتري (Purchaser), مسؤول المساحات (Leasing Officer), الموارد البشرية (HR), مدير الفرع (Branch Manager), الكاشير (Cashier), أمين المخزن (Stockkeeper), المورد (Supplier). Ministry view is visible only to the first three roles.

Coop selector: the 3 coops from the data. Branch selector: that coop's branches (+ "All branches").

## 4. Views

### 4.1 Dashboard

Top row: 8 KPI cards. Each card: label, big number, unit, and a delta pill vs. the previous 7 days: `▲ 4.2%` in `good` or `▼ 3.1%` in `bad`. For metrics where down is good (waste, voids, variance, arrears, vacancy days) invert the colours. Metrics:

| Metric | Source |
| --- | --- |
| Sales (7d) | sales.json |
| Gross margin % | sales + products cost |
| Waste value (7d) | writeoffs.json |
| Void/refund rate | sales.json flags |
| Shift variance (7d) | shifts.json |
| Rent collected vs due (month) | lease_invoices.json |
| Attendance rate | attendance.json |
| Expiring within 14d (value) | lots.json |

Below: two charts side by side — daily sales last 30 days (line, per branch) and hourly traffic heatmap for the selected branch (day × hour grid, 7×16). Then a "Priorities today" list fed from `agent_alerts.json` (the planted stories, each with an "Ask the agent" button that opens the agent with the question pre-filled).

### 4.2 Store Map

Two tabs: Ground floor / Mezzanine. Render from `floorplan.json` (generated from `02-FLOORPLAN.md`). SVG `viewBox="0 0 60 30"` scaled to fit; 1 unit = 1 metre.

Layers (toggle chips above the map):

- **Supplier** — each reserved shelf coloured by supplier; unreserved grey.
- **Stock** — green full / amber low / red empty, from `stock_locations.json`.
- **Expiry** — shelves holding lots expiring ≤ 14 days in `warn`, ≤ 7 in `bad`.
- **Traffic** — heatmap of footfall; a day picker (Sat–Fri) and an hour slider (08:00–23:00) drive it from `traffic.json`. Thursday & Friday 19:00–21:00 must be visibly hottest at the entrance, checkout and the dairy aisle.
- **Contracts** (mezzanine) — shop status colours: available `info`, reserved `info` hatched, leased `good`, expiring soon `warn`, in arrears `bad`, out of service grey.

Click any fixture/shop → side panel: code, type, supplier/tenant, contract dates & rent, products & facings, qty on shelf vs. warehouse, nearest expiry, sales last 30 days, traffic score, and a "Ask the agent about this" button.

Hover shows a tooltip with code + name.

### 4.3 Spaces & Leasing

Table of all investment spaces (shops, kiosks, lobby, ad spaces, shelves, storage) with type, floor, area m², tenant, monthly rent, start, end, status, days to expiry, arrears. Filters by type and status. Row click → same side panel as the map. Summary cards: occupancy %, monthly rent roll, arrears total, vacant days this year.

### 4.4 Shelves & Suppliers

Left: supplier list with score (on-time %, short deliveries, near-expiry deliveries). Right: shelf reservations table (fixture code, level, supplier, rent, ends, sales/m, traffic). Highlight `A02-END` (end-cap, contract ends in 45 days) with a `warn` badge.

### 4.5 Inventory & Expiry

Lots table: product, branch, location code, qty, expiry, daily demand, projected surplus, value at risk (= surplus × cost). Tabs: All / ≤7 days / ≤14 days / ≤30 days / Stagnant > 60 days. Each row: suggested action chip (promo type / transfer / return / remove). Promo results table from `promotions.json` (planned vs. sold vs. saved).

### 4.6 Sales & POS

Branch cards (sales today, lanes open, queue estimate at selected hour). Sales table (paginated, 90 days). Voids/refunds table with cashier, approver, reason, time since sale. Shift table with opening float, expected, counted, variance, approver, status; Tuesday evening shifts of cashier `khalid` show the variance story.

### 4.7 Finance

Supplier invoices with 3-way match status and the two-signature approval state (`reviewed → chair → treasurer`). Journal entries list. Trial balance (static from JSON). Rent invoices & receipts.

### 4.8 Members

Members table (membership no., name, class, shares, share value, YTD purchases, voting eligibility, last purchase). Dividend simulation card: YTD purchases × rebate % + shares × share dividend %. "Unregistered sales %" KPI.

### 4.9 Staff & Attendance

Employees, schedules, punches. Attendance grid (employee × day) with late/absent/no-punch-out markers. Ghost-employee story visible in coop 3: 6 salaried employees with zero punches.

### 4.10 Complaints

Tickets with category, priority, assignee, due, status, SLA breach flag. Three complaints on lot `LOT-4471`.

### 4.11 Ministry (demo only)

Banner at top: AR "عرض توضيحي — لا اتصال فعلي بأنظمة الوزارة" / EN "Illustrative view — no live connection to ministry systems". Table comparing the 3 coops on: sales, waste %, void rate, variance, subsidized price breaches, rent arrears, attendance, vacant spaces. Alerts feed. Subsidized price breaches table (rice at 4 branches). Inspector notes list.

### 4.12 Settings

- Theme, language.
- **Agent API key**: password-style input, "Save" stores to `localStorage("evias.anthropic_key")`, "Clear key" removes it. Status chip: "Key set (sk-…last4)" / "No key". Text under the field (AR/EN): "The key stays in this browser only and is sent only to api.anthropic.com. Use a demo key with a spending limit."
- Model selector: default `claude-sonnet-4-5`, options `claude-haiku-4-5`, `claude-opus-4-1`.
- "Reset demo data" (reloads JSON, clears chat).

## 5. Agent panel

- Opens as a right-side drawer (left in RTL) from the topbar button or the sidebar item; stays open while navigating.
- Header: "الوكيل · E-VIAS Intelligence", model chip, clear-chat button.
- If no key: show a card linking to Settings with the key field inline.
- Suggested question chips (from `05-SCENARIOS.md`, 6 shown, "more" expands).
- Messages: user bubbles and agent bubbles; agent bubbles render markdown (tables allowed) and show a small "Sources" line listing the tool calls made (e.g. `sales(branch=B1, cashier=khalid)`).
- Streaming responses.
- Context awareness: when opened from a map fixture or a priority card, the first message is pre-filled with that question and the fixture/record id is passed to the agent as `context`.

### 5.1 API call

```ts
fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  },
  body: JSON.stringify({ model, max_tokens: 1500, system, messages, tools, stream: true }),
});
```

Implement the tool-use loop client-side: when the model returns `tool_use`, run the matching function in `src/agent/tools.ts` over the loaded JSON, append `tool_result`, call again. Max 6 tool rounds per question.

System prompt and tools: see `04-AGENT.md`.

## 6. Data loading

All JSON under `public/data/` is fetched once at startup into a Zustand store `useData()`. Derived aggregates (KPIs, deltas, heatmap, projections) are computed in `src/lib/metrics.ts` with pure functions so the agent tools reuse the same numbers the screens show. **The screens and the agent must never disagree on a number.**

## 7. Footer

Every view ends with the disclaimer line (AR/EN in `00-README`). The Ministry view adds the "illustrative" banner on top as well.
