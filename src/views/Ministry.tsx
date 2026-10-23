import { Bot } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, Note, Table, ViewHeader, cx } from "../components/ui";
import { fmtKd, fmtNum, fmtPct, nameOf, pick } from "../lib/format";
import * as M from "../lib/metrics";
import { useD } from "../store/data";
import { useUi } from "../store/ui";

const fmtMetric = (m: M.MinistryMetric, v: number | null, lang: string) =>
  v == null ? "—" : m === "sales" || m === "variance" || m === "rent_arrears" ? fmtKd(v, lang) : m === "waste_pct" || m === "void_rate" || m === "attendance" ? fmtPct(v, 2) : fmtNum(v);

export function Ministry() {
  const { t } = useTranslation();
  const d = useD();
  const { lang, askAgent, view } = useUi();
  const table = useMemo(() => M.MINISTRY_METRICS.map((m) => ({ m, ...M.ministryCompare(d, m) })), [d]);
  const breaches = M.subsidizedBreaches(d);
  const alerts = d.agent_alerts.filter((a) => a.ministry);
  // Inspector notes are generated from the planted findings (no free-text notes exist in the data).
  const notes = [
    { id: "N-1", coop: "C3", key: "ghosts", vals: { n: M.ghostEmployees(d, { coopId: "C3", branchId: null }).count } },
    { id: "N-2", coop: "C3", key: "waste", vals: { x: fmtNum(table.find((r) => r.m === "waste_pct")!.coops_ranked_worst_first.find((c) => c.coop_id === "C3")!.vs_other_coops, 1) } },
    { id: "N-3", coop: null, key: "rice", vals: { n: breaches.length } },
    { id: "N-4", coop: "C1", key: "arrears", vals: { n: M.rentArrears(d, { coopId: "C1", branchId: null }).length } },
  ];
  return (
    <div className="space-y-4">
      <Note tone="warn"><span data-testid="ministry-banner" className="font-medium">{t("ministry.banner")}</span></Note>
      <ViewHeader title={t("nav.ministry")} subtitle={t("ministry.subtitle")} />
      <Card title={t("ministry.compare")} bodyClass="p-0">
        <div className="overflow-x-auto scroll-thin">
          <table className="tbl" data-testid="ministry-compare">
            <thead><tr><th>{t("ministry.metric")}</th>{d.coops.map((c) => <th key={c.id} className="text-end">{nameOf(c, lang)}</th>)}<th className="text-end">{t("ministry.networkAvg")}</th></tr></thead>
            <tbody>
              {table.map((row) => {
                const worst = row.coops_ranked_worst_first[0];
                return (
                  <tr key={row.m}>
                    <td className="whitespace-nowrap">{t(`ministry.metrics.${row.m}`)}</td>
                    {d.coops.map((c) => { const v = row.coops_ranked_worst_first.find((x) => x.coop_id === c.id)!; const isWorst = v.coop_id === worst.coop_id && v.value != null && (worst.vs_other_coops ?? 1) > 1.3 && row.m !== "sales";
                      return <td key={c.id} className={cx("text-end num whitespace-nowrap", isWorst && "text-bad font-semibold")}>{fmtMetric(row.m, v.value, lang)}{isWorst && v.vs_other_coops ? <span className="ms-1 text-xs">(×{fmtNum(v.vs_other_coops, 1)})</span> : null}</td>; })}
                    <td className="text-end num text-text-2 whitespace-nowrap">{fmtMetric(row.m, row.network_average, lang)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-3 py-2 text-xs text-text-2 border-t border-border">{t("ministry.compareNote")}</p>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={t("ministry.alerts")} bodyClass="p-0">
          <ul className="divide-y divide-border">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Badge tone="bad">{t(`severity.${a.severity}`)}</Badge>
                <span className="flex-1 min-w-[10rem] text-sm">{pick(a as unknown as Record<string, unknown>, "title", lang)}</span>
                <button className="btn text-accent" onClick={() => askAgent(pick(a as unknown as Record<string, unknown>, "question", lang), { coop_id: "ALL", branch_id: null, record_id: a.id, view })}><Bot size={14} />{t("common.askAgent")}</button>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={t("ministry.notes")} bodyClass="p-0">
          <ul className="divide-y divide-border text-sm">
            {notes.map((n) => <li key={n.id} className="px-4 py-3"><span className="text-xs text-text-2 font-mono me-2" dir="ltr">{n.id}</span>{n.coop && <Badge tone="muted">{nameOf(d.coops.find((c) => c.id === n.coop), lang)}</Badge>} <span className="ms-1">{t(`ministry.note.${n.key}`, n.vals)}</span></li>)}
          </ul>
        </Card>
      </div>
      <Card title={t("ministry.breaches")} bodyClass="p-0">
        <Table testId="breaches-table" rows={breaches} rowKey={(r) => r.id} cols={[
          { key: "b", label: t("shell.branch"), render: (r) => <span>{nameOf(d.coops.find((c) => c.id === r.coop_id), lang)} · {lang === "ar" ? r.branch_ar : r.branch_en} <span className="font-mono text-xs text-text-2" dir="ltr">{r.branch_id}</span></span> },
          { key: "p", label: t("common.product"), render: (r) => (lang === "ar" ? r.product_ar : r.product_en) },
          { key: "cap", label: t("ministry.cap"), num: true, render: (r) => fmtKd(r.cap_price, lang) },
          { key: "sold", label: t("ministry.soldAt"), num: true, render: (r) => <span className="text-bad font-medium">{fmtKd(r.sold_price, lang)}</span> },
          { key: "since", label: t("ministry.since"), render: (r) => <span className="num" dir="ltr">{r.since}</span> },
          { key: "inv", label: t("ministry.invoices"), num: true, render: (r) => fmtNum(r.invoices) },
        ]} />
      </Card>
    </div>
  );
}
