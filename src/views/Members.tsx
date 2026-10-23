import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, Note, Stat, Table, ViewHeader } from "../components/ui";
import { fmtKd, fmtNum, fmtPct } from "../lib/format";
import * as M from "../lib/metrics";
import { useD } from "../store/data";
import { useUi } from "../store/ui";

export function Members() {
  const { t } = useTranslation();
  const d = useD();
  const { lang, coopId, branchId } = useUi();
  const scope = { coopId, branchId: null };
  const st = useMemo(() => M.memberStats(d, scope), [d, coopId]); // eslint-disable-line react-hooks/exhaustive-deps
  const cfg = d.meta.dividend_config;
  const [rebate, setRebate] = useState(cfg.purchase_rebate_pct);
  const [shareDiv, setShareDiv] = useState(cfg.share_dividend_pct);
  const members = d.members.filter((m) => coopId === "ALL" || m.coop_id === coopId);
  const lastPurchase = useMemo(() => { const m = new Map<string, string>(); for (const s of d.sales) if (s.member_id && (m.get(s.member_id) ?? "") < s.date) m.set(s.member_id, s.date); return m; }, [d]);
  const sim = M.round(members.reduce((a, m) => a + (m.ytd_purchases * rebate) / 100 + (m.shares * m.share_value * shareDiv) / 100, 0));
  return (
    <div className="space-y-4">
      <ViewHeader title={t("nav.members")} subtitle={t("members.subtitle", { n: fmtNum(st.members_in_demo_data), reported: fmtNum(st.members_reported_by_coop) })} />
      {branchId && <Note>{t("members.coopLevel")}</Note>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={t("members.inDemo")} value={fmtNum(st.members_in_demo_data)} sub={t("members.reported", { n: fmtNum(st.members_reported_by_coop) })} />
        <Stat label={t("members.voting")} value={fmtNum(st.voting_eligible)} />
        <Stat label={t("members.ytd")} value={fmtKd(st.ytd_purchases_total, lang)} />
        <Stat label={t("members.unregistered")} value={fmtPct(st.unregistered_sales_pct)} tone="warn" sub={st.unregistered_sales_pct == null ? t("dashboard.noData") : t("members.unregisteredSub")} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card title={t("members.table")} bodyClass="p-0">
          <Table testId="members-table" pageSize={20} rows={[...members].sort((a, b) => b.ytd_purchases - a.ytd_purchases)} rowKey={(r) => r.id} cols={[
            { key: "id", label: t("members.no"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.id}</span> },
            { key: "n", label: t("common.name"), render: (r) => (lang === "ar" ? r.name_ar : r.name_en) },
            { key: "c", label: t("members.class"), render: (r) => t(`memberClass.${r.class}`) },
            { key: "s", label: t("members.shares"), num: true, render: (r) => fmtNum(r.shares) },
            { key: "sv", label: t("members.shareValue"), num: true, render: (r) => fmtKd(r.shares * r.share_value, lang) },
            { key: "y", label: t("members.ytdShort"), num: true, render: (r) => fmtKd(r.ytd_purchases, lang) },
            { key: "v", label: t("members.votingShort"), render: (r) => <Badge tone={r.voting_eligible ? "good" : "muted"}>{r.voting_eligible ? t("common.yes") : t("common.no")}</Badge> },
            { key: "l", label: t("members.last"), render: (r) => <span className="num" dir="ltr">{lastPurchase.get(r.id) ?? "—"}</span> },
          ]} />
        </Card>
        <Card title={t("members.dividendSim")}>
          <div className="space-y-3 text-sm" data-testid="dividend-sim">
            <p className="text-text-2 text-xs">{t("members.formula")}</p>
            <label className="flex items-center justify-between gap-2">{t("members.rebatePct")}<input type="number" step={0.5} min={0} max={20} className="input w-20 num" value={rebate} onChange={(e) => setRebate(+e.target.value)} /></label>
            <label className="flex items-center justify-between gap-2">{t("members.sharePct")}<input type="number" step={0.5} min={0} max={20} className="input w-20 num" value={shareDiv} onChange={(e) => setShareDiv(+e.target.value)} /></label>
            <div className="rounded-lg bg-accent-soft p-3"><div className="text-xs text-text-2">{t("members.projected")}</div><div className="text-lg font-semibold num text-accent">{fmtKd(sim, lang)}</div></div>
            <p className="text-[11px] text-text-2">{t("members.configNote", { r: cfg.purchase_rebate_pct, s: cfg.share_dividend_pct })}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
