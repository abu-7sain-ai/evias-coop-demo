// Pure functions over the demo data. The screens AND the agent tools call these, so they can never disagree.
import type {
  Branch, Data, Day, Employee, Fixture, Lot, Product, Scope, Space,
} from "./types";

// ---------------------------------------------------------------- dates
export const DAY_MS = 864e5;
export const DAYS: Day[] = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]; // Kuwaiti week starts Saturday
export const HOURS = Array.from({ length: 16 }, (_, i) => i + 8); // 08 … 23
const JS_DOW: Day[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DAY_MS);
export const dayOfWeek = (iso: string): Day => JS_DOW[new Date(iso + "T00:00:00Z").getUTCDay()];
export const demoDate = (d: Data) => d.meta.demo_date;
/** [from, to) for the last n days before the demo date; offset shifts it back by whole periods. */
export const periodRange = (d: Data, days: number, offset = 0) => {
  const to = addDays(demoDate(d), -days * offset);
  return { from: addDays(to, -days), to };
};
const inRange = (date: string, r: { from: string; to: string }) => date >= r.from && date < r.to;

// ---------------------------------------------------------------- numbers
export const round = (n: number, dp = 3) => Math.round(n * 10 ** dp) / 10 ** dp;
export const pct = (num: number, den: number) => (den ? round((num / den) * 100, 1) : 0);
export const deltaPct = (cur: number | null, prev: number | null) => (cur == null || prev == null || prev === 0 ? null : round(((cur - prev) / Math.abs(prev)) * 100, 1));
const sum = <T>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0);
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Checkout queue model (owner answer Q7): people waiting = Σ traffic score of the normally-open lanes POS-01…06 × QUEUE_K;
 *  per lane = that ÷ open lanes. Calibrated so Thu 19–21 gives ≈ 8 per lane with 6 lanes and ≈ 6 with 8. */
export const QUEUE_K = 0.057;
export const QUEUE_ALERT = 6;
export const SHIFT_TOLERANCE_KD = 5;
export const STAGNANT_DAYS = 60;

// ---------------------------------------------------------------- index (memoised per data object)
interface Index {
  product: Map<string, Product>; branch: Map<string, Branch>; employee: Map<string, Employee>; fixture: Map<string, Fixture>; space: Map<string, Space>;
  unitsBySale: Map<string, number>; itemsBySale: Map<string, { product_id: string; qty: number; unit_price: number; unit_cost: number }[]>;
  saleById: Map<string, Data["sales"][number]>;
  lastSale: Map<string, string>; // `${branch}|${product}` → last date sold
  units30: Map<string, number>; // `${branch}|${product}` → units sold in the last 30 days
  detailedBranches: Set<string>;
}
const cache = new WeakMap<Data, Index>();
export function idx(d: Data): Index {
  let i = cache.get(d);
  if (i) return i;
  const saleById = new Map(d.sales.map((s) => [s.id, s]));
  const unitsBySale = new Map<string, number>();
  const itemsBySale = new Map<string, Index["itemsBySale"] extends Map<string, infer V> ? V : never>();
  const lastSale = new Map<string, string>();
  const units30 = new Map<string, number>();
  const from30 = addDays(d.meta.demo_date, -30);
  for (const it of d.sale_items) {
    unitsBySale.set(it.sale_id, (unitsBySale.get(it.sale_id) ?? 0) + it.qty);
    let arr = itemsBySale.get(it.sale_id);
    if (!arr) itemsBySale.set(it.sale_id, (arr = []));
    arr.push(it);
    const s = saleById.get(it.sale_id);
    if (s) {
      const k = `${s.branch_id}|${it.product_id}`;
      if ((lastSale.get(k) ?? "") < s.date) lastSale.set(k, s.date);
      if (s.date >= from30 && s.date < d.meta.demo_date) units30.set(k, (units30.get(k) ?? 0) + it.qty);
    }
  }
  i = {
    product: new Map(d.products.map((p) => [p.id, p])), branch: new Map(d.branches.map((b) => [b.id, b])),
    employee: new Map(d.employees.map((e) => [e.id, e])), fixture: new Map(d.floorplan.fixtures.map((f) => [f.id, f])),
    space: new Map(d.spaces.map((s) => [s.id, s])), unitsBySale, itemsBySale, saleById, lastSale, units30,
    detailedBranches: new Set(d.sales.map((s) => s.branch_id)),
  };
  cache.set(d, i);
  return i;
}

// ---------------------------------------------------------------- scope
export const branchesInScope = (d: Data, s: Scope) =>
  d.branches.filter((b) => (s.coopId === "ALL" || b.coop_id === s.coopId) && (!s.branchId || b.id === s.branchId));
const scopeFilter = (d: Data, s: Scope) => { const ids = new Set(branchesInScope(d, s).map((b) => b.id)); return (x: { branch_id: string | null }) => !!x.branch_id && ids.has(x.branch_id); };
export const mappedBranch = (d: Data) => d.meta.mapped_branch;

// ---------------------------------------------------------------- sales aggregates
export interface SalesAgg { revenue: number; cost: number; invoices: number; units: number; voids: number; refunds: number }
export function salesAgg(d: Data, s: Scope, r: { from: string; to: string }): SalesAgg {
  const inS = scopeFilter(d, s); const I = idx(d);
  const det = d.sales.filter((x) => inS(x) && inRange(x.date, r));
  const agg = d.daily_sales.filter((x) => inS(x) && inRange(x.date, r));
  return {
    revenue: round(sum(det, (x) => x.total) + sum(agg, (x) => x.revenue)),
    cost: round(sum(det, (x) => x.cost) + sum(agg, (x) => x.cost)),
    invoices: det.length + sum(agg, (x) => x.invoices),
    units: sum(det, (x) => I.unitsBySale.get(x.id) ?? 0) + sum(agg, (x) => x.units),
    voids: d.voids.filter((x) => inS(x) && inRange(x.date, r)).length + sum(agg, (x) => x.voids),
    refunds: d.refunds.filter((x) => inS(x) && inRange(x.date, r)).length + sum(agg, (x) => x.refunds),
  };
}

/** Daily revenue series, one key per branch (or per coop when coopId = ALL). */
export function dailySeries(d: Data, s: Scope, days = 30) {
  const r = periodRange(d, days);
  const keys = s.coopId === "ALL" ? d.coops.map((c) => c.id) : branchesInScope(d, s).map((b) => b.id);
  const keyOf = (x: { coop_id: string; branch_id: string }) => (s.coopId === "ALL" ? x.coop_id : x.branch_id);
  const rows = new Map<string, Record<string, number | string>>();
  for (let i = 0; i < days; i++) { const date = addDays(r.from, i); rows.set(date, { date, ...Object.fromEntries(keys.map((k) => [k, 0])) }); }
  const inS = scopeFilter(d, s);
  for (const x of d.sales) if (inS(x) && inRange(x.date, r)) { const row = rows.get(x.date)!; const k = keyOf(x); row[k] = (row[k] as number) + x.total; }
  for (const x of d.daily_sales) if (inS(x) && inRange(x.date, r)) { const row = rows.get(x.date)!; const k = keyOf(x); row[k] = (row[k] as number) + x.revenue; }
  for (const row of rows.values()) for (const k of keys) row[k] = round(row[k] as number);
  return { keys, rows: [...rows.values()] };
}

// ---------------------------------------------------------------- waste, variance, rent, attendance, expiry
export const wasteValue = (d: Data, s: Scope, r: { from: string; to: string }) => round(sum(d.writeoffs.filter((w) => scopeFilter(d, s)(w) && inRange(w.date, r)), (w) => w.value));

export function shiftVarianceTotal(d: Data, s: Scope, r: { from: string; to: string }) {
  const sh = d.shifts.filter((x) => scopeFilter(d, s)(x) && inRange(x.date, r));
  return sh.length ? round(sum(sh, (x) => Math.abs(x.variance))) : null;
}

/** Most recent month with rent due (October for demo date 2026-11-01) and the one before it. */
export function rentMonths(d: Data) {
  const months = [...new Set(d.lease_invoices.map((x) => x.due_on.slice(0, 7)))].filter((m) => `${m}-17` <= demoDate(d)).sort();
  return { current: months.at(-1)!, previous: months.at(-2)! };
}
/** Rent collected within the month it fell due ÷ rent due that month. */
export function rentCollection(d: Data, s: Scope, month: string) {
  const inS = scopeFilter(d, s);
  const inv = d.lease_invoices.filter((x) => x.due_on.startsWith(month) && inS(I_space(d, x.space_id)));
  if (!inv.length) return null;
  const due = sum(inv, (x) => x.amount);
  const collected = sum(inv.filter((x) => x.paid_on && x.paid_on.slice(0, 7) === month), (x) => x.amount);
  return { month, due: round(due), collected: round(collected), rate: pct(collected, due) };
}
const I_space = (d: Data, id: string) => idx(d).space.get(id) ?? { branch_id: null };

/** Attendance rate = days present (incl. late / no punch-out) ÷ scheduled days. Scheduled = every day except Friday for non-cashiers.
 *  Employees with no records at all still count as scheduled (this is what exposes zero-punch employees). */
export function attendanceRate(d: Data, s: Scope, r: { from: string; to: string }) {
  const emps = d.employees.filter((e) => e.active && scopeFilter(d, s)(e));
  if (!emps.length) return null;
  const ids = new Set(emps.map((e) => e.id));
  let scheduled = 0;
  for (const e of emps) for (let day = r.from; day < r.to; day = addDays(day, 1)) if (!(dayOfWeek(day) === "Fri" && e.role !== "cashier")) scheduled++;
  const present = d.attendance.filter((a) => ids.has(a.employee_id) && inRange(a.date, r) && a.status !== "absent").length;
  return pct(present, scheduled);
}

export function expiringValue(d: Data, s: Scope, asOf: string, days = 14) {
  const lots = d.lots.filter((l) => scopeFilter(d, s)(l) && l.received_on < asOf && l.expiry >= asOf && l.expiry <= addDays(asOf, days));
  return round(sum(lots, (l) => l.qty * l.cost));
}

// ---------------------------------------------------------------- KPIs
export type KpiKey = "sales" | "margin" | "waste" | "void_rate" | "variance" | "rent" | "attendance" | "expiring";
export interface Kpi { key: KpiKey; value: number | null; prev: number | null; delta_pct: number | null; unit: "KD" | "%"; down_is_good: boolean; note?: string }
export function kpis(d: Data, s: Scope, periodDays = 7): Kpi[] {
  const cur = periodRange(d, periodDays), prev = periodRange(d, periodDays, 1);
  const a = salesAgg(d, s, cur), b = salesAgg(d, s, prev);
  const margin = (x: SalesAgg) => (x.revenue ? pct(x.revenue - x.cost, x.revenue) : null);
  const vr = (x: SalesAgg) => (x.invoices ? round(((x.voids + x.refunds) / x.invoices) * 100, 2) : null);
  const rm = rentMonths(d);
  const rc = rentCollection(d, s, rm.current), rp = rentCollection(d, s, rm.previous);
  const k = (key: KpiKey, value: number | null, prevV: number | null, unit: Kpi["unit"], down: boolean, note?: string): Kpi =>
    ({ key, value, prev: prevV, delta_pct: deltaPct(value, prevV), unit, down_is_good: down, ...(note ? { note } : {}) });
  return [
    k("sales", a.revenue, b.revenue, "KD", false),
    k("margin", margin(a), margin(b), "%", false),
    k("waste", wasteValue(d, s, cur), wasteValue(d, s, prev), "KD", true),
    k("void_rate", vr(a), vr(b), "%", true),
    k("variance", shiftVarianceTotal(d, s, cur), shiftVarianceTotal(d, s, prev), "KD", true),
    k("rent", rc?.rate ?? null, rp?.rate ?? null, "%", false, rc ? `${rm.current} vs ${rm.previous}` : undefined),
    k("attendance", attendanceRate(d, s, cur), attendanceRate(d, s, prev), "%", false),
    k("expiring", expiringValue(d, s, demoDate(d)), expiringValue(d, s, addDays(demoDate(d), -periodDays)), "KD", true),
  ];
}

// ---------------------------------------------------------------- traffic & queues
export function trafficScore(d: Data, fixtureId: string, day?: Day, hour?: number) {
  const rows = d.traffic.filter((t) => t.fixture_id === fixtureId && (!day || t.day === day) && (hour == null || t.hour === hour));
  return rows.length ? round(sum(rows, (t) => t.score) / rows.length, 1) : 0;
}
/** Average hourly score across the whole week, per fixture. */
export function trafficAverages(d: Data) {
  const acc = new Map<string, { s: number; n: number }>();
  for (const t of d.traffic) { const a = acc.get(t.fixture_id) ?? { s: 0, n: 0 }; a.s += t.score; a.n++; acc.set(t.fixture_id, a); }
  return new Map([...acc].map(([k, v]) => [k, round(v.s / v.n, 1)]));
}
/** Ground-floor rank (1 = busiest) of every fixture by weekly average traffic. */
export function trafficRanks(d: Data) {
  const I = idx(d); const avg = trafficAverages(d);
  const g = [...avg].filter(([id]) => I.fixture.get(id)?.floor === "G").sort((a, b) => b[1] - a[1]);
  return new Map(g.map(([id], i) => [id, i + 1]));
}
export function trafficLayer(d: Data, day: Day, hour: number) {
  return new Map(d.traffic.filter((t) => t.day === day && t.hour === hour).map((t) => [t.fixture_id, t.score]));
}
export function queuePerLane(d: Data, day: Day, hour: number, openLanes = 6) {
  const people = sum(d.traffic.filter((t) => /^POS-0[1-6]$/.test(t.fixture_id) && t.day === day && t.hour === hour), (t) => t.score) * QUEUE_K;
  return round(people / openLanes, 1);
}
/** Day × hour grid for the selected branch. Mapped branch: footfall at the entrance zones; other detailed branches: invoice counts. */
export function heatmap(d: Data, branchId: string | null): { source: "traffic" | "invoices" | "none"; grid: number[][] } {
  const grid = DAYS.map(() => HOURS.map(() => 0));
  const b = branchId ?? mappedBranch(d);
  if (b === mappedBranch(d)) {
    for (const t of d.traffic) if (t.fixture_id === "ENT-MAIN" || t.fixture_id === "VEST" || t.fixture_id === "ENT-PARK") grid[DAYS.indexOf(t.day)][t.hour - 8] += t.score;
    return { source: "traffic", grid };
  }
  const sales = d.sales.filter((s) => s.branch_id === b);
  if (!sales.length) return { source: "none", grid };
  for (const s of sales) { const h = +s.time.slice(0, 2); if (h >= 8 && h <= 23) grid[DAYS.indexOf(dayOfWeek(s.date))][h - 8]++; }
  return { source: "invoices", grid };
}

// ---------------------------------------------------------------- cashier anomalies (story #1, #1b)
export function cashierAnomalies(d: Data, s: Scope, periodDays = 30) {
  const r = periodRange(d, periodDays); const inS = scopeFilter(d, s); const I = idx(d);
  const sales = d.sales.filter((x) => inS(x) && inRange(x.date, r));
  const voids = d.voids.filter((x) => inS(x) && inRange(x.date, r));
  const refunds = d.refunds.filter((x) => inS(x) && inRange(x.date, r));
  const cashiers = [...new Set(sales.map((x) => x.cashier_id))];
  const rows = cashiers.map((cid) => {
    const mine = sales.filter((x) => x.cashier_id === cid);
    const lv = mine.filter((x) => x.line_voids > 0);
    const phones = new Map<string, number>();
    for (const x of lv) if (x.phone) phones.set(x.phone, (phones.get(x.phone) ?? 0) + 1);
    const [topPhone, topCount] = [...phones].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const topSales = lv.filter((x) => x.phone === topPhone);
    const vc = voids.filter((v) => v.cashier_id === cid && v.payment === "cash");
    const approvers = new Map<string, number>();
    for (const v of vc) approvers.set(v.approved_by, (approvers.get(v.approved_by) ?? 0) + 1);
    const [topApprover, apCount] = [...approvers].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const e = I.employee.get(cid);
    const member = topPhone ? d.members.find((m) => m.phone === topPhone) : undefined;
    return {
      cashier_id: cid, username: e?.username, name_ar: e?.name_ar, name_en: e?.name_en, branch_id: e?.branch_id,
      invoices: mine.length, invoices_with_line_voids: lv.length, line_voids: sum(mine, (x) => x.line_voids),
      voids_after_cash: vc.length,
      voids_after_cash_minutes: vc.length ? [Math.min(...vc.map((v) => v.minutes_after_sale)), Math.max(...vc.map((v) => v.minutes_after_sale))] : null,
      voids_after_cash_ids: vc.map((v) => v.id),
      refunds: refunds.filter((x) => x.cashier_id === cid).length,
      same_phone_repeats: { phone: topPhone, count: topCount, member_id: member?.id ?? null, member_name_ar: member?.name_ar ?? null, member_name_en: member?.name_en ?? null,
        all_cash: topSales.every((x) => x.payment === "cash"), invoice_ids: topSales.map((x) => x.id) },
      approver_concentration: topApprover ? { approver_id: topApprover, approver_name_ar: I.employee.get(topApprover)?.name_ar, approver_name_en: I.employee.get(topApprover)?.name_en, share_pct: pct(apCount, vc.length) } : null,
    };
  });
  const avg = (f: (x: (typeof rows)[number]) => number) => (rows.length ? round(sum(rows, f) / rows.length, 1) : 0);
  return {
    period: r, cashiers: rows.sort((a, b) => b.same_phone_repeats.count - a.same_phone_repeats.count),
    branch_average: { invoices_with_line_voids: avg((x) => x.invoices_with_line_voids), voids_after_cash: avg((x) => x.voids_after_cash), same_phone_repeats: avg((x) => x.same_phone_repeats.count) },
  };
}

// ---------------------------------------------------------------- shift variances (story #2)
export function shiftVariances(d: Data, s: Scope, periodDays = 90, cashierId?: string) {
  const r = periodRange(d, periodDays); const I = idx(d);
  const shifts = d.shifts.filter((x) => scopeFilter(d, s)(x) && inRange(x.date, r) && (!cashierId || x.cashier_id === cashierId));
  const beyond = shifts.filter((x) => Math.abs(x.variance) > SHIFT_TOLERANCE_KD);
  const groups = new Map<string, typeof beyond>();
  for (const x of beyond) { const k = `${x.cashier_id}|${dayOfWeek(x.date)}|${x.shift}`; groups.set(k, [...(groups.get(k) ?? []), x]); }
  const nsTimes = (shiftId: string) => d.cash_movements.filter((c) => c.shift_id === shiftId && c.type === "no_sale").map((c) => c.time);
  const grouped = [...groups].map(([k, xs]) => {
    const [cid, dow, sh] = k.split("|");
    const total = shifts.filter((x) => x.cashier_id === cid && dayOfWeek(x.date) === dow && x.shift === sh);
    const times = xs.flatMap((x) => nsTimes(x.id));
    return {
      cashier_id: cid, name_ar: I.employee.get(cid)?.name_ar, name_en: I.employee.get(cid)?.name_en, weekday: dow, shift: sh,
      shifts_beyond_tolerance: xs.length, shifts_total: total.length, disputed: xs.filter((x) => x.status === "disputed").length,
      avg_variance: round(sum(xs, (x) => x.variance) / xs.length), total_variance: round(sum(xs, (x) => x.variance)),
      avg_no_sale_opens: round(sum(xs, (x) => x.no_sale_opens) / xs.length, 1),
      no_sale_window: times.length ? [times.sort()[0], times.sort().at(-1)] : null,
    };
  }).sort((a, b) => b.shifts_beyond_tolerance - a.shifts_beyond_tolerance);
  return { period: r, tolerance_kd: SHIFT_TOLERANCE_KD, shifts_checked: shifts.length, shifts_beyond_tolerance: beyond.length, groups: grouped };
}

// ---------------------------------------------------------------- margin leaks (story #4)
export function marginLeaks(d: Data) {
  const I = idx(d);
  return d.products.filter((p) => p.cost > p.price || (p.price - p.cost) / p.price < 0.03).map((p) => {
    const change = p.cost_history.at(-1);
    const old = p.cost_history.at(-2);
    const units = change ? sum(d.sales.filter((s) => s.date >= change.date), (s) => sum((I.itemsBySale.get(s.id) ?? []).filter((i) => i.product_id === p.id), (i) => i.qty)) : null;
    return {
      product_id: p.id, name_ar: p.name_ar, name_en: p.name_en, price: p.price, old_cost: old?.cost ?? null, new_cost: p.cost,
      cost_change_date: change?.date ?? null, margin_per_unit: round(p.price - p.cost), margin_pct: pct(p.price - p.cost, p.price),
      units_sold_since: units, loss_since_change: units != null ? round(units * Math.min(0, p.price - p.cost)) : null, supplier_id: p.supplier_id,
    };
  }).sort((a, b) => a.margin_per_unit - b.margin_per_unit);
}

// ---------------------------------------------------------------- demand, expiry (screen 4.5, story #3)
/** Units per day for a product at a branch: detailed branches use the last 30 days of sales; others use the planning base. */
export function dailyDemand(d: Data, productId: string, branchId: string) {
  const I = idx(d); const b = I.branch.get(branchId); const p = I.product.get(productId)!;
  if (!I.detailedBranches.has(branchId)) return round(p.daily_base * (b?.code === "B1" ? 1 : 0.4), 1);
  return round((I.units30.get(`${branchId}|${productId}`) ?? 0) / 30, 1);
}
export type LotAction = "hold" | "bogo" | "discount" | "transfer" | "return" | "none";
export function lotRisk(d: Data, l: Lot) {
  const I = idx(d); const today = demoDate(d);
  const days_left = daysBetween(today, l.expiry);
  const demand = dailyDemand(d, l.product_id, l.branch_id);
  const surplus = Math.max(0, Math.round(l.qty - demand * Math.max(0, days_left)));
  const complaints = d.complaints.filter((c) => c.lot_id === l.id).length;
  const lastSold = I.lastSale.get(`${l.branch_id}|${l.product_id}`);
  const stagnant = lastSold ? daysBetween(lastSold, today) : null;
  let action: LotAction = "none";
  if (complaints > 0 || l.flagged) action = "hold";
  else if (stagnant != null && stagnant > STAGNANT_DAYS) action = "return";
  else if (surplus > 0 && days_left <= 3) action = "bogo";
  else if (surplus > 0 && days_left <= 7) action = "discount";
  else if (surplus > 0 && days_left <= 30) action = "transfer";
  const p = I.product.get(l.product_id)!;
  return {
    lot_id: l.id, product_id: l.product_id, name_ar: p.name_ar, name_en: p.name_en, branch_id: l.branch_id, location: locationOf(d, l.branch_id, l.product_id),
    qty: l.qty, expiry: l.expiry, days_left, daily_demand: demand, projected_surplus: surplus, value_at_risk: round(surplus * l.cost),
    days_since_last_sale: stagnant, complaints, suggested_action: action, supplier_id: l.supplier_id,
  };
}
export const locationOf = (d: Data, branchId: string, productId: string) =>
  d.stock_locations.filter((s) => s.branch_id === branchId && s.product_id === productId).map((s) => `${s.fixture_id}/L${s.level}`).join(", ") || null;

export function expiryRisk(d: Data, s: Scope, days: number) {
  const today = demoDate(d);
  return d.lots.filter((l) => scopeFilter(d, s)(l) && l.expiry >= today && l.expiry <= addDays(today, days)).map((l) => lotRisk(d, l)).sort((a, b) => b.value_at_risk - a.value_at_risk || a.days_left - b.days_left);
}
export function stagnantLots(d: Data, s: Scope, minDays = STAGNANT_DAYS) {
  return d.lots.filter((l) => scopeFilter(d, s)(l)).map((l) => lotRisk(d, l)).filter((x) => x.days_since_last_sale != null && x.days_since_last_sale > minDays);
}

export function lotLookup(d: Data, lotId: string) {
  const l = d.lots.find((x) => x.id === lotId);
  if (!l) return null;
  const I = idx(d);
  const sup = d.suppliers.find((x) => x.id === l.supplier_id);
  return {
    ...lotRisk(d, l), received_on: l.received_on, unit_cost: l.cost, flagged: l.flagged ?? null,
    supplier: sup ? { id: sup.id, name_ar: sup.name_ar, name_en: sup.name_en } : null,
    complaints: d.complaints.filter((c) => c.lot_id === lotId).map((c) => ({ id: c.id, opened_at: c.opened_at, subject_ar: c.subject_ar, subject_en: c.subject_en, status: c.status, sla_breached: c.sla_breached, assigned_to: c.assigned_to })),
    promotions: d.promotions.filter((p) => p.lot_id === lotId).map((p) => ({ id: p.id, type: p.type, type_ar: p.type_ar, type_en: p.type_en, status: p.status })),
    product: (({ id, name_ar, name_en, price, cost }) => ({ id, name_ar, name_en, price, cost }))(I.product.get(l.product_id)!),
  };
}

// ---------------------------------------------------------------- shelves (story #6, #7, #8)
export const fixtureLength = (f: Fixture) => Math.max(f.w, f.h);
/** 30-day sales attributed to each fixture: each product's branch revenue is split across its locations by facings share. */
export function fixtureSales30(d: Data, branchId = mappedBranch(d)) {
  const I = idx(d); const r = periodRange(d, 30);
  const rev = new Map<string, number>();
  for (const s of d.sales) if (s.branch_id === branchId && inRange(s.date, r)) for (const it of I.itemsBySale.get(s.id) ?? []) rev.set(it.product_id, (rev.get(it.product_id) ?? 0) + it.qty * it.unit_price);
  const locs = d.stock_locations.filter((x) => x.branch_id === branchId);
  const facings = new Map<string, number>();
  for (const x of locs) facings.set(x.product_id, (facings.get(x.product_id) ?? 0) + x.facings);
  const out = new Map<string, number>();
  for (const x of locs) out.set(x.fixture_id, (out.get(x.fixture_id) ?? 0) + ((rev.get(x.product_id) ?? 0) * x.facings) / facings.get(x.product_id)!);
  return out;
}
export function shelfPerformance(d: Data, opts: { fixtureId?: string; sort?: "sales_per_m" | "traffic" | "stagnant" } = {}) {
  const I = idx(d); const b = mappedBranch(d); const today = demoDate(d);
  const sales = fixtureSales30(d, b); const tAvg = trafficAverages(d); const ranks = trafficRanks(d);
  const rows = [...sales.keys()].map((fid) => {
    const f = I.fixture.get(fid)!;
    const res = d.shelf_reservations.filter((x) => x.fixture_id === fid);
    const stock = d.stock_locations.filter((x) => x.fixture_id === fid && x.branch_id === b);
    const stagnant = stock.map((x) => { const last = I.lastSale.get(`${b}|${x.product_id}`); return { product_id: x.product_id, name_ar: I.product.get(x.product_id)?.name_ar, name_en: I.product.get(x.product_id)?.name_en, level: x.level, qty_on_shelf: x.qty_on_shelf, days_without_sale: last ? daysBetween(last, today) : null }; })
      .filter((x) => x.days_without_sale != null && x.days_without_sale > STAGNANT_DAYS);
    return {
      fixture_id: fid, type: f.type, prime: !!f.prime, name_ar: f.name_ar, name_en: f.name_en, length_m: fixtureLength(f),
      reservations: res.map((x) => ({ supplier_id: x.supplier_id, supplier_ar: d.suppliers.find((s) => s.id === x.supplier_id)?.name_ar, supplier_en: d.suppliers.find((s) => s.id === x.supplier_id)?.name_en, level: x.level, monthly_rent: x.monthly_rent, ends_on: x.ends_on, days_to_contract_end: x.days_to_expiry })),
      sales_30d: round(sales.get(fid) ?? 0), sales_per_m: round((sales.get(fid) ?? 0) / fixtureLength(f)),
      traffic_score: tAvg.get(fid) ?? 0, traffic_rank: ranks.get(fid) ?? null,
      products: stock.map((x) => ({ product_id: x.product_id, level: x.level, facings: x.facings })), stagnant_products: stagnant,
    };
  });
  const med = round(median(rows.map((x) => x.sales_per_m)));
  const withMedian = rows.map((x) => ({ ...x, vs_branch_median: x.sales_per_m >= med ? "above" : "below" }));
  const sort = opts.sort ?? "sales_per_m";
  withMedian.sort(sort === "traffic" ? (a, b) => b.traffic_score - a.traffic_score : sort === "stagnant" ? (a, b) => b.stagnant_products.length - a.stagnant_products.length || a.sales_per_m - b.sales_per_m : (a, b) => b.sales_per_m - a.sales_per_m);
  const filtered = opts.fixtureId ? withMedian.filter((x) => x.fixture_id === opts.fixtureId) : withMedian;
  return { branch_id: b, branch_median_sales_per_m: med, fixtures_ranked: rows.length, fixtures: filtered };
}

// ---------------------------------------------------------------- spaces & leasing (story #9, #18)
export function arrearsStage(daysLate: number) { return daysLate >= 60 ? "ministry" : daysLate > 30 ? "notice" : "reminder"; }
export function spaceStatus(d: Data, s: Scope, opts: { type?: string; status?: string } = {}) {
  const I = idx(d);
  const spaces = d.spaces.filter((x) => scopeFilter(d, s)(x) && (!opts.type || x.type === opts.type) && (!opts.status || x.status === opts.status));
  const rows = spaces.map((sp) => {
    const c = d.lease_contracts.find((x) => x.space_id === sp.id);
    const t = c ? d.tenants.find((x) => x.id === c.tenant_id) : undefined;
    const overdue = d.lease_invoices.filter((x) => x.space_id === sp.id && x.status === "overdue");
    return {
      space_id: sp.id, type: sp.type, floor: sp.floor, area_m2: sp.area_m2, name_ar: sp.name_ar, name_en: sp.name_en, status: sp.status,
      tenant_id: t?.id ?? null, tenant_ar: t?.name_ar ?? null, tenant_en: t?.name_en ?? null, monthly_rent: sp.monthly_rent, day_rate: sp.day_rate,
      starts_on: c?.starts_on ?? null, ends_on: c?.ends_on ?? null, days_to_expiry: c?.days_to_expiry ?? null,
      arrears_kd: round(sum(overdue, (x) => x.amount)), vacant_days: sp.vacant_days,
      lost_rent_kd: sp.status === "available" ? round((sp.monthly_rent * sp.vacant_days) / 30) : 0,
    };
  });
  const all = d.spaces.filter((x) => scopeFilter(d, s)(x) && x.type !== "lobby");
  const occupied = all.filter((x) => ["leased", "expiring", "arrears", "reserved"].includes(x.status));
  void I;
  return {
    summary: {
      spaces: all.length, occupied: occupied.length, occupancy_pct: pct(occupied.length, all.length),
      monthly_rent_roll: round(sum(occupied, (x) => x.monthly_rent)),
      arrears_total: round(sum(rows, (x) => x.arrears_kd)),
      vacant: all.filter((x) => x.status === "available").length,
      vacant_days_total: sum(all.filter((x) => x.status === "available"), (x) => x.vacant_days),
      data_note: s.coopId === "ALL" || s.coopId !== d.branches.find((b) => b.id === mappedBranch(d))?.coop_id ? "space_data_only_mapped_branch" : null,
    },
    spaces: rows,
  };
}
export function rentArrears(d: Data, s: Scope) {
  return d.lease_invoices.filter((x) => x.status === "overdue" && scopeFilter(d, s)(I_space(d, x.space_id))).map((x) => {
    const t = d.tenants.find((y) => y.id === x.tenant_id);
    return { invoice_id: x.id, space_id: x.space_id, tenant_ar: t?.name_ar, tenant_en: t?.name_en, due_on: x.due_on, amount: x.amount, days_late: x.days_late, escalation_stage: arrearsStage(x.days_late), ministry_visible_at_days: 60 };
  }).sort((a, b) => b.days_late - a.days_late);
}

// ---------------------------------------------------------------- suppliers (story #13)
export function supplierScorecard(d: Data, supplierId?: string) {
  return d.suppliers.filter((x) => !supplierId || x.id === supplierId).map((s) => {
    const del = d.supplier_deliveries.filter((x) => x.supplier_id === s.id);
    const late = del.filter((x) => x.late).length;
    const inv = d.supplier_invoices.filter((x) => x.supplier_id === s.id && x.status !== "posted");
    const res = d.shelf_reservations.filter((x) => x.supplier_id === s.id);
    return {
      supplier_id: s.id, name_ar: s.name_ar, name_en: s.name_en, deliveries: del.length, on_time_pct: pct(del.length - late, del.length), late_count: late,
      short_deliveries: del.filter((x) => x.short).length, near_expiry_deliveries: del.filter((x) => x.near_expiry).length,
      open_invoices: inv.length, open_invoices_kd: round(sum(inv, (x) => x.amount)),
      shelf_rents_monthly_kd: round(sum(res, (x) => x.monthly_rent)), shelves: res.map((x) => x.fixture_id),
    };
  });
}

// ---------------------------------------------------------------- staffing & attendance (story #12, #17)
export function staffingSuggestion(d: Data, day: Day) {
  const hours = HOURS.map((h) => {
    const six = queuePerLane(d, day, h, 6), eight = queuePerLane(d, day, h, 8);
    const pos = sum(d.traffic.filter((t) => /^POS-0[1-6]$/.test(t.fixture_id) && t.day === day && t.hour === h), (t) => t.score);
    const scheduled = d.employees.filter((e) => e.role === "cashier" && e.branch_id === mappedBranch(d)).length / 2; // AM and PM halves
    return { hour: h, checkout_traffic: pos, scheduled_cashiers: scheduled, lanes_open: 6, queue_per_lane: six, queue_if_8_lanes: eight, needs_extra: six > QUEUE_ALERT };
  });
  return { day, branch_id: mappedBranch(d), queue_alert_per_lane: QUEUE_ALERT, hours, peak_hours: hours.filter((h) => h.needs_extra).map((h) => h.hour) };
}

export function attendanceSummary(d: Data, s: Scope, periodDays = 90, employeeId?: string) {
  const r = periodRange(d, periodDays);
  const emps = d.employees.filter((e) => scopeFilter(d, s)(e) && (!employeeId || e.id === employeeId));
  return emps.map((e) => {
    const recs = d.attendance.filter((a) => a.employee_id === e.id && inRange(a.date, r));
    let scheduled = 0;
    for (let day = r.from; day < r.to; day = addDays(day, 1)) if (!(dayOfWeek(day) === "Fri" && e.role !== "cashier")) scheduled++;
    const late = recs.filter((a) => (a.late_minutes ?? 0) > 15);
    const byDow = DAYS.map((dw) => ({ day: dw, late: late.filter((a) => dayOfWeek(a.date) === dw).length, of: recs.filter((a) => dayOfWeek(a.date) === dw && a.punch_in).length, avg_late_min: round(sum(late.filter((a) => dayOfWeek(a.date) === dw), (a) => a.late_minutes ?? 0) / Math.max(1, late.filter((a) => dayOfWeek(a.date) === dw).length), 0) }));
    const pattern = byDow.filter((x) => x.of > 4 && x.late / x.of >= 0.8).map((x) => x.day);
    return {
      employee_id: e.id, name_ar: e.name_ar, name_en: e.name_en, role: e.role, branch_id: e.branch_id, salary: e.salary,
      scheduled, present: recs.filter((a) => a.status !== "absent").length, late: late.length, absent: recs.filter((a) => a.status === "absent").length,
      no_punch_out: recs.filter((a) => a.punch_in && !a.punch_out).length, zero_punch: recs.length === 0,
      late_weekday_pattern: pattern, late_by_weekday: byDow.filter((x) => x.late > 0),
    };
  });
}
export function ghostEmployees(d: Data, s: Scope, periodDays = 90) {
  const rows = attendanceSummary(d, s, periodDays).filter((x) => x.zero_punch && x.salary > 0);
  return { period_days: periodDays, count: rows.length, monthly_salary_total: round(sum(rows, (x) => x.salary)), employees: rows.map(({ employee_id, name_ar, name_en, role, branch_id, salary }) => ({ employee_id, name_ar, name_en, role, branch_id, salary })) };
}

// ---------------------------------------------------------------- complaints, promotions, seasonal
export function complaintsQuery(d: Data, s: Scope, opts: { status?: string; lotId?: string; productId?: string } = {}) {
  const rows = d.complaints.filter((c) => scopeFilter(d, s)(c) && (!opts.status || c.status === opts.status) && (!opts.lotId || c.lot_id === opts.lotId) && (!opts.productId || c.product_id === opts.productId));
  const clusters = new Map<string, string[]>();
  for (const c of rows) if (c.lot_id) clusters.set(c.lot_id, [...(clusters.get(c.lot_id) ?? []), c.id]);
  return {
    complaints: rows.map((c) => ({ id: c.id, branch_id: c.branch_id, category: c.category, priority: c.priority, subject_ar: c.subject_ar, subject_en: c.subject_en, lot_id: c.lot_id ?? null, product_id: c.product_id ?? null, opened_at: c.opened_at, due_at: c.due_at, assigned_to: c.assigned_to, status: c.status, sla_breached: c.sla_breached })),
    clusters_by_lot: [...clusters].filter(([, ids]) => ids.length > 1).map(([lot, ids]) => ({ lot_id: lot, count: ids.length, complaint_ids: ids })),
  };
}
export function promotionResults(d: Data) {
  const I = idx(d);
  const nm = (id: string) => ({ product_ar: I.product.get(id)?.name_ar, product_en: I.product.get(id)?.name_en });
  return {
    ended: d.promotions.filter((p) => p.status === "ended").map((p) => ({ id: p.id, ...nm(p.product_id), lot_id: p.lot_id, type_ar: p.type_ar, type_en: p.type_en, starts_on: p.starts_on, ends_on: p.ends_on, planned_units: p.planned_units, sold_units: p.sold_units, waste_avoided_kd: p.waste_avoided_kd, approved_by: p.approved_by })),
    on_hold: d.promotions.filter((p) => p.status === "blocked").map((p) => ({ id: p.id, ...nm(p.product_id), lot_id: p.lot_id, type_ar: p.type_ar, type_en: p.type_en })),
    drafts_awaiting_approval: d.promotions.filter((p) => p.status === "draft").map((p) => ({ id: p.id, ...nm(p.product_id), type_ar: p.type_ar, type_en: p.type_en, starts_on: p.starts_on, ends_on: p.ends_on, planned_units: p.planned_units, approver: "branch_manager" })),
  };
}
export function seasonalForecast(d: Data, branchId = mappedBranch(d)) {
  const I = idx(d); const ram = d.ramadan; const RAMADAN_DAYS = 30;
  const lines = Object.entries(ram.last_year_multipliers).map(([pid, mult]) => {
    const p = I.product.get(pid)!;
    const stock = sum(d.lots.filter((l) => l.branch_id === branchId && l.product_id === pid), (l) => l.qty);
    const demand = dailyDemand(d, pid, branchId);
    const need = Math.round(demand * mult * RAMADAN_DAYS);
    return { product_id: pid, name_ar: p.name_ar, name_en: p.name_en, last_year_multiplier: mult, daily_demand_now: demand, current_stock: stock, stock_cover_days: demand ? round(stock / demand, 1) : null, ramadan_need_units: need, draft_po_units: Math.max(0, need - stock), draft_po_value_kd: round(Math.max(0, need - stock) * p.cost), supplier_id: p.supplier_id };
  });
  return { event: "ramadan", starts_on: ram.starts_on, days_until: ram.days_until, branch_id: branchId, assumed_ramadan_days: RAMADAN_DAYS, lines, approver: "purchaser" };
}

// ---------------------------------------------------------------- members (story #14)
export function memberStats(d: Data, s: Scope) {
  const cfg = d.meta.dividend_config;
  const members = d.members.filter((m) => s.coopId === "ALL" || m.coop_id === s.coopId);
  const coopSales = d.sales.filter((x) => scopeFilter(d, s)(x));
  const projected = (m: (typeof members)[number]) => round((m.ytd_purchases * cfg.purchase_rebate_pct) / 100 + (m.shares * m.share_value * cfg.share_dividend_pct) / 100);
  return {
    members_in_demo_data: members.length, members_reported_by_coop: s.coopId === "ALL" ? sum(d.coops, (c) => c.members) : d.coops.find((c) => c.id === s.coopId)?.members ?? null,
    voting_eligible: members.filter((m) => m.voting_eligible).length, ytd_purchases_total: round(sum(members, (m) => m.ytd_purchases)),
    shares_total: sum(members, (m) => m.shares), purchase_rebate_pct: cfg.purchase_rebate_pct, share_dividend_pct: cfg.share_dividend_pct,
    projected_dividend_total: round(sum(members, projected)),
    unregistered_sales_pct: coopSales.length ? pct(coopSales.filter((x) => !x.member_id).length, coopSales.length) : null,
    projected,
  };
}
export function memberLookup(d: Data, s: Scope, opts: { memberId?: string; phone?: string } = {}) {
  const st = memberStats(d, s);
  const { projected, ...summary } = st;
  const norm = (p: string) => p.replace(/\D/g, "").slice(-8);
  const found = d.members.filter((m) => (opts.memberId && m.id === opts.memberId) || (opts.phone && norm(m.phone) === norm(opts.phone)));
  return {
    summary,
    members: found.map((m) => ({ id: m.id, name_ar: m.name_ar, name_en: m.name_en, phone: m.phone, class: m.class, shares: m.shares, share_value: m.share_value, ytd_purchases: m.ytd_purchases, voting_eligible: m.voting_eligible, joined_on: m.joined_on, projected_dividend: projected(m) })),
    top_by_purchases: opts.memberId || opts.phone ? undefined : [...d.members.filter((m) => s.coopId === "ALL" || m.coop_id === s.coopId)].sort((a, b) => b.ytd_purchases - a.ytd_purchases).slice(0, 10).map((m) => ({ id: m.id, name_ar: m.name_ar, ytd_purchases: m.ytd_purchases, shares: m.shares, projected_dividend: projected(m) })),
  };
}

// ---------------------------------------------------------------- ministry (story #15, #16)
export function subsidizedBreaches(d: Data) {
  const I = idx(d);
  return d.subsidized_breaches.map((b) => ({ ...b, product_ar: I.product.get(b.product_id)?.name_ar, product_en: I.product.get(b.product_id)?.name_en, branch_ar: I.branch.get(b.branch_id)?.name_ar, branch_en: I.branch.get(b.branch_id)?.name_en, coop_id: I.branch.get(b.branch_id)?.coop_id, over_cap_kd: round(b.sold_price - b.cap_price) }));
}
export type MinistryMetric = "sales" | "waste_pct" | "void_rate" | "variance" | "subsidized_breaches" | "rent_arrears" | "attendance" | "vacant_spaces";
export const MINISTRY_METRICS: MinistryMetric[] = ["sales", "waste_pct", "void_rate", "variance", "subsidized_breaches", "rent_arrears", "attendance", "vacant_spaces"];
export const MINISTRY_DOWN_IS_GOOD: Record<MinistryMetric, boolean> = { sales: false, waste_pct: true, void_rate: true, variance: true, subsidized_breaches: true, rent_arrears: true, attendance: false, vacant_spaces: true };
export function coopMetric(d: Data, coopId: string, metric: MinistryMetric, periodDays = 90): number | null {
  const s: Scope = { coopId, branchId: null }; const r = periodRange(d, periodDays);
  switch (metric) {
    case "sales": return salesAgg(d, s, r).revenue;
    case "waste_pct": { const a = salesAgg(d, s, r); return a.revenue ? round((wasteValue(d, s, r) / a.revenue) * 100, 2) : null; }
    case "void_rate": { const a = salesAgg(d, s, r); return a.invoices ? round(((a.voids + a.refunds) / a.invoices) * 100, 2) : null; }
    case "variance": return shiftVarianceTotal(d, s, r);
    case "subsidized_breaches": return d.subsidized_breaches.filter((b) => idx(d).branch.get(b.branch_id)?.coop_id === coopId).length;
    case "rent_arrears": { const hasSpaces = d.spaces.some((x) => scopeFilter(d, s)(x)); return hasSpaces ? round(sum(rentArrears(d, s), (x) => x.amount)) : null; }
    case "attendance": return attendanceRate(d, s, r);
    case "vacant_spaces": { const hasSpaces = d.spaces.some((x) => scopeFilter(d, s)(x)); return hasSpaces ? d.spaces.filter((x) => scopeFilter(d, s)(x) && x.status === "available").length : null; }
  }
}
export function ministryCompare(d: Data, metric: MinistryMetric, periodDays = 90) {
  const rows = d.coops.map((c) => ({ coop_id: c.id, name_ar: c.name_ar, name_en: c.name_en, value: coopMetric(d, c.id, metric, periodDays) }));
  const vals = rows.filter((x) => x.value != null).map((x) => x.value!);
  const network = vals.length ? round(sum(vals, (v) => v) / vals.length, 2) : null;
  const ranked = rows.map((x) => {
    const others = rows.filter((y) => y.coop_id !== x.coop_id && y.value != null).map((y) => y.value!);
    const othersAvg = others.length ? sum(others, (v) => v) / others.length : null;
    return { ...x, vs_network_avg: x.value != null && network ? round(x.value / network, 2) : null, vs_other_coops: x.value != null && othersAvg ? round(x.value / othersAvg, 2) : null };
  }).sort((a, b) => (MINISTRY_DOWN_IS_GOOD[metric] ? (b.value ?? -1) - (a.value ?? -1) : (a.value ?? Infinity) - (b.value ?? Infinity)));
  return { metric, period_days: periodDays, network_average: network, down_is_good: MINISTRY_DOWN_IS_GOOD[metric], coops_ranked_worst_first: ranked, data_note: vals.length < rows.length ? "some_coops_have_no_data_for_metric" : null };
}

// ---------------------------------------------------------------- finance
export function financeQueue(d: Data) {
  const stages = ["pending_review", "reviewed", "chair_approved", "posted"];
  return {
    by_stage: stages.map((st) => { const inv = d.supplier_invoices.filter((x) => x.status === st); return { stage: st, count: inv.length, amount_kd: round(sum(inv, (x) => x.amount)) }; }),
    three_way_match_exceptions: d.supplier_invoices.filter((x) => x.three_way_match !== "matched" && x.status !== "posted").map((x) => ({ id: x.id, supplier_id: x.supplier_id, amount: x.amount, status: x.status, issue: x.three_way_match, po_id: x.po_id, grn_id: x.grn_id })),
    approval_chain: ["reviewer", "chair", "treasurer"],
  };
}
