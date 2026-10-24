import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, Note, Stat, Table, Tabs, ViewHeader, cx } from "../components/ui";
import { fmtKd, fmtNum, fmtPct, nameOf } from "../lib/format";
import * as M from "../lib/metrics";
import { useD } from "../store/data";
import { useUi } from "../store/ui";

type Tab = "grid" | "employees" | "punches";
const GRID_DAYS = 28;

export function Staff() {
  const { t } = useTranslation();
  const d = useD();
  const { lang, coopId, branchId } = useUi();
  const [tab, setTab] = useState<Tab>("grid");
  const scope = { coopId, branchId };
  const summary = useMemo(() => M.attendanceSummary(d, scope, 90), [d, coopId, branchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const ghosts = useMemo(() => M.ghostEmployees(d, scope), [d, coopId, branchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const rate = M.attendanceRate(d, scope, M.periodRange(d, 30));
  const days = Array.from({ length: GRID_DAYS }, (_, i) => M.addDays(M.demoDate(d), i - GRID_DAYS));
  const att = useMemo(() => { const m = new Map<string, (typeof d.attendance)[number]>(); for (const a of d.attendance) m.set(`${a.employee_id}|${a.date}`, a); return m; }, [d]);
  const ids = new Set(summary.map((s) => s.employee_id));
  const punches = useMemo(() => d.attendance.filter((a) => ids.has(a.employee_id)).sort((a, b) => b.date.localeCompare(a.date)), [d, coopId, branchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const I = M.idx(d);
  const cell = (empId: string, role: string, day: string) => {
    const a = att.get(`${empId}|${day}`);
    if (!a) return M.dayOfWeek(day) === "Fri" && role !== "cashier" ? { c: "bg-surface-2", k: "off" } : { c: "bg-bad/70", k: "nopunch" };
    if (a.status === "absent") return { c: "bg-bad/40", k: "absent" };
    if (a.status === "late") return { c: "bg-warn/60", k: "late" };
    if (!a.punch_out) return { c: "bg-info/50", k: "no_punch_out" };
    return { c: "bg-good/40", k: "present" };
  };
  return (
    <div className="space-y-4">
      <ViewHeader title={t("nav.staff")} subtitle={t("staff.subtitle")} />
      {ghosts.count > 0 && <Note tone="bad">{t("staff.ghostBanner", { n: ghosts.count, kd: fmtKd(ghosts.monthly_salary_total, lang) })}</Note>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={t("staff.employees")} value={fmtNum(summary.length)} />
        <Stat label={t("staff.rate30")} value={fmtPct(rate)} />
        <Stat label={t("staff.lateEvents")} value={fmtNum(summary.reduce((a, s) => a + s.late, 0))} tone="warn" />
        <Stat label={t("staff.zeroPunch")} value={fmtNum(ghosts.count)} tone={ghosts.count ? "bad" : undefined} />
      </div>
      <Card bodyClass="p-0" title={<Tabs value={tab} onChange={setTab} testId="staff-tabs" tabs={[{ key: "grid", label: t("staff.tabs.grid") }, { key: "employees", label: t("staff.tabs.employees") }, { key: "punches", label: t("staff.tabs.punches") }]} />}>
        {tab === "grid" && (
          <div className="overflow-x-auto scroll-thin p-3" data-testid="attendance-grid">
            <table className="text-[10px] border-separate" style={{ borderSpacing: 2 }}>
              <thead><tr><th className="sticky start-0 bg-surface" />{days.map((day) => <th key={day} className="font-normal text-text-2 num" title={day}>{day.slice(8)}</th>)}</tr></thead>
              <tbody>
                {summary.map((s) => {
                  const e = I.employee.get(s.employee_id)!;
                  return (
                    <tr key={s.employee_id}>
                      <th className="sticky start-0 bg-surface pe-2 text-start font-normal whitespace-nowrap text-xs">{nameOf(e, lang)} <span className="text-text-2">· {lang === "ar" ? e.role_ar : e.role_en}</span></th>
                      {days.map((day) => { const c = cell(s.employee_id, e.role, day); return <td key={day} title={`${day} — ${t(`att.${c.k}`)}`} className={cx("h-5 w-5 min-w-[20px] rounded-sm text-center font-medium", c.c)}>{t(`attShort.${c.k}`)}</td>; })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-2">
              {[["bg-good/40", "present"], ["bg-warn/60", "late"], ["bg-bad/40", "absent"], ["bg-info/50", "no_punch_out"], ["bg-bad/70", "nopunch"], ["bg-surface-2", "off"]].map(([c, k]) => <span key={k} className="inline-flex items-center gap-1"><span className={cx("inline-block h-3 w-3 rounded-sm", c)} />{t(`att.${k}`)}</span>)}
            </div>
          </div>
        )}
        {tab === "employees" && <Table testId="employees-table" pageSize={25} rows={summary} rowKey={(r) => r.employee_id} rowClass={(r) => (r.zero_punch ? "bg-bad/10" : undefined)} cols={[
          { key: "id", label: t("staff.id"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.employee_id}</span> },
          { key: "n", label: t("common.name"), render: (r) => (lang === "ar" ? r.name_ar : r.name_en) },
          { key: "r", label: t("staff.role"), render: (r) => t(`empRole.${r.role}`) },
          { key: "b", label: t("shell.branch"), render: (r) => nameOf(r.branch_id ? I.branch.get(r.branch_id) : undefined, lang) || t("staff.hq") },
          { key: "sal", label: t("staff.salary"), num: true, render: (r) => fmtKd(r.salary, lang) },
          { key: "sc", label: t("staff.scheduled"), num: true, render: (r) => fmtNum(r.scheduled) },
          { key: "p", label: t("staff.present"), num: true, render: (r) => fmtNum(r.present) },
          { key: "l", label: t("att.late"), num: true, render: (r) => fmtNum(r.late) },
          { key: "a", label: t("att.absent"), num: true, render: (r) => fmtNum(r.absent) },
          { key: "o", label: t("att.no_punch_out"), num: true, render: (r) => fmtNum(r.no_punch_out) },
          { key: "f", label: t("staff.flags"), render: (r) => <span className="flex flex-wrap gap-1">{r.zero_punch && <Badge tone="bad">{t("staff.zeroPunchFlag")}</Badge>}{r.late_weekday_pattern.map((dw) => <Badge key={dw} tone="warn">{t("staff.lateOn", { day: t(`days.${dw}`) })}</Badge>)}</span> },
        ]} />}
        {tab === "punches" && <Table testId="punches-table" pageSize={25} rows={punches} rowKey={(r) => `${r.employee_id}|${r.date}`} cols={[
          { key: "d", label: t("sales.date"), render: (r) => <span className="num" dir="ltr">{r.date}</span> },
          { key: "e", label: t("common.name"), render: (r) => nameOf(I.employee.get(r.employee_id), lang) },
          { key: "s", label: t("sales.shift"), render: (r) => t(`shift.${r.shift}`) },
          { key: "i", label: t("staff.in"), render: (r) => <span className="num" dir="ltr">{r.punch_in ?? "—"}</span> },
          { key: "o", label: t("staff.out"), render: (r) => <span className="num" dir="ltr">{r.punch_out ?? "—"}</span> },
          { key: "l", label: t("staff.lateMin"), num: true, render: (r) => fmtNum(r.late_minutes ?? null) },
          { key: "st", label: t("map.panel.status"), render: (r) => <Badge tone={r.status === "present" ? "good" : r.status === "late" ? "warn" : r.status === "absent" ? "bad" : "info"}>{t(`att.${r.status}`)}</Badge> },
          { key: "dev", label: t("staff.device"), render: (r) => <span className="font-mono text-xs" dir="ltr">{r.device_id ?? "—"}</span> },
        ]} />}
      </Card>
    </div>
  );
}
