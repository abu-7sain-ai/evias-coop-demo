import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, Note, Select, Stat, Table, ViewHeader } from "../components/ui";
import { fmtKd, fmtNum, fmtPct } from "../lib/format";
import * as M from "../lib/metrics";
import { useD } from "../store/data";
import { useUi } from "../store/ui";
import { FixturePanel, STATUS_TONE } from "./map/FixturePanel";

export function Spaces() {
  const { t } = useTranslation();
  const d = useD();
  const { lang, coopId, branchId } = useUi();
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const scope = { coopId, branchId };
  const all = useMemo(() => M.spaceStatus(d, scope), [d, coopId, branchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = all.spaces.filter((s) => (!type || s.type === type) && (!status || s.status === status));
  const s = all.summary;
  return (
    <div className="space-y-4">
      <ViewHeader title={t("nav.spaces")} subtitle={t("spaces.subtitle")} />
      {s.data_note && <Note>{t("spaces.onlyMapped")}</Note>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={t("spaces.occupancy")} value={fmtPct(s.occupancy_pct)} sub={t("spaces.occupiedOf", { n: s.occupied, of: s.spaces })} />
        <Stat label={t("spaces.rentRoll")} value={fmtKd(s.monthly_rent_roll, lang)} />
        <Stat label={t("spaces.arrearsTotal")} value={fmtKd(s.arrears_total, lang)} tone={s.arrears_total ? "bad" : undefined} />
        <Stat label={t("spaces.vacantDaysYear")} value={fmtNum(s.vacant_days_total)} sub={t("spaces.vacantCount", { n: s.vacant })} tone="warn" />
      </div>
      <Card title={t("spaces.table")} bodyClass="p-0" actions={<>
        <Select label={t("spaces.type")} value={type} onChange={setType} options={[{ value: "", label: t("spaces.allTypes") }, ...["shop", "kiosk", "lobby", "ad"].map((x) => ({ value: x, label: t(`fixtureType.${x}`) }))]} />
        <Select label={t("map.panel.status")} value={status} onChange={setStatus} options={[{ value: "", label: t("spaces.allStatuses") }, ...["leased", "expiring", "arrears", "reserved", "available"].map((x) => ({ value: x, label: t(`status.${x}`) }))]} />
      </>}>
        <Table testId="spaces-table" rows={rows} rowKey={(r) => r.space_id} onRow={(r) => setSel(r.space_id)} cols={[
          { key: "id", label: t("map.panel.code"), render: (r) => <span className="font-mono" dir="ltr">{r.space_id}</span> },
          { key: "name", label: t("common.name"), render: (r) => (lang === "ar" ? r.name_ar : r.name_en) },
          { key: "type", label: t("spaces.type"), render: (r) => t(`fixtureType.${r.type}`) },
          { key: "floor", label: t("map.panel.floor"), render: (r) => t(r.floor === "G" ? "map.groundShort" : "map.mezzanineShort") },
          { key: "area", label: t("spaces.area"), num: true, render: (r) => (r.area_m2 ? fmtNum(r.area_m2) : "—") },
          { key: "tenant", label: t("map.panel.tenant"), render: (r) => (lang === "ar" ? r.tenant_ar : r.tenant_en) ?? "—" },
          { key: "rent", label: t("spaces.monthlyRent"), num: true, render: (r) => (r.day_rate ? `${fmtKd(r.day_rate, lang)} / ${t("common.day")}` : fmtKd(r.monthly_rent, lang)) },
          { key: "start", label: t("spaces.start"), render: (r) => <span className="num" dir="ltr">{r.starts_on ?? "—"}</span> },
          { key: "end", label: t("spaces.end"), render: (r) => <span className="num" dir="ltr">{r.ends_on ?? "—"}</span> },
          { key: "status", label: t("map.panel.status"), render: (r) => <Badge tone={STATUS_TONE[r.status] ?? "muted"}>{t(`status.${r.status}`)}</Badge> },
          { key: "dte", label: t("spaces.daysToExpiry"), num: true, render: (r) => (r.days_to_expiry == null ? "—" : fmtNum(r.days_to_expiry)) },
          { key: "arrears", label: t("spaces.arrears"), num: true, render: (r) => (r.arrears_kd ? <span className="text-bad">{fmtKd(r.arrears_kd, lang)}</span> : "—") },
          { key: "vacant", label: t("spaces.vacantDays"), num: true, render: (r) => (r.vacant_days ? fmtNum(r.vacant_days) : "—") },
        ]} />
      </Card>
      <FixturePanel id={sel} onClose={() => setSel(null)} />
    </div>
  );
}
