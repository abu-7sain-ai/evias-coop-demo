// Every scenario in spec/05-SCENARIOS.md: the tool the agent would call returns the planted figures.
import { describe, expect, it } from "vitest";
import { MAX_ROWS, TOOL_DEFS, runTool } from "../../src/agent/tools";
import * as M from "../../src/lib/metrics";
import { loadData } from "./load";

const d = loadData();
const C1 = { coop_id: "C1" };
const B1 = { coop_id: "C1", branch_id: "C1-B1" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (name: string, input: Record<string, unknown>) => runTool(d, name, input) as any;

describe("tool contract", () => {
  it("has exactly the 22 tools from 04-AGENT.md", () => {
    expect(TOOL_DEFS.map((t) => t.name)).toEqual(["get_kpis", "sales_summary", "cashier_anomalies", "shift_variances", "margin_leaks", "expiry_risk", "lot_lookup", "shelf_performance", "space_status", "rent_arrears", "supplier_scorecard", "traffic_query", "staffing_suggestion", "attendance_summary", "ghost_employees", "complaints_query", "promotion_results", "seasonal_forecast", "member_lookup", "subsidized_breaches", "ministry_compare", "finance_queue"]);
    for (const t of TOOL_DEFS) expect(t.input_schema.required).toContain("coop_id");
  });
  it("every tool returns ≤ 60 rows and never throws", () => {
    const inputs: Record<string, Record<string, unknown>> = { sales_summary: { ...C1, group_by: "product" }, expiry_risk: { ...C1, days: 30 }, lot_lookup: { ...C1, lot_id: "LOT-4471" }, staffing_suggestion: { ...C1, day: "Thu" }, ministry_compare: { coop_id: "ALL", metric: "waste_pct" } };
    for (const t of TOOL_DEFS) {
      const out = run(t.name, inputs[t.name] ?? C1);
      expect(out.error, t.name).toBeUndefined();
      const json = JSON.stringify(out);
      for (const v of Object.values(out)) if (Array.isArray(v)) expect(v.length, t.name).toBeLessThanOrEqual(MAX_ROWS);
      expect(json.length, t.name).toBeLessThan(60000);
    }
  });
  it("bad input returns an error object", () => {
    expect(run("get_kpis", { coop_id: "X9" }).error).toBeTruthy();
    expect(run("nope", C1).error).toBeTruthy();
  });
});

describe("scenarios A (coop C1)", () => {
  it("#1 Khalid: 9 invoices, same phone, member C1-MEM-0007, all cash", () => {
    const k = run("cashier_anomalies", B1).cashiers.find((c: { username: string }) => c.username === "khalid");
    expect(k.cashier_id).toBe("EMP-001");
    expect(k.same_phone_repeats).toMatchObject({ phone: "+965 99990007", count: 9, member_id: "C1-MEM-0007", member_name_ar: "سالم الرشيدي", all_cash: true });
    const others = run("cashier_anomalies", B1).cashiers.filter((c: { username: string }) => c.username !== "khalid");
    for (const o of others) expect(o.same_phone_repeats.count).toBeLessThan(9);
  });
  it("#1b 6 voids after cash, 12–35 min, all approved by EMP-007", () => {
    const k = run("cashier_anomalies", B1).cashiers.find((c: { username: string }) => c.username === "khalid");
    expect(k.voids_after_cash).toBe(6);
    expect(k.voids_after_cash_minutes[0]).toBeGreaterThanOrEqual(12);
    expect(k.voids_after_cash_minutes[1]).toBeLessThanOrEqual(35);
    expect(k.approver_concentration).toMatchObject({ approver_id: "EMP-007", share_pct: 100, approver_name_ar: "عبدالله الخالدي" });
  });
  it("#2 Tuesday PM shifts of Khalid: 13/13 disputed, ≈ −8 KD, 3 no-sale opens 21:00–22:59", () => {
    const g = run("shift_variances", { ...B1, cashier_id: "EMP-001" }).groups.find((x: { weekday: string; shift: string }) => x.weekday === "Tue" && x.shift === "PM");
    expect(g.shifts_total).toBe(13);
    expect(g.disputed).toBe(13);
    expect(g.avg_variance).toBeCloseTo(-8, 0);
    expect(g.avg_no_sale_opens).toBe(3);
    expect(g.no_sale_window[0] >= "21:00" && g.no_sale_window[1] <= "22:59").toBe(true);
  });
  it("#3 yogurt: LOT-4471, 3 complaints, 96 units, 6 days, SUP-01, promo on hold", () => {
    const c = run("complaints_query", { ...C1, product_id: "P003" });
    expect(c.clusters_by_lot).toEqual([{ lot_id: "LOT-4471", count: 3, complaint_ids: ["CMP-0101", "CMP-0102", "CMP-0103"] }]);
    const l = run("lot_lookup", { ...C1, lot_id: "LOT-4471" });
    expect(l).toMatchObject({ product_id: "P003", qty: 96, days_left: 6, suggested_action: "hold" });
    expect(l.supplier.id).toBe("SUP-01");
    expect(l.promotions[0]).toMatchObject({ id: "PR-002", status: "blocked" });
  });
  it("#4 14 products below cost since 2026-10-18 (P054 −0.227, P045 −0.173)", () => {
    const r = run("margin_leaks", C1);
    expect(r.count).toBe(14);
    expect(r.rows.find((x: { product_id: string }) => x.product_id === "P054").margin_per_unit).toBe(-0.227);
    expect(r.rows.find((x: { product_id: string }) => x.product_id === "P045").margin_per_unit).toBe(-0.173);
    expect(r.rows.every((x: { cost_change_date: string }) => x.cost_change_date === "2026-10-18")).toBe(true);
  });
  it("#5 juice promo PR-001: planned 120, sold 90, saved 180 KD", () => {
    expect(run("promotion_results", C1).ended[0]).toMatchObject({ id: "PR-001", lot_id: "LOT-4388", planned_units: 120, sold_units: 90, waste_avoided_kd: 180 });
  });
  it("#6 dead shelf: A06-END-C1 L3 saffron P049, 24 units, 61 days without sale", () => {
    const f = run("shelf_performance", { ...C1, fixture_id: "A06-END-C1" }).rows[0];
    expect(f.prime).toBe(true);
    expect(f.stagnant_products).toContainEqual(expect.objectContaining({ product_id: "P049", level: 3, qty_on_shelf: 24, days_without_sale: 61 }));
  });
  it("#7 CH-03/CH-04 and A06-END-C2 are top traffic", () => {
    const top = run("traffic_query", C1).busiest_fixtures_week.slice(0, 7).map((x: { fixture_id: string }) => x.fixture_id);
    expect(top).toEqual(expect.arrayContaining(["CH-03", "CH-04", "A06-END-C2"]));
  });
  it("#8 A02-END-C2: SUP-04, 180 KD, 45 days, traffic top-5, sales/m below median; SUP-05 exists", () => {
    const f = run("shelf_performance", { ...C1, fixture_id: "A02-END-C2" }).rows[0];
    expect(f.reservations[0]).toMatchObject({ supplier_id: "SUP-04", monthly_rent: 180, ends_on: "2026-12-16", days_to_contract_end: 45 });
    expect(f.traffic_rank).toBeLessThanOrEqual(5);
    expect(f.vs_branch_median).toBe("below");
    expect(run("supplier_scorecard", { ...C1, supplier_id: "SUP-05" }).rows[0].name_ar).toBe("مصنع الحلويات المتحدة");
  });
  it("#9 M-07 2 × 530 KD, oldest 45 days → notice; M-16 vacant 140 d; K-04 35 d", () => {
    const a = run("rent_arrears", C1).rows;
    expect(a).toHaveLength(2);
    expect(a[0]).toMatchObject({ space_id: "M-07", amount: 530, days_late: 45, escalation_stage: "notice", tenant_ar: "صرافة الخليج" });
    const sp = run("space_status", { ...C1, status: "available" }).rows;
    expect(sp.find((x: { space_id: string }) => x.space_id === "M-16")).toMatchObject({ vacant_days: 140, monthly_rent: 400 });
    expect(sp.find((x: { space_id: string }) => x.space_id === "K-04").vacant_days).toBe(35);
  });
  it("#11 Ramadan in 99 days, multipliers ×4.1 ×3.8 ×4.0 ×2.2", () => {
    const r = run("seasonal_forecast", { ...C1, event: "ramadan" });
    expect(r.days_until).toBe(99);
    const m = Object.fromEntries(r.lines.map((l: { product_id: string; last_year_multiplier: number }) => [l.product_id, l.last_year_multiplier]));
    expect(m).toMatchObject({ P046: 4.1, P047: 3.8, P004: 4, P001: 2.2 });
  });
  it("#12 Thu/Fri 19–21 ≈ 8 per lane with 6 open, ≈ 6 with 8; Yousef late every Sunday", () => {
    for (const day of ["Thu", "Fri"]) {
      const s = run("staffing_suggestion", { ...C1, day });
      for (const h of [19, 20]) {
        const row = s.hours.find((x: { hour: number }) => x.hour === h);
        expect(row.queue_per_lane).toBeGreaterThanOrEqual(7);
        expect(row.queue_per_lane).toBeLessThanOrEqual(9);
        expect(row.queue_if_8_lanes).toBeLessThanOrEqual(6.5);
      }
    }
    expect(run("staffing_suggestion", { ...C1, day: "Thu" }).peak_hours).toEqual(expect.arrayContaining([19, 20, 21]));
    const y = run("attendance_summary", { ...C1, employee_id: "EMP-003" }).rows[0];
    expect(y.late_weekday_pattern).toEqual(["Sun"]);
  });
  it("#13 SUP-12: 33% on time, 4 late of 6, 2 short, 3 near-expiry", () => {
    expect(run("supplier_scorecard", { ...C1, supplier_id: "SUP-12" }).rows[0]).toMatchObject({ on_time_pct: 33.3, late_count: 4, deliveries: 6, short_deliveries: 2, near_expiry_deliveries: 3 });
  });
  it("#14 60 members in demo data, coop reports 9,850, unregistered ≈ 28%", () => {
    const s = run("member_lookup", C1).summary;
    expect(s.members_in_demo_data).toBe(60);
    expect(s.members_reported_by_coop).toBe(9850);
    expect(s.unregistered_sales_pct).toBeGreaterThan(26);
    expect(s.unregistered_sales_pct).toBeLessThan(30);
  });
});

describe("scenarios B (ministry)", () => {
  it("#15 rice above cap at 4 branches", () => {
    const r = run("subsidized_breaches", { coop_id: "ALL" }).rows;
    expect(r.map((x: { branch_id: string; sold_price: number }) => [x.branch_id, x.sold_price])).toEqual([["C1-B2", 3.45], ["C2-B1", 3.4], ["C2-B3", 3.5], ["C3-B2", 3.6]]);
    expect(r.every((x: { cap_price: number }) => x.cap_price === 3.25)).toBe(true);
  });
  it("#16 C3 waste % ≈ 3× the other coops and ranked worst", () => {
    const r = run("ministry_compare", { coop_id: "ALL", metric: "waste_pct" });
    expect(r.coops_ranked_worst_first[0].coop_id).toBe("C3");
    expect(r.coops_ranked_worst_first[0].vs_other_coops).toBeGreaterThan(2.5);
    expect(r.coops_ranked_worst_first[0].vs_other_coops).toBeLessThan(3.6);
  });
  it("#17 6 ghost employees at C3-B2, ≈ 2,400 KD/month", () => {
    const g = run("ghost_employees", { coop_id: "C3" });
    expect(g.count).toBe(6);
    expect(g.employees.every((e: { branch_id: string }) => e.branch_id === "C3-B2")).toBe(true);
    expect(Math.abs(g.monthly_salary_total - 2400)).toBeLessThan(150);
    expect(run("ghost_employees", C1).count).toBe(0);
  });
  it("#18 vacant spaces: only the mapped branch has space data, and it says so", () => {
    const r = run("space_status", { coop_id: "ALL", status: "available" });
    expect(r.summary.data_note).toBe("space_data_only_mapped_branch");
    expect(r.rows.map((x: { space_id: string }) => x.space_id)).toEqual(expect.arrayContaining(["M-16", "K-04", "L-01", "AD-03"]));
  });
});

describe("dashboard KPIs (owner answer Q8)", () => {
  const k = Object.fromEntries(M.kpis(d, { coopId: "C1", branchId: null }, 7).map((x) => [x.key, x]));
  it("waste down, rent collected up, variance up", () => {
    expect(k.waste.delta_pct).toBeLessThan(0);
    expect(k.rent.delta_pct).toBeGreaterThan(0);
    expect(k.variance.delta_pct).toBeGreaterThan(0);
  });
  it("get_kpis returns the same numbers as the dashboard", () => {
    expect(run("get_kpis", { coop_id: "C1", period_days: 7 }).kpis).toEqual(M.kpis(d, { coopId: "C1", branchId: null }, 7));
  });
});
