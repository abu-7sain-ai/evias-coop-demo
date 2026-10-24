import { Bot } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, DeltaPill, Note, ViewHeader, cx } from "../components/ui";
import { fmtKd, fmtNum, fmtPct, nameOf, pick } from "../lib/format";
import * as M from "../lib/metrics";
import { alpha, useTokens } from "../lib/useTokens";
import { useD } from "../store/data";
import { MINISTRY_ROLES, useUi } from "../store/ui";

export function Dashboard() {
  const { t } = useTranslation();
  const d = useD();
  const { coopId, branchId, lang, role, askAgent, view } = useUi();
  const tok = useTokens();
  const scope = { coopId, branchId };
  const kpis = useMemo(() => M.kpis(d, scope, 7), [d, coopId, branchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const series = useMemo(() => M.dailySeries(d, scope, 30), [d, coopId, branchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const heatBranch = branchId ?? (coopId === "ALL" || coopId === d.branches.find((b) => b.id === M.mappedBranch(d))?.coop_id ? M.mappedBranch(d) : d.branches.find((b) => b.coop_id === coopId)!.id);
  const heat = useMemo(() => M.heatmap(d, heatBranch), [d, heatBranch]);
  const heatMax = Math.max(1, ...heat.grid.flat());
  const ministry = MINISTRY_ROLES.includes(role);
  const alerts = d.agent_alerts.filter((a) => (coopId === "ALL" ? true : a.coop_id === coopId || (a.coop_id == null && ministry)) && (!a.ministry || ministry));
  const colors = [tok.accent, tok.info, tok.warn, tok.bad];
  const label = (k: string) => nameOf(coopId === "ALL" ? d.coops.find((c) => c.id === k) : d.branches.find((b) => b.id === k), lang);

  return (
    <div className="space-y-4">
      <ViewHeader title={t("nav.dashboard")} subtitle={t("dashboard.subtitle", { date: d.meta.demo_date })} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="kpis">
        {kpis.map((k) => (
          <div key={k.key} className="card p-4 min-w-0" data-testid={`kpi-${k.key}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs text-text-2 leading-snug">{t(`kpi.${k.key}`)}</div>
              <DeltaPill delta={k.delta_pct} downIsGood={k.down_is_good} />
            </div>
            <div className="mt-2 text-xl font-semibold num truncate">{k.value == null ? "—" : k.unit === "KD" ? fmtKd(k.value, lang) : fmtPct(k.value, k.key === "void_rate" ? 2 : 1)}</div>
            <div className="mt-1 text-[11px] text-text-2 truncate">{k.value == null ? t("dashboard.noData") : k.key === "rent" ? t("dashboard.rentNote", { cur: k.note?.split(" vs ")[0], prev: k.note?.split(" vs ")[1] }) : t("dashboard.vsPrev7")}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={t("dashboard.dailySales")}>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series.rows} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={tok.border} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} stroke={tok["text-2"]} fontSize={11} />
                <YAxis stroke={tok["text-2"]} fontSize={11} tickFormatter={(v: number) => fmtNum(v)} width={56} />
                <Tooltip contentStyle={{ background: tok.surface, border: `1px solid ${tok.border}`, borderRadius: 8, color: tok.text }} formatter={(v) => fmtKd(Number(v), lang)} labelStyle={{ color: tok.text }} />
                <Legend formatter={(v: string) => <span style={{ color: tok.text }}>{label(v)}</span>} wrapperStyle={{ fontSize: 12 }} />
                {series.keys.map((k, i) => <Line key={k} dataKey={k} name={k} stroke={colors[i % colors.length]} dot={false} strokeWidth={2} isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t("dashboard.heatmap", { branch: nameOf(d.branches.find((b) => b.id === heatBranch), lang) })}
          actions={<Badge tone="muted">{t(`dashboard.heatSource.${heat.source}`)}</Badge>}>
          {heat.source === "none" ? <Note>{t("dashboard.heatNone")}</Note> : (
            <div className="overflow-x-auto scroll-thin" dir="ltr" data-testid="heatmap">
              <table className="text-[10px] num w-full border-separate" style={{ borderSpacing: 2 }}>
                <thead><tr><th />{M.HOURS.map((h) => <th key={h} className="font-normal text-text-2">{h}</th>)}</tr></thead>
                <tbody>
                  {M.DAYS.map((day, i) => (
                    <tr key={day}>
                      <th className="pe-1 font-normal text-text-2 text-end whitespace-nowrap">{t(`days.${day}`)}</th>
                      {heat.grid[i].map((v, j) => (
                        <td key={j} title={`${t(`days.${day}`)} ${M.HOURS[j]}:00 — ${fmtNum(v)}`} className="h-6 min-w-[18px] rounded-sm"
                          style={{ background: alpha(v / heatMax > 0.8 ? tok.bad : tok.accent, 0.08 + 0.9 * (v / heatMax)) }} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title={t("dashboard.priorities")} bodyClass="p-0">
        <ul className="divide-y divide-border" data-testid="priorities">
          {alerts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Badge tone={a.severity === "high" ? "bad" : a.severity === "medium" ? "warn" : "info"}>{t(`severity.${a.severity}`)}</Badge>
              <span className="flex-1 min-w-[12rem] text-sm">{pick(a as unknown as Record<string, unknown>, "title", lang)}</span>
              <button className={cx("btn text-accent")} onClick={() => askAgent(pick(a as unknown as Record<string, unknown>, "question", lang), { coop_id: a.coop_id ?? coopId, branch_id: a.branch_id, record_id: a.id, view })}>
                <Bot size={14} /> {t("common.askAgent")}
              </button>
            </li>
          ))}
          {!alerts.length && <li className="px-4 py-6 text-center text-sm text-text-2">{t("common.noRows")}</li>}
        </ul>
      </Card>
    </div>
  );
}
