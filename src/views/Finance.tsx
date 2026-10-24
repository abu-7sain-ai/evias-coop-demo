import { ArrowRight, Check, Circle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, Stat, Table, Tabs, ViewHeader, cx } from "../components/ui";
import { fmtKd, nameOf } from "../lib/format";
import * as M from "../lib/metrics";
import { useD } from "../store/data";
import { useUi } from "../store/ui";

type Tab = "invoices" | "journal" | "trial" | "rent";

export function Finance() {
  const { t } = useTranslation();
  const d = useD();
  const { lang } = useUi();
  const [tab, setTab] = useState<Tab>("invoices");
  const q = M.financeQueue(d);
  // Journal entries derived from the demo documents (no separate ledger in the data): one entry per posted supplier invoice and per rent receipt.
  const journal = [
    ...d.supplier_invoices.filter((x) => x.status === "posted").map((x) => ({ id: `JE-${x.id}`, date: d.grns.find((g) => g.id === x.grn_id)?.received_on ?? "", ref: x.id, debit: "inventory", credit: "payables", amount: x.amount })),
    ...d.lease_invoices.filter((x) => x.paid_on).map((x) => ({ id: `JE-${x.id}`, date: x.paid_on!, ref: x.id, debit: "cash", credit: "rentIncome", amount: x.amount })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const sum = (arr: { amount: number }[]) => M.round(arr.reduce((a, x) => a + x.amount, 0));
  const accounts = ["cash", "inventory", "payables", "rentIncome"].map((acc) => {
    const dr = sum(journal.filter((j) => j.debit === acc)); const cr = sum(journal.filter((j) => j.credit === acc));
    return { acc, dr, cr };
  });
  const Step = ({ ok }: { ok: boolean }) => ok ? <Check size={14} className="text-good" aria-label="✓" /> : <Circle size={12} className="text-text-2" aria-hidden />;
  return (
    <div className="space-y-4">
      <ViewHeader title={t("nav.finance")} subtitle={t("finance.subtitle")} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {q.by_stage.map((s) => <Stat key={s.stage} label={t(`invStatus.${s.stage}`)} value={fmtKd(s.amount_kd, lang)} sub={t("finance.invoicesCount", { n: s.count })} />)}
      </div>
      <Card bodyClass="p-0" title={<Tabs value={tab} onChange={setTab} testId="finance-tabs" tabs={[{ key: "invoices", label: t("finance.tabs.invoices") }, { key: "journal", label: t("finance.tabs.journal") }, { key: "trial", label: t("finance.tabs.trial") }, { key: "rent", label: t("finance.tabs.rent") }]} />}>
        {tab === "invoices" && <Table testId="supplier-invoices" pageSize={25} rows={d.supplier_invoices} rowKey={(r) => r.id} cols={[
          { key: "id", label: t("finance.invoice"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.id}</span> },
          { key: "s", label: t("map.panel.supplier"), render: (r) => nameOf(d.suppliers.find((s) => s.id === r.supplier_id), lang) },
          { key: "po", label: t("finance.poGrn"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.po_id} / {r.grn_id}</span> },
          { key: "a", label: t("sales.amount"), num: true, render: (r) => fmtKd(r.amount, lang) },
          { key: "due", label: t("finance.due"), render: (r) => <span className="num" dir="ltr">{r.due_on}</span> },
          { key: "m", label: t("finance.match"), render: (r) => <Badge tone={r.three_way_match === "matched" ? "good" : "bad"}>{t(`match.${r.three_way_match}`)}</Badge> },
          { key: "ap", label: t("finance.approvals"), render: (r) => (
            <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
              <Step ok={r.approvals.reviewer} />{t("finance.reviewed")}<ArrowRight size={12} className="text-text-2 rtl:rotate-180" aria-hidden />
              <Step ok={r.approvals.chair} />{t("finance.chair")}<ArrowRight size={12} className="text-text-2 rtl:rotate-180" aria-hidden />
              <Step ok={r.approvals.treasurer} />{t("finance.treasurer")}
            </span>) },
          { key: "st", label: t("map.panel.status"), render: (r) => <Badge tone={r.status === "posted" ? "good" : r.status === "pending_review" ? "warn" : "info"}>{t(`invStatus.${r.status}`)}</Badge> },
        ]} />}
        {tab === "journal" && <Table testId="journal" pageSize={25} rows={journal} rowKey={(r) => r.id} cols={[
          { key: "id", label: t("finance.entry"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.id}</span> },
          { key: "d", label: t("sales.date"), render: (r) => <span className="num" dir="ltr">{r.date}</span> },
          { key: "dr", label: t("finance.debit"), render: (r) => t(`account.${r.debit}`) },
          { key: "cr", label: t("finance.credit"), render: (r) => t(`account.${r.credit}`) },
          { key: "a", label: t("sales.amount"), num: true, render: (r) => fmtKd(r.amount, lang) },
        ]} />}
        {tab === "trial" && (
          <div>
            <Table testId="trial-balance" rows={accounts} rowKey={(r) => r.acc} cols={[
              { key: "a", label: t("finance.account"), render: (r) => t(`account.${r.acc}`) },
              { key: "dr", label: t("finance.debit"), num: true, render: (r) => fmtKd(r.dr, lang) },
              { key: "cr", label: t("finance.credit"), num: true, render: (r) => fmtKd(r.cr, lang) },
            ]} />
            <div className={cx("flex justify-end gap-6 border-t border-border px-3 py-2 text-sm font-medium num")}>
              <span>{t("finance.totals")}: {fmtKd(sum(accounts.map((a) => ({ amount: a.dr }))), lang)} / {fmtKd(sum(accounts.map((a) => ({ amount: a.cr }))), lang)}</span>
            </div>
            <p className="px-3 pb-3 text-xs text-text-2">{t("finance.trialNote")}</p>
          </div>
        )}
        {tab === "rent" && <Table testId="rent-invoices" pageSize={25} rows={[...d.lease_invoices].sort((a, b) => b.due_on.localeCompare(a.due_on))} rowKey={(r) => r.id} rowClass={(r) => (r.status === "overdue" ? "bg-bad/10" : undefined)} cols={[
          { key: "id", label: t("finance.invoice"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.id}</span> },
          { key: "sp", label: t("map.panel.code"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.space_id}</span> },
          { key: "t", label: t("map.panel.tenant"), render: (r) => nameOf(d.tenants.find((x) => x.id === r.tenant_id), lang) },
          { key: "due", label: t("finance.due"), render: (r) => <span className="num" dir="ltr">{r.due_on}</span> },
          { key: "a", label: t("sales.amount"), num: true, render: (r) => fmtKd(r.amount, lang) },
          { key: "p", label: t("finance.paidOn"), render: (r) => <span className="num" dir="ltr">{r.paid_on ?? "—"}</span> },
          { key: "st", label: t("map.panel.status"), render: (r) => <Badge tone={r.status === "overdue" ? "bad" : r.days_late ? "warn" : "good"}>{r.status === "overdue" ? t("spaces.daysLate", { n: r.days_late }) : r.days_late ? t("finance.paidLate", { n: r.days_late }) : t("finance.paid")}</Badge> },
        ]} />}
      </Card>
    </div>
  );
}
