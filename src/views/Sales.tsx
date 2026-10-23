import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, Note, Table, Tabs, ViewHeader } from "../components/ui";
import { fmtKd, fmtNum, nameOf } from "../lib/format";
import * as M from "../lib/metrics";
import type { Day } from "../lib/types";
import { useD } from "../store/data";
import { useUi } from "../store/ui";

type Tab = "sales" | "voids" | "shifts";

export function Sales() {
  const { t } = useTranslation();
  const d = useD();
  const { lang, coopId, branchId } = useUi();
  const [tab, setTab] = useState<Tab>("sales");
  const [hour, setHour] = useState(20);
  const scope = { coopId, branchId };
  const I = M.idx(d);
  const branches = M.branchesInScope(d, scope);
  const ids = new Set(branches.map((b) => b.id));
  const lastDay = M.addDays(M.demoDate(d), -1);
  const lastDow = M.dayOfWeek(lastDay) as Day;
  const sales = useMemo(() => d.sales.filter((s) => ids.has(s.branch_id)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), [d, coopId, branchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const vr = useMemo(() => [
    ...d.voids.filter((v) => ids.has(v.branch_id)).map((v) => ({ kind: "void" as const, id: v.id, sale_id: v.sale_id, cashier_id: v.cashier_id, approved_by: v.approved_by, reason: v.reason, minutes: v.minutes_after_sale, date: v.date, amount: v.amount, payment: v.payment, flagged: !!v.flagged })),
    ...d.refunds.filter((v) => ids.has(v.branch_id)).map((v) => ({ kind: "refund" as const, id: v.id, sale_id: v.sale_id, cashier_id: v.cashier_id, approved_by: v.approved_by, reason: v.reason, minutes: v.minutes_after_sale, date: v.date, amount: v.amount, payment: v.refund_method, flagged: false })),
  ].sort((a, b) => b.date.localeCompare(a.date)), [d, coopId, branchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const shifts = useMemo(() => d.shifts.filter((s) => ids.has(s.branch_id)).sort((a, b) => b.date.localeCompare(a.date) || a.shift.localeCompare(b.shift)), [d, coopId, branchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const emp = (id: string | null) => nameOf(id ? I.employee.get(id) : undefined, lang) || "—";

  return (
    <div className="space-y-4">
      <ViewHeader title={t("nav.sales")} subtitle={t("sales.subtitle", { day: lastDay })}
        actions={<label className="flex items-center gap-2 text-sm"><span className="text-text-2">{t("map.hour")}</span>
          <input type="range" min={8} max={23} value={hour} onChange={(e) => setHour(+e.target.value)} className="w-32" aria-label={t("map.hour")} />
          <span className="num w-12" dir="ltr">{String(hour).padStart(2, "0")}:00</span></label>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="branch-cards">
        {branches.map((b) => {
          const a = M.salesAgg(d, { coopId: b.coop_id, branchId: b.id }, { from: lastDay, to: M.demoDate(d) });
          const mapped = b.id === M.mappedBranch(d);
          const lanes = mapped ? 6 : null;
          const q = mapped ? M.queuePerLane(d, lastDow, hour, 6) : null;
          return (
            <div key={b.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2"><span className="font-medium truncate">{nameOf(b, lang)}</span><span className="text-xs text-text-2 font-mono" dir="ltr">{b.id}</span></div>
              <div className="text-xl font-semibold num">{fmtKd(a.revenue, lang)}</div>
              <div className="flex flex-wrap gap-2 text-xs text-text-2">
                <span>{t("sales.invoices", { n: fmtNum(a.invoices) })}</span>
                <span>· {t("sales.lanes", { open: lanes ?? "—", total: b.lanes })}</span>
                {q != null && <Badge tone={q > M.QUEUE_ALERT ? "bad" : "muted"}>{t("sales.queueAt", { day: t(`days.${lastDow}`), hour, n: fmtNum(q, 1) })}</Badge>}
              </div>
            </div>
          );
        })}
      </div>
      <Card bodyClass="p-0" title={<Tabs value={tab} onChange={setTab} testId="sales-tabs" tabs={[{ key: "sales", label: t("sales.tabs.sales") }, { key: "voids", label: t("sales.tabs.voids") }, { key: "shifts", label: t("sales.tabs.shifts") }]} />}>
        {tab === "sales" && (sales.length ? (
          <Table testId="sales-table" pageSize={25} rows={sales} rowKey={(r) => r.id} rowClass={(r) => (r.flagged ? "bg-warn/10" : undefined)} cols={[
            { key: "id", label: t("sales.invoice"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.id}</span> },
            { key: "dt", label: t("sales.dateTime"), render: (r) => <span className="num whitespace-nowrap" dir="ltr">{r.date} {r.time}</span> },
            { key: "b", label: t("shell.branch"), render: (r) => nameOf(I.branch.get(r.branch_id), lang) },
            { key: "c", label: t("sales.cashier"), render: (r) => emp(r.cashier_id) },
            { key: "m", label: t("sales.member"), render: (r) => (r.member_id ? <span className="font-mono text-xs" dir="ltr">{r.member_id}</span> : <span className="text-text-2">{t("sales.unregistered")}</span>) },
            { key: "p", label: t("sales.payment"), render: (r) => t(`payment.${r.payment}`) },
            { key: "lv", label: t("sales.lineVoids"), num: true, render: (r) => (r.line_voids ? <span className="text-warn">{r.line_voids}</span> : "—") },
            { key: "tot", label: t("sales.total"), num: true, render: (r) => fmtKd(r.total, lang) },
          ]} />
        ) : <div className="p-4"><Note>{t("sales.aggregatedOnly")}</Note></div>)}
        {tab === "voids" && (
          <Table testId="voids-table" pageSize={25} rows={vr} rowKey={(r) => r.id} rowClass={(r) => (r.flagged ? "bg-bad/10" : undefined)} cols={[
            { key: "id", label: t("sales.ref"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.id}</span> },
            { key: "k", label: t("sales.kind"), render: (r) => <Badge tone={r.kind === "void" ? "warn" : "info"}>{t(`sales.${r.kind}`)}</Badge> },
            { key: "d", label: t("sales.date"), render: (r) => <span className="num" dir="ltr">{r.date}</span> },
            { key: "c", label: t("sales.cashier"), render: (r) => emp(r.cashier_id) },
            { key: "a", label: t("sales.approver"), render: (r) => emp(r.approved_by) },
            { key: "r", label: t("sales.reason"), render: (r) => t(`reason.${r.reason}`) },
            { key: "p", label: t("sales.payment"), render: (r) => t(`payment.${r.payment}`) },
            { key: "m", label: t("sales.minutesAfter"), num: true, render: (r) => fmtNum(r.minutes) },
            { key: "amt", label: t("sales.amount"), num: true, render: (r) => fmtKd(r.amount, lang) },
          ]} />
        )}
        {tab === "shifts" && (
          <Table testId="shifts-table" pageSize={25} rows={shifts} rowKey={(r) => r.id} rowClass={(r) => (r.status === "disputed" ? "bg-bad/10" : undefined)} empty={t("sales.aggregatedOnly")} cols={[
            { key: "d", label: t("sales.date"), render: (r) => <span className="num whitespace-nowrap" dir="ltr">{r.date} <span className="text-text-2">{t(`days.${M.dayOfWeek(r.date)}`)}</span></span> },
            { key: "s", label: t("sales.shift"), render: (r) => t(`shift.${r.shift}`) },
            { key: "c", label: t("sales.cashier"), render: (r) => emp(r.cashier_id) },
            { key: "f", label: t("sales.float"), num: true, render: (r) => fmtKd(r.opening_float, lang) },
            { key: "e", label: t("sales.expected"), num: true, render: (r) => fmtKd(r.expected_cash, lang) },
            { key: "ct", label: t("sales.counted"), num: true, render: (r) => fmtKd(r.counted_cash, lang) },
            { key: "v", label: t("sales.variance"), num: true, render: (r) => <span className={Math.abs(r.variance) > M.SHIFT_TOLERANCE_KD ? "text-bad font-medium" : ""}>{fmtKd(r.variance, lang)}</span> },
            { key: "ns", label: t("sales.noSale"), num: true, render: (r) => fmtNum(r.no_sale_opens) },
            { key: "a", label: t("sales.approver"), render: (r) => emp(r.approved_by) },
            { key: "st", label: t("map.panel.status"), render: (r) => <Badge tone={r.status === "disputed" ? "bad" : "good"}>{t(`shiftStatus.${r.status}`)}</Badge> },
          ]} />
        )}
      </Card>
    </div>
  );
}
