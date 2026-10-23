import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, Table, Tabs, ViewHeader, type Tone } from "../components/ui";
import { fmtKd, fmtNum, nameOf } from "../lib/format";
import * as M from "../lib/metrics";
import { useD } from "../store/data";
import { useUi } from "../store/ui";

type Tab = "all" | "7" | "14" | "30" | "stagnant";
const ACTION_TONE: Record<M.LotAction, Tone> = { hold: "bad", bogo: "warn", discount: "warn", transfer: "info", return: "accent", none: "muted" };

export function Inventory() {
  const { t } = useTranslation();
  const d = useD();
  const { lang, coopId, branchId } = useUi();
  const [tab, setTab] = useState<Tab>("14");
  const scope = { coopId, branchId };
  const rows = useMemo(() => {
    if (tab === "stagnant") return M.stagnantLots(d, scope);
    if (tab === "all") return d.lots.filter((l) => M.branchesInScope(d, scope).some((b) => b.id === l.branch_id)).map((l) => M.lotRisk(d, l)).sort((a, b) => a.days_left - b.days_left);
    return M.expiryRisk(d, scope, +tab);
  }, [d, tab, coopId, branchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const promos = M.promotionResults(d);
  const I = M.idx(d);
  return (
    <div className="space-y-4">
      <ViewHeader title={t("nav.inventory")} subtitle={t("inventory.subtitle")} />
      <Card bodyClass="p-0" title={<Tabs testId="expiry-tabs" value={tab} onChange={setTab} tabs={[{ key: "all", label: t("inventory.tabs.all") }, { key: "7", label: t("inventory.tabs.d7") }, { key: "14", label: t("inventory.tabs.d14") }, { key: "30", label: t("inventory.tabs.d30") }, { key: "stagnant", label: t("inventory.tabs.stagnant") }]} />}
        actions={<span className="text-xs text-text-2 num">{t("inventory.atRisk", { v: fmtKd(rows.reduce((a, r) => a + r.value_at_risk, 0), lang), n: rows.length })}</span>}>
        <Table testId="lots-table" pageSize={25} rows={rows} rowKey={(r) => r.lot_id} rowClass={(r) => (r.complaints ? "bg-bad/10" : undefined)} cols={[
          { key: "lot", label: t("inventory.lot"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.lot_id}</span> },
          { key: "p", label: t("common.product"), render: (r) => (lang === "ar" ? r.name_ar : r.name_en) },
          { key: "b", label: t("shell.branch"), render: (r) => nameOf(I.branch.get(r.branch_id), lang) },
          { key: "loc", label: t("inventory.location"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.location ?? "—"}</span> },
          { key: "q", label: t("inventory.qty"), num: true, render: (r) => fmtNum(r.qty) },
          { key: "e", label: t("inventory.expiry"), render: (r) => <span className="num whitespace-nowrap" dir="ltr">{r.expiry} <span className={r.days_left <= 7 ? "text-bad" : r.days_left <= 14 ? "text-warn" : "text-text-2"}>({t("common.dShort", { n: r.days_left })})</span></span> },
          { key: "dd", label: t("inventory.demand"), num: true, render: (r) => fmtNum(r.daily_demand, 1) },
          { key: "s", label: t("inventory.surplus"), num: true, render: (r) => fmtNum(r.projected_surplus) },
          { key: "v", label: t("inventory.valueAtRisk"), num: true, render: (r) => fmtKd(r.value_at_risk, lang) },
          { key: "a", label: t("inventory.action"), render: (r) => <Badge tone={ACTION_TONE[r.suggested_action]}>{t(`action.${r.suggested_action}`)}</Badge> },
        ]} />
      </Card>
      <Card title={t("inventory.promos")} bodyClass="p-0">
        <Table testId="promo-table" rows={[...promos.ended.map((p) => ({ ...p, status: "ended" })), ...promos.on_hold.map((p) => ({ ...p, status: "blocked", planned_units: undefined, sold_units: undefined, waste_avoided_kd: undefined })), ...promos.drafts_awaiting_approval.map((p) => ({ ...p, lot_id: undefined, status: "draft", sold_units: undefined, waste_avoided_kd: undefined }))]} rowKey={(r) => r.id} cols={[
          { key: "id", label: t("inventory.promo"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.id}</span> },
          { key: "p", label: t("common.product"), render: (r) => (lang === "ar" ? r.product_ar : r.product_en) },
          { key: "t", label: t("inventory.promoType"), render: (r) => (lang === "ar" ? r.type_ar : r.type_en) },
          { key: "st", label: t("map.panel.status"), render: (r) => <Badge tone={r.status === "ended" ? "good" : r.status === "blocked" ? "bad" : "muted"}>{t(`promoStatus.${r.status}`)}</Badge> },
          { key: "pl", label: t("inventory.planned"), num: true, render: (r) => fmtNum(r.planned_units ?? null) },
          { key: "so", label: t("inventory.sold"), num: true, render: (r) => fmtNum(r.sold_units ?? null) },
          { key: "sa", label: t("inventory.saved"), num: true, render: (r) => (r.waste_avoided_kd != null ? fmtKd(r.waste_avoided_kd, lang) : "—") },
        ]} />
      </Card>
    </div>
  );
}
