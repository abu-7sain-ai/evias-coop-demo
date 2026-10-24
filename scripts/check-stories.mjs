#!/usr/bin/env node
// Asserts every planted story figure (spec/05-SCENARIOS.md + owner answers in PLAN.md) directly from public/data.
// Independent of the app code on purpose: if the generator drifts, this fails before any screen does.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = process.argv[2] ?? "public/data";
const D = (n) => JSON.parse(readFileSync(join(DIR, `${n}.json`), "utf8"));
let failed = 0;
const ok = (name, cond, detail) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); if (!cond) failed++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const sales = D("sales"), items = D("sale_items"), voids = D("voids"), shifts = D("shifts"), cm = D("cash_movements");
const products = D("products"), suppliers = D("suppliers"), deliveries = D("supplier_deliveries");
const fx = D("floorplan").fixtures, traffic = D("traffic"), sl = D("stock_locations"), sr = D("shelf_reservations");
const lots = D("lots"), complaints = D("complaints"), promotions = D("promotions");
const li = D("lease_invoices"), spaces = D("spaces"), employees = D("employees"), attendance = D("attendance");
const wo = D("writeoffs"), daily = D("daily_sales"), sb = D("subsidized_breaches"), ramadan = D("ramadan"), members = D("members");

const LAST30 = "2026-10-02"; // last 30 days = 2026-10-02 … 2026-10-31 (demo date 2026-11-01)
const dow = (s) => new Date(s + "T00:00:00Z").getUTCDay();

// #1 Khalid × friend
const friend = sales.filter((s) => s.phone === "+965 99990007");
ok("#1 friend phone: exactly 9 sales, all Khalid, last 30d, cash, line void", friend.length === 9 && friend.every((s) => s.cashier_id === "EMP-001" && s.date >= LAST30 && s.payment === "cash" && s.line_voids > 0), `n=${friend.length}`);
const kv = {}; sales.filter((s) => s.cashier_id === "EMP-001" && s.date >= LAST30 && s.line_voids > 0 && s.phone).forEach((s) => (kv[s.phone] = (kv[s.phone] ?? 0) + 1));
const top = Object.entries(kv).sort((a, b) => b[1] - a[1]);
ok("#1 friend is Khalid's top repeated phone on voided invoices", top[0][0] === "+965 99990007" && top[0][1] === 9 && top[1][1] < 9, top.slice(0, 2).join(" | "));
// #1b
const pcv = voids.filter((v) => v.flagged === "post_cash_void");
ok("#1b 6 post-cash voids, last 30d, 12–35 min, approver EMP-007", pcv.length === 6 && pcv.every((v) => v.date >= LAST30 && v.minutes_after_sale >= 12 && v.minutes_after_sale <= 35 && v.approved_by === "EMP-007"));
ok("#1b Khalid has exactly 6 cash voids in the last 30 days", voids.filter((v) => v.cashier_id === "EMP-001" && v.date >= LAST30 && v.payment === "cash").length === 6);
// #2
const tue = shifts.filter((s) => s.cashier_id === "EMP-001" && s.shift === "PM" && dow(s.date) === 2);
const avgVar = tue.reduce((a, s) => a + s.variance, 0) / tue.length;
const ns = tue.every((s) => cm.filter((c) => c.shift_id === s.id && c.type === "no_sale").length === 3);
ok("#2 Khalid Tue PM: 13/13 disputed, avg ≈ −8, 3 no-sale each", tue.length === 13 && tue.every((s) => s.status === "disputed") && near(avgVar, -8, 1) && ns, `avg=${avgVar.toFixed(3)}`);
// #3
const lot = lots.find((l) => l.id === "LOT-4471");
ok("#3 LOT-4471: P003, SUP-01, 96 units, expires 2026-11-07, 3 complaints", lot && lot.product_id === "P003" && lot.supplier_id === "SUP-01" && lot.qty === 96 && lot.expiry === "2026-11-07" && complaints.filter((c) => c.lot_id === "LOT-4471").length === 3);
ok("#3 PR-002 on hold", promotions.find((p) => p.id === "PR-002")?.status === "blocked");
// #4
const leaks = products.filter((p) => p.cost > p.price);
ok("#4 14 products below cost, cost change 2026-10-18", leaks.length === 14 && leaks.every((p) => p.cost_history.at(-1).date === "2026-10-18"));
const m = (id) => { const p = products.find((x) => x.id === id); return +(p.price - p.cost).toFixed(3); };
ok("#4 P054 −0.227, P045 −0.173", m("P054") === -0.227 && m("P045") === -0.173, `${m("P054")} ${m("P045")}`);
// #5
const pr1 = promotions.find((p) => p.id === "PR-001");
ok("#5 PR-001 planned 120 sold 90 saved 180", pr1.planned_units === 120 && pr1.sold_units === 90 && pr1.waste_avoided_kd === 180);
// #6
const saffron = new Set(items.filter((i) => i.product_id === "P049").map((i) => i.sale_id));
const lastSaffron = sales.filter((s) => s.branch_id === "C1-B1" && saffron.has(s.id)).map((s) => s.date).sort().at(-1);
const daysSince = Math.round((Date.parse("2026-11-01") - Date.parse(lastSaffron)) / 864e5);
ok("#6 saffron at B1: last sale 61 days ago, on A06-END-C1 L3, 24 units", daysSince === 61 && sl.some((s) => s.fixture_id === "A06-END-C1" && s.level === 3 && s.product_id === "P049" && s.qty_on_shelf === 24), `last=${lastSaffron}`);
// #7 / #8 traffic + sales per metre
const tsum = {}; traffic.forEach((r) => (tsum[r.fixture_id] = (tsum[r.fixture_id] ?? 0) + r.score));
const trank = Object.entries(tsum).filter(([id]) => fx.find((f) => f.id === id).floor === "G").sort((a, b) => b[1] - a[1]).map((r) => r[0]);
ok("#8 A02-END-C2 traffic top-5 (ground floor)", trank.indexOf("A02-END-C2") < 5, `rank=${trank.indexOf("A02-END-C2") + 1}`);
const ids30 = new Set(sales.filter((s) => s.branch_id === "C1-B1" && s.date >= LAST30).map((s) => s.id));
const rev = {}; items.forEach((i) => { if (ids30.has(i.sale_id)) rev[i.product_id] = (rev[i.product_id] ?? 0) + i.qty * i.unit_price; });
const facings = {}; sl.forEach((s) => (facings[s.product_id] = (facings[s.product_id] ?? 0) + s.facings));
const fixSales = {}; sl.forEach((s) => (fixSales[s.fixture_id] = (fixSales[s.fixture_id] ?? 0) + (rev[s.product_id] ?? 0) * s.facings / facings[s.product_id]));
const spm = Object.entries(fixSales).map(([id, v]) => { const f = fx.find((x) => x.id === id); return [id, v / Math.max(f.w, f.h)]; }).sort((a, b) => a[1] - b[1]);
const median = spm[Math.floor(spm.length / 2)][1];
ok("#8 A02-END-C2 sales/m below branch median", spm.find((r) => r[0] === "A02-END-C2")[1] < median);
const a02 = sr.find((r) => r.fixture_id === "A02-END-C2");
ok("#8 A02-END-C2: SUP-04, 180 KD, ends 2026-12-16 (45 d)", a02.supplier_id === "SUP-04" && a02.monthly_rent === 180 && a02.ends_on === "2026-12-16" && a02.days_to_expiry === 45);
// #9
const m07 = li.filter((x) => x.space_id === "M-07" && x.status === "overdue");
ok("#9 M-07: 2 overdue × 530, oldest 45 days", m07.length === 2 && m07.every((x) => x.amount === 530) && Math.max(...m07.map((x) => x.days_late)) === 45);
ok("#9 M-16 vacant 140 d (rent 400), K-04 vacant 35 d", spaces.find((s) => s.id === "M-16").vacant_days === 140 && spaces.find((s) => s.id === "M-16").monthly_rent === 400 && spaces.find((s) => s.id === "K-04").vacant_days === 35);
// #11
ok("#11 Ramadan 2027-02-08, 99 days", ramadan.starts_on === "2027-02-08" && ramadan.days_until === 99);
// #12 queue: people waiting = Σ score(POS-01..06) × 0.057; per lane = that ÷ open lanes (constant in src/lib/metrics.ts)
const QK = 0.057;
const q = (day, hour) => traffic.filter((r) => /^POS-0[1-6]$/.test(r.fixture_id) && r.day === day && r.hour === hour).reduce((a, r) => a + r.score, 0) * QK;
const thu = [19, 20, 21].map((h) => q("Thu", h));
ok("#12 Thu 19–21: ≈8/lane with 6 lanes, ≈6 with 8", thu.every((v) => near(v / 6, 8, 1.1) && near(v / 8, 6, 0.9)), thu.map((v) => `${(v / 6).toFixed(1)}/${(v / 8).toFixed(1)}`).join(" "));
const yousefSun = attendance.filter((a) => a.employee_id === "EMP-003" && dow(a.date) === 0 && a.punch_in);
ok("#12 Yousef late every Sunday 20–45 min", yousefSun.length > 10 && yousefSun.every((a) => a.late_minutes >= 20 && a.late_minutes <= 45));
// #13
const s12 = deliveries.filter((d) => d.supplier_id === "SUP-12");
ok("#13 SUP-12: late 4/6, short 2, near-expiry 3", s12.filter((d) => d.late).length === 4 && s12.filter((d) => d.short).length === 2 && s12.filter((d) => d.near_expiry).length === 3);
// #14
const c1 = sales.filter((s) => s.coop_id === "C1");
const unreg = c1.filter((s) => !s.member_id).length / c1.length;
ok("#14 60 members per coop, unregistered ≈ 28%", members.filter((x) => x.coop_id === "C1").length === 60 && near(unreg, 0.28, 0.02), `${(unreg * 100).toFixed(1)}%`);
// #15
ok("#15 rice cap breaches at C1-B2 3.450, C2-B1 3.400, C2-B3 3.500, C3-B2 3.600", JSON.stringify(sb.map((b) => [b.branch_id, b.sold_price])) === JSON.stringify([["C1-B2", 3.45], ["C2-B1", 3.4], ["C2-B3", 3.5], ["C3-B2", 3.6]]));
// #16 waste % = waste value ÷ sales; C3 ≈ 3× the other coops
const salesBy = {}; sales.forEach((s) => (salesBy[s.coop_id] = (salesBy[s.coop_id] ?? 0) + s.total)); daily.forEach((s) => (salesBy[s.coop_id] = (salesBy[s.coop_id] ?? 0) + s.revenue));
const wBy = {}; wo.forEach((w) => (wBy[w.coop_id] = (wBy[w.coop_id] ?? 0) + w.value));
const pct = (c) => wBy[c] / salesBy[c];
const ratio = pct("C3") / ((pct("C1") + pct("C2")) / 2);
ok("#16 C3 waste % ≈ 3× the other coops", ratio >= 2.5 && ratio <= 3.6, ratio.toFixed(2));
// #17
const ghosts = employees.filter((e) => e.coop_id === "C3" && e.branch_id === "C3-B2" && !attendance.some((a) => a.employee_id === e.id));
ok("#17 6 zero-punch employees at C3-B2, ≈ 2,400 KD (±150)", ghosts.length === 6 && near(ghosts.reduce((a, e) => a + e.salary, 0), 2400, 150), `${ghosts.reduce((a, e) => a + e.salary, 0)}`);
// No produce
ok("no vegetables / produce in products", !products.some((p) => /veg|vegetable|produce|خضار|خضروات/i.test(p.name_en + p.name_ar + p.category_en + p.category_ar)));
// Dashboard shaping (last 7 days vs previous 7, coop C1)
const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const inR = (d, a, b) => d >= a && d < b;
const w7 = sum(wo.filter((w) => w.coop_id === "C1" && inR(w.date, "2026-10-25", "2026-11-01")), (w) => w.value);
const wp = sum(wo.filter((w) => w.coop_id === "C1" && inR(w.date, "2026-10-18", "2026-10-25")), (w) => w.value);
ok("dashboard: C1 waste down", w7 < wp, `${w7.toFixed(1)} vs ${wp.toFixed(1)}`);
const v7 = sum(shifts.filter((s) => inR(s.date, "2026-10-25", "2026-11-01")), (s) => Math.abs(s.variance));
const vp = sum(shifts.filter((s) => inR(s.date, "2026-10-18", "2026-10-25")), (s) => Math.abs(s.variance));
ok("dashboard: C1 shift variance up", v7 > vp, `${v7.toFixed(1)} vs ${vp.toFixed(1)}`);
const rate = (mo) => { const inv = li.filter((x) => x.due_on.startsWith(mo)); return sum(inv.filter((x) => x.paid_on && x.paid_on.slice(0, 7) === mo), (x) => x.amount) / sum(inv, (x) => x.amount); };
ok("dashboard: rent collected Oct > Sep", rate("2026-10") > rate("2026-09"), `${(rate("2026-10") * 100).toFixed(1)}% vs ${(rate("2026-09") * 100).toFixed(1)}%`);

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll story checks passed");
process.exit(failed ? 1 : 0);
