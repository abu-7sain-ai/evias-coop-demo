// Side panel for any fixture, shop, kiosk or ad space — used by the store map and the Spaces table.
import { Bot } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge, KV, SidePanel, type Tone } from "../../components/ui";
import { fmtKd, fmtNum, nameOf } from "../../lib/format";
import * as M from "../../lib/metrics";
import { useD } from "../../store/data";
import { useUi } from "../../store/ui";

export const STATUS_TONE: Record<string, Tone> = { available: "info", reserved: "info", leased: "good", expiring: "warn", arrears: "bad", active: "good", draft: "muted" };

export function FixturePanel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const d = useD();
  const { lang, askAgent, view } = useUi();
  const info = useMemo(() => {
    if (!id) return null;
    const I = M.idx(d);
    const f = I.fixture.get(id);
    const space = I.space.get(id);
    const b = M.mappedBranch(d);
    const res = d.shelf_reservations.filter((r) => r.fixture_id === id);
    const stock = d.stock_locations.filter((s) => s.fixture_id === id && s.branch_id === b);
    const lots = d.lots.filter((l) => l.branch_id === b && stock.some((s) => s.product_id === l.product_id) && l.expiry >= M.demoDate(d)).sort((x, y) => x.expiry.localeCompare(y.expiry));
    const sales = M.fixtureSales30(d, b).get(id);
    const contract = d.lease_contracts.find((c) => c.space_id === id);
    const tenant = contract ? d.tenants.find((x) => x.id === contract.tenant_id) : undefined;
    const overdue = d.lease_invoices.filter((x) => x.space_id === id && x.status === "overdue");
    return { f, space, res, stock, lot: lots[0], sales, contract, tenant, overdue, traffic: M.trafficAverages(d).get(id), rank: M.trafficRanks(d).get(id), I };
  }, [d, id]);
  if (!id || !info) return null;
  const { f, space, res, stock, lot, sales, contract, tenant, overdue, traffic, rank, I } = info;
  const title = `${id} · ${nameOf(f ?? space, lang)}`;
  const status = space?.status ?? f?.status;
  return (
    <SidePanel open onClose={onClose} title={title} testId="fixture-panel">
      <div className="space-y-5 text-sm">
        <KV items={[
          [t("map.panel.code"), <span dir="ltr" className="font-mono">{id}</span>],
          [t("map.panel.type"), t(`fixtureType.${f?.type ?? space?.type}`, { defaultValue: f?.type ?? space?.type })],
          ...(f ? [[t("map.panel.floor"), t(f.floor === "G" ? "map.ground" : "map.mezzanine")]] as [string, string][] : []),
          ...(space?.area_m2 ? [[t("spaces.area"), `${fmtNum(space.area_m2)} m²`]] as [string, string][] : []),
          ...(status ? [[t("map.panel.status"), <Badge tone={STATUS_TONE[status] ?? "muted"}>{t(`status.${status}`)}</Badge>]] as [string, JSX.Element][] : []),
          ...(traffic != null ? [[t("map.panel.traffic"), <span className="num">{fmtNum(traffic, 1)}{rank ? ` · ${t("map.panel.rank", { rank, of: M.trafficRanks(d).size })}` : ""}</span>]] as [string, JSX.Element][] : []),
          ...(sales != null ? [[t("map.panel.sales30"), <span className="num">{fmtKd(sales, lang)} · {fmtKd(sales / M.fixtureLength(f!), lang)}/m</span>]] as [string, JSX.Element][] : []),
        ]} />

        {res.length > 0 && (
          <section>
            <h4 className="font-medium mb-2">{t("map.panel.supplierContract")}</h4>
            {res.map((r) => (
              <KV key={r.id} items={[
                [t("map.panel.supplier"), `${r.supplier_id} · ${nameOf(d.suppliers.find((s) => s.id === r.supplier_id), lang)}`],
                [t("map.panel.level"), r.level ? `L${r.level}` : t("map.panel.allLevels")],
                [t("map.panel.rent"), fmtKd(r.monthly_rent, lang)],
                [t("map.panel.dates"), <span className="num" dir="ltr">{r.starts_on} → {r.ends_on}</span>],
                [t("map.panel.daysLeft"), <Badge tone={r.days_to_expiry <= 60 ? "warn" : "muted"}>{t("common.days", { n: r.days_to_expiry })}</Badge>],
              ]} />
            ))}
          </section>
        )}

        {(contract || space) && (
          <section>
            <h4 className="font-medium mb-2">{t("map.panel.lease")}</h4>
            <KV items={[
              [t("map.panel.tenant"), tenant ? nameOf(tenant, lang) : "—"],
              [t("map.panel.rent"), space?.day_rate ? `${fmtKd(space.day_rate, lang)} / ${t("common.day")}` : fmtKd(space?.monthly_rent ?? contract?.monthly_rent, lang)],
              ...(contract ? [[t("map.panel.dates"), <span className="num" dir="ltr">{contract.starts_on} → {contract.ends_on}</span>], [t("map.panel.daysLeft"), t("common.days", { n: contract.days_to_expiry })]] as [string, JSX.Element | string][] : []),
              ...(overdue.length ? [[t("spaces.arrears"), <span className="text-bad num">{fmtKd(overdue.reduce((a, x) => a + x.amount, 0), lang)} · {t("spaces.daysLate", { n: Math.max(...overdue.map((x) => x.days_late)) })}</span>]] as [string, JSX.Element][] : []),
              ...(space && space.vacant_days > 0 ? [[t("spaces.vacantDays"), <span className="text-warn num">{t("common.days", { n: space.vacant_days })}</span>]] as [string, JSX.Element][] : []),
            ]} />
          </section>
        )}

        {stock.length > 0 && (
          <section>
            <h4 className="font-medium mb-2">{t("map.panel.products")}</h4>
            <table className="tbl text-xs">
              <thead><tr><th>{t("map.panel.level")}</th><th>{t("common.product")}</th><th className="text-end">{t("map.panel.facings")}</th><th className="text-end">{t("map.panel.shelf")}</th><th className="text-end">{t("map.panel.warehouse")}</th></tr></thead>
              <tbody>
                {stock.map((s) => (
                  <tr key={`${s.level}-${s.product_id}`}>
                    <td>L{s.level}</td>
                    <td>{nameOf(I.product.get(s.product_id), lang)} <Badge tone={s.status === "empty" ? "bad" : s.status === "low" ? "warn" : "good"}>{t(`stock.${s.status}`)}</Badge></td>
                    <td className="text-end num">{s.facings}</td><td className="text-end num">{s.qty_on_shelf}</td><td className="text-end num">{s.qty_in_warehouse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lot && <p className="mt-2 text-xs text-text-2">{t("map.panel.nearestExpiry")}: <span className="num" dir="ltr">{lot.id} · {lot.expiry}</span> ({t("common.days", { n: M.daysBetween(M.demoDate(d), lot.expiry) })})</p>}
          </section>
        )}

        <button className="btn-accent w-full justify-center" data-testid="ask-about-fixture"
          onClick={() => { askAgent(t("map.askAbout", { code: id }), { coop_id: "C1", branch_id: M.mappedBranch(d), fixture_id: id, view }); onClose(); }}>
          <Bot size={16} /> {t("map.askAboutBtn")}
        </button>
      </div>
    </SidePanel>
  );
}
