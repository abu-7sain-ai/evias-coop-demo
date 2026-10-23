import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, Table, ViewHeader } from "../components/ui";
import { fmtKd, fmtNum, fmtPct, nameOf } from "../lib/format";
import * as M from "../lib/metrics";
import { useD } from "../store/data";
import { useUi } from "../store/ui";
import { FixturePanel } from "./map/FixturePanel";

export function ShelvesSuppliers() {
  const { t } = useTranslation();
  const d = useD();
  const { lang } = useUi();
  const [sel, setSel] = useState<string | null>(null);
  const cards = useMemo(() => M.supplierScorecard(d), [d]);
  const perf = useMemo(() => M.shelfPerformance(d), [d]);
  const reservations = d.shelf_reservations.map((r) => ({ r, p: perf.fixtures.find((f) => f.fixture_id === r.fixture_id) })).sort((a, b) => a.r.days_to_expiry - b.r.days_to_expiry);
  return (
    <div className="space-y-4">
      <ViewHeader title={t("nav.shelves")} subtitle={t("shelves.subtitle", { median: fmtKd(perf.branch_median_sales_per_m, lang) })} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card title={t("shelves.suppliers")} bodyClass="p-0">
          <Table testId="supplier-table" rows={cards} rowKey={(r) => r.supplier_id} cols={[
            { key: "id", label: t("map.panel.supplier"), render: (r) => <div><div className="font-mono text-xs text-text-2" dir="ltr">{r.supplier_id}</div>{lang === "ar" ? r.name_ar : r.name_en}</div> },
            { key: "ot", label: t("shelves.onTime"), num: true, render: (r) => <span className={r.on_time_pct < 60 ? "text-bad font-medium" : ""}>{fmtPct(r.on_time_pct)}</span> },
            { key: "short", label: t("shelves.short"), num: true, render: (r) => fmtNum(r.short_deliveries) },
            { key: "ne", label: t("shelves.nearExpiry"), num: true, render: (r) => fmtNum(r.near_expiry_deliveries) },
          ]} />
        </Card>
        <Card title={t("shelves.reservations")} bodyClass="p-0">
          <Table testId="reservation-table" rows={reservations} rowKey={(x) => x.r.id} onRow={(x) => setSel(x.r.fixture_id)}
            rowClass={(x) => (x.r.fixture_id === "A02-END-C2" ? "bg-warn/10" : undefined)} cols={[
              { key: "fx", label: t("shelves.fixture"), render: (x) => <span className="font-mono" dir="ltr">{x.r.fixture_id}</span> },
              { key: "lvl", label: t("map.panel.level"), render: (x) => (x.r.level ? `L${x.r.level}` : t("map.panel.allLevels")) },
              { key: "sup", label: t("map.panel.supplier"), render: (x) => nameOf(d.suppliers.find((s) => s.id === x.r.supplier_id), lang) },
              { key: "rent", label: t("map.panel.rent"), num: true, render: (x) => fmtKd(x.r.monthly_rent, lang) },
              { key: "ends", label: t("spaces.end"), render: (x) => <span className="inline-flex flex-wrap items-center gap-1"><span className="num" dir="ltr">{x.r.ends_on}</span>{x.r.days_to_expiry <= 60 && <Badge tone="warn">{t("common.days", { n: x.r.days_to_expiry })}</Badge>}</span> },
              { key: "spm", label: t("shelves.salesPerM"), num: true, render: (x) => (x.p ? <span className={x.p.vs_branch_median === "below" ? "text-warn" : ""}>{fmtKd(x.p.sales_per_m, lang)}</span> : "—") },
              { key: "tr", label: t("shelves.traffic"), num: true, render: (x) => (x.p ? `${fmtNum(x.p.traffic_score, 1)} (#${x.p.traffic_rank})` : "—") },
            ]} />
        </Card>
      </div>
      <FixturePanel id={sel} onClose={() => setSel(null)} />
    </div>
  );
}
