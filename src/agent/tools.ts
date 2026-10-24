// The 22 agent tools (spec/04-AGENT.md). Thin wrappers over src/lib/metrics.ts — the same functions the screens use.
// Used by the browser (API-key mode) and, bundled by scripts/build-bridge-tools.mjs, by the local bridge's MCP server.
import * as M from "../lib/metrics";
import type { Data, Day, Scope } from "../lib/types";

export const MAX_ROWS = 60;

type Json = Record<string, unknown>;
export interface ToolDef { name: string; description: string; input_schema: { type: "object"; properties: Record<string, Json>; required: string[] } }

const COOP = { coop_id: { type: "string", description: 'Coop id: "C1", "C2", "C3", or "ALL" for the ministry network view.' }, branch_id: { type: "string", description: 'Optional branch id, e.g. "C1-B1".' } };
const def = (name: string, description: string, props: Record<string, Json> = {}, required: string[] = []): ToolDef =>
  ({ name, description, input_schema: { type: "object", properties: { ...COOP, ...props }, required: ["coop_id", ...required] } });
const DAY_ENUM = { type: "string", enum: M.DAYS };

export const TOOL_DEFS: ToolDef[] = [
  def("get_kpis", "The 8 dashboard KPIs (sales, gross margin %, waste, void/refund rate, shift variance, rent collected vs due, attendance rate, value expiring ≤14d) with delta % vs the previous period.", { period_days: { type: "integer", enum: [7, 30] } }),
  def("sales_summary", "Sales grouped by day, branch, cashier, product, payment or hour: revenue, cost, margin, invoices, units.", { from: { type: "string", description: "YYYY-MM-DD inclusive" }, to: { type: "string", description: "YYYY-MM-DD exclusive" }, group_by: { type: "string", enum: ["day", "branch", "cashier", "product", "payment", "hour"] } }, ["group_by"]),
  def("cashier_anomalies", "Per cashier: invoices, invoices with line voids, voids after cash payment, refunds, same_phone_repeats (most repeated customer phone on invoices with line voids), approver concentration, vs branch average.", { period_days: { type: "integer", description: "default 30 (= this month)" } }),
  def("shift_variances", "Cash-drawer shifts with variance beyond tolerance, grouped by cashier, weekday and shift, with no-sale drawer opens.", { period_days: { type: "integer", description: "default 90" }, cashier_id: { type: "string" } }),
  def("margin_leaks", "Products where cost > price or margin < 3%, with cost change date, old/new cost and units sold since."),
  def("expiry_risk", "Lots expiring within N days: qty, daily demand, projected surplus, value at risk, suggested action.", { days: { type: "integer", enum: [7, 14, 30] } }, ["days"]),
  def("lot_lookup", "One lot: details, linked complaints, promotions and supplier.", { lot_id: { type: "string" } }, ["lot_id"]),
  def("shelf_performance", "Shelf fixtures in the mapped branch: supplier reservation, rent, 30-day sales, sales per metre vs branch median, traffic score and rank, days to contract end, stagnant products.", { fixture_id: { type: "string" }, sort: { type: "string", enum: ["sales_per_m", "traffic", "stagnant"] } }),
  def("space_status", "Investment spaces (shops, kiosks, lobby, ads) with tenant, rent, days to expiry, arrears, vacant days, occupancy summary.", { type: { type: "string", enum: ["shop", "kiosk", "lobby", "ad"] }, status: { type: "string", enum: ["leased", "expiring", "arrears", "reserved", "available"] } }),
  def("rent_arrears", "Overdue rent invoices with tenant, amount, days late and escalation stage."),
  def("supplier_scorecard", "Supplier on-time %, late count, short deliveries, near-expiry deliveries, open invoices, shelf rents.", { supplier_id: { type: "string" } }),
  def("traffic_query", "Footfall scores in the mapped branch; peak = top 5 fixture/day/hour combos; queue estimate per lane.", { day: DAY_ENUM, hour: { type: "integer", minimum: 8, maximum: 23 }, fixture_id: { type: "string" } }),
  def("staffing_suggestion", "Hourly checkout traffic vs scheduled cashiers for one weekday; hours where queue > 6 per lane.", { day: DAY_ENUM }, ["day"]),
  def("attendance_summary", "Per employee: scheduled, present, late, absent, no punch-out, zero-punch flag, late pattern by weekday.", { period_days: { type: "integer" }, employee_id: { type: "string" } }),
  def("ghost_employees", "Salaried employees with zero punches in the period (90 days)."),
  def("complaints_query", "Complaint tickets with SLA state; clusters by lot.", { status: { type: "string" }, lot_id: { type: "string" }, product_id: { type: "string" } }),
  def("promotion_results", "Ended promotions (planned vs sold vs waste avoided), promotions on hold, drafts awaiting approval."),
  def("seasonal_forecast", "Days until the event, last-year multipliers per product, current stock cover in days, draft PO lines.", { event: { type: "string", enum: ["ramadan"] } }),
  def("member_lookup", "Member profile (by id or phone) or coop member summary: YTD purchases, shares, projected dividend, unregistered sales %.", { member_id: { type: "string" }, phone: { type: "string" } }),
  def("subsidized_breaches", "Branches selling subsidized goods above the ministry cap: product, cap, sold price, invoices."),
  def("ministry_compare", "The 3 coops ranked on one metric with the network average and the ratio to the other coops.", { metric: { type: "string", enum: M.MINISTRY_METRICS } }, ["metric"]),
  def("finance_queue", "Supplier invoices by approval stage (reviewed → chair → treasurer); 3-way-match exceptions."),
];

const cap = <T>(rows: T[], n = MAX_ROWS) => (rows.length > n ? { rows: rows.slice(0, n), truncated: true, total_rows: rows.length } : { rows, truncated: false, total_rows: rows.length });
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const int = (v: unknown, dflt: number) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Math.round(Number(v)) : dflt);

function salesSummary(d: Data, s: Scope, from: string, to: string, groupBy: string) {
  const I = M.idx(d);
  const inBranch = new Set(M.branchesInScope(d, s).map((b) => b.id));
  const sales = d.sales.filter((x) => inBranch.has(x.branch_id) && x.date >= from && x.date < to);
  const daily = d.daily_sales.filter((x) => inBranch.has(x.branch_id) && x.date >= from && x.date < to);
  const acc = new Map<string, { revenue: number; cost: number; invoices: number; units: number }>();
  const add = (k: string, rev: number, cost: number, inv: number, units: number) => { const a = acc.get(k) ?? { revenue: 0, cost: 0, invoices: 0, units: 0 }; a.revenue += rev; a.cost += cost; a.invoices += inv; a.units += units; acc.set(k, a); };
  let note: string | null = null;
  if (groupBy === "product") {
    for (const x of sales) for (const it of I.itemsBySale.get(x.id) ?? []) add(it.product_id, it.qty * it.unit_price, it.qty * it.unit_cost, 1, it.qty);
    if (daily.length) note = "product_detail_only_for_detailed_branches";
  } else {
    for (const x of sales) {
      const k = groupBy === "day" ? x.date : groupBy === "branch" ? x.branch_id : groupBy === "cashier" ? x.cashier_id : groupBy === "payment" ? x.payment : groupBy === "hour" ? x.time.slice(0, 2) : "all";
      add(k, x.total, x.cost, 1, I.unitsBySale.get(x.id) ?? 0);
    }
    if (groupBy === "day" || groupBy === "branch") for (const x of daily) add(groupBy === "day" ? x.date : x.branch_id, x.revenue, x.cost, x.invoices, x.units);
    else if (daily.length) note = `${groupBy}_detail_only_for_detailed_branches`;
  }
  const rows = [...acc].map(([key, a]) => ({ key, ...(groupBy === "product" ? { name_ar: I.product.get(key)?.name_ar, name_en: I.product.get(key)?.name_en } : groupBy === "cashier" ? { name_ar: I.employee.get(key)?.name_ar, name_en: I.employee.get(key)?.name_en } : {}), revenue: M.round(a.revenue), cost: M.round(a.cost), margin: M.round(a.revenue - a.cost), margin_pct: M.pct(a.revenue - a.cost, a.revenue), invoices: a.invoices, units: a.units }));
  rows.sort(groupBy === "day" || groupBy === "hour" ? (a, b) => a.key.localeCompare(b.key) : (a, b) => b.revenue - a.revenue);
  const totals = { revenue: M.round(rows.reduce((t, r) => t + r.revenue, 0)), invoices: rows.reduce((t, r) => t + r.invoices, 0) };
  return { from, to, group_by: groupBy, totals, note, ...cap(rows) };
}

function trafficQuery(d: Data, day?: Day, hour?: number, fixtureId?: string) {
  const I = M.idx(d);
  const rows = d.traffic.filter((t) => (!day || t.day === day) && (hour == null || t.hour === hour) && (!fixtureId || t.fixture_id === fixtureId));
  const peak = [...rows].sort((a, b) => b.score - a.score).slice(0, 5).map((t) => ({ ...t, name_ar: I.fixture.get(t.fixture_id)?.name_ar, name_en: I.fixture.get(t.fixture_id)?.name_en }));
  const ranks = M.trafficRanks(d); const avg = M.trafficAverages(d);
  const fixtures = fixtureId ? [{ fixture_id: fixtureId, weekly_avg_score: avg.get(fixtureId) ?? 0, ground_floor_rank: ranks.get(fixtureId) ?? null, of: ranks.size }]
    : [...ranks].slice(0, 15).map(([id, r]) => ({ fixture_id: id, name_en: I.fixture.get(id)?.name_en, weekly_avg_score: avg.get(id), ground_floor_rank: r }));
  const queue = day && hour != null ? { day, hour, per_lane_6_open: M.queuePerLane(d, day, hour, 6), per_lane_8_open: M.queuePerLane(d, day, hour, 8) } : null;
  return { branch_id: M.mappedBranch(d), filter: { day: day ?? null, hour: hour ?? null, fixture_id: fixtureId ?? null }, peak, busiest_fixtures_week: fixtures, queue_estimate: queue };
}

/** Executes a tool. Never throws: errors come back as { error } so the model can recover. */
export function runTool(d: Data, name: string, input: Record<string, unknown>): unknown {
  try {
    const coop = str(input.coop_id) ?? "C1";
    if (coop !== "ALL" && !d.coops.some((c) => c.id === coop)) return { error: `unknown coop_id ${coop}` };
    const branch = str(input.branch_id) ?? null;
    if (branch && !d.branches.some((b) => b.id === branch)) return { error: `unknown branch_id ${branch}` };
    const s: Scope = { coopId: coop, branchId: branch };
    const today = M.demoDate(d);
    switch (name) {
      case "get_kpis": { const p = int(input.period_days, 7) === 30 ? 30 : 7; return { demo_date: today, period_days: p, scope: s, kpis: M.kpis(d, s, p) }; }
      case "sales_summary": return salesSummary(d, s, str(input.from) ?? M.addDays(today, -30), str(input.to) ?? today, str(input.group_by) ?? "day");
      case "cashier_anomalies": { const r = M.cashierAnomalies(d, s, int(input.period_days, 30)); return { ...r, cashiers: r.cashiers.slice(0, MAX_ROWS) }; }
      case "shift_variances": return M.shiftVariances(d, s, int(input.period_days, 90), str(input.cashier_id));
      case "margin_leaks": { const rows = M.marginLeaks(d); return { count: rows.length, ...cap(rows) }; }
      case "expiry_risk": { const days = int(input.days, 14); const rows = M.expiryRisk(d, s, days); return { days, count: rows.length, value_at_risk_total: M.round(rows.reduce((t, r) => t + r.value_at_risk, 0)), ...cap(rows) }; }
      case "lot_lookup": { const r = M.lotLookup(d, str(input.lot_id) ?? ""); return r ?? { error: "lot not found" }; }
      case "shelf_performance": { const r = M.shelfPerformance(d, { fixtureId: str(input.fixture_id), sort: str(input.sort) as "sales_per_m" | "traffic" | "stagnant" | undefined }); return { ...r, ...cap(r.fixtures, 25), fixtures: undefined }; }
      case "space_status": { const r = M.spaceStatus(d, s, { type: str(input.type), status: str(input.status) }); return { summary: r.summary, ...cap(r.spaces) }; }
      case "rent_arrears": return { rows: M.rentArrears(d, s) };
      case "supplier_scorecard": return { rows: M.supplierScorecard(d, str(input.supplier_id)) };
      case "traffic_query": return trafficQuery(d, str(input.day) as Day | undefined, input.hour == null ? undefined : int(input.hour, 20), str(input.fixture_id));
      case "staffing_suggestion": return M.staffingSuggestion(d, (str(input.day) as Day) ?? "Thu");
      case "attendance_summary": {
        const rows = M.attendanceSummary(d, s, int(input.period_days, 90), str(input.employee_id));
        const flagged = rows.filter((r) => r.zero_punch || r.late_weekday_pattern.length || r.late > 10);
        return { period_days: int(input.period_days, 90), employees: rows.length, ...cap(str(input.employee_id) ? rows : flagged.length ? flagged : rows) };
      }
      case "ghost_employees": return M.ghostEmployees(d, s, 90);
      case "complaints_query": return M.complaintsQuery(d, s, { status: str(input.status), lotId: str(input.lot_id), productId: str(input.product_id) });
      case "promotion_results": return M.promotionResults(d);
      case "seasonal_forecast": return M.seasonalForecast(d, branch ?? M.mappedBranch(d));
      case "member_lookup": return M.memberLookup(d, s, { memberId: str(input.member_id), phone: str(input.phone) });
      case "subsidized_breaches": return { rows: M.subsidizedBreaches(d) };
      case "ministry_compare": { const m = str(input.metric) as M.MinistryMetric; if (!M.MINISTRY_METRICS.includes(m)) return { error: `metric must be one of ${M.MINISTRY_METRICS.join(", ")}` }; return M.ministryCompare(d, m); }
      case "finance_queue": return M.financeQueue(d);
      default: return { error: `unknown tool ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** "sales_summary(coop_id=C1, group_by=cashier)" — shown in the Sources line under each answer. */
export function describeCall(name: string, input: Record<string, unknown>) {
  const args = Object.entries(input).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`);
  return `${name}(${args.join(", ")})`;
}
