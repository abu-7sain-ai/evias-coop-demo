import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, Card, Note, Table, ViewHeader } from "../components/ui";
import { nameOf } from "../lib/format";
import * as M from "../lib/metrics";
import { useD } from "../store/data";
import { useUi } from "../store/ui";

export function Complaints() {
  const { t } = useTranslation();
  const d = useD();
  const { lang, coopId, branchId, askAgent, view } = useUi();
  const q = M.complaintsQuery(d, { coopId, branchId });
  const I = M.idx(d);
  return (
    <div className="space-y-4">
      <ViewHeader title={t("nav.complaints")} subtitle={t("complaints.subtitle")} />
      {q.clusters_by_lot.map((c) => (
        <Note key={c.lot_id} tone="bad">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t("complaints.cluster", { n: c.count, lot: c.lot_id })}</span>
            <button className="btn" onClick={() => askAgent(t("complaints.askCluster"), { coop_id: coopId, branch_id: branchId, record_id: c.lot_id, view })}><Bot size={14} />{t("common.askAgent")}</button>
          </div>
        </Note>
      ))}
      <Card bodyClass="p-0">
        <Table testId="complaints-table" rows={q.complaints} rowKey={(r) => r.id} rowClass={(r) => (r.lot_id === "LOT-4471" ? "bg-bad/5" : undefined)} cols={[
          { key: "id", label: t("complaints.ticket"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.id}</span> },
          { key: "s", label: t("complaints.subject"), render: (r) => (lang === "ar" ? r.subject_ar : r.subject_en) },
          { key: "c", label: t("complaints.category"), render: (r) => t(`complaintCat.${r.category}`) },
          { key: "p", label: t("complaints.priority"), render: (r) => <Badge tone={r.priority === "high" ? "bad" : "warn"}>{t(`severity.${r.priority}`)}</Badge> },
          { key: "lot", label: t("inventory.lot"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.lot_id ?? "—"}</span> },
          { key: "b", label: t("shell.branch"), render: (r) => nameOf(I.branch.get(r.branch_id), lang) },
          { key: "a", label: t("complaints.assignee"), render: (r) => nameOf(I.employee.get(r.assigned_to), lang) || r.assigned_to },
          { key: "o", label: t("complaints.opened"), render: (r) => <span className="num whitespace-nowrap" dir="ltr">{r.opened_at.replace("T", " ")}</span> },
          { key: "due", label: t("finance.due"), render: (r) => <span className="num whitespace-nowrap" dir="ltr">{r.due_at.replace("T", " ")}</span> },
          { key: "st", label: t("map.panel.status"), render: (r) => <Badge tone={r.status === "resolved" ? "good" : r.status === "escalated" ? "bad" : "warn"}>{t(`complaintStatus.${r.status}`)}</Badge> },
          { key: "sla", label: t("complaints.sla"), render: (r) => (r.sla_breached ? <Badge tone="bad">{t("complaints.breached")}</Badge> : <Badge tone="good">{t("complaints.withinSla")}</Badge>) },
        ]} />
      </Card>
    </div>
  );
}
