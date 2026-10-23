import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Minus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { fmtNum } from "../../lib/format";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ title, actions, children, className, bodyClass }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx("card min-w-0", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={cx("min-w-0", bodyClass ?? "p-4")}>{children}</div>
    </section>
  );
}

/** ▲ 4.2% — green when the move is good, red when bad (inverted for metrics where down is good). */
export function DeltaPill({ delta, downIsGood }: { delta: number | null; downIsGood: boolean }) {
  const { t } = useTranslation();
  if (delta == null) return <span className="chip text-text-2">{t("common.noPrev")}</span>;
  const up = delta > 0, flat = delta === 0;
  const good = flat ? null : up !== downIsGood;
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span data-testid="delta" data-good={good == null ? "flat" : String(good)} className={cx("chip num font-medium border-transparent", good == null ? "bg-surface-2 text-text-2" : good ? "bg-good/15 text-good" : "bg-bad/15 text-bad")}>
      <Icon size={12} aria-hidden />
      {fmtNum(Math.abs(delta), 1)}%
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "good" | "warn" | "bad" | "info" }) {
  return (
    <div className="card p-4 min-w-0">
      <div className="text-xs text-text-2 truncate">{label}</div>
      <div className={cx("mt-1 text-xl font-semibold num truncate", tone && `text-${tone}`)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-text-2">{sub}</div>}
    </div>
  );
}

export type Tone = "good" | "warn" | "bad" | "info" | "muted" | "accent";
const TONES: Record<Tone, string> = {
  good: "bg-good/15 text-good border-transparent", warn: "bg-warn/15 text-warn border-transparent", bad: "bg-bad/15 text-bad border-transparent",
  info: "bg-info/15 text-info border-transparent", muted: "bg-surface-2 text-text-2 border-transparent", accent: "bg-accent-soft text-accent border-transparent",
};
export const Badge = ({ tone = "muted", children, title }: { tone?: Tone; children: ReactNode; title?: string }) => <span title={title} className={cx("chip font-medium", TONES[tone])}>{children}</span>;

export function Tabs<T extends string>({ tabs, value, onChange, testId }: { tabs: { key: T; label: ReactNode }[]; value: T; onChange: (k: T) => void; testId?: string }) {
  return (
    <div role="tablist" data-testid={testId} className="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
      {tabs.map((tb) => (
        <button key={tb.key} role="tab" aria-selected={value === tb.key} onClick={() => onChange(tb.key)}
          className={cx("rounded-md px-3 py-1 text-sm", value === tb.key ? "bg-surface shadow-sm font-medium text-text" : "text-text-2 hover:text-text")}>
          {tb.label}
        </button>
      ))}
    </div>
  );
}

export interface Col<T> { key: string; label: ReactNode; render: (row: T) => ReactNode; className?: string; num?: boolean }
export function Table<T>({ cols, rows, onRow, pageSize, rowKey, empty, rowClass, testId }: { cols: Col<T>[]; rows: T[]; onRow?: (r: T) => void; pageSize?: number; rowKey: (r: T, i: number) => string; empty?: ReactNode; rowClass?: (r: T) => string | undefined; testId?: string }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const pages = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const p = Math.min(page, pages - 1);
  const shown = pageSize ? rows.slice(p * pageSize, (p + 1) * pageSize) : rows;
  return (
    <div className="min-w-0" data-testid={testId}>
      <div className="overflow-x-auto scroll-thin">
        <table className="tbl">
          <thead><tr>{cols.map((c) => <th key={c.key} className={cx(c.num && "text-end", c.className)}>{c.label}</th>)}</tr></thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={rowKey(r, i)} className={cx(onRow && "clickable", rowClass?.(r))} onClick={onRow ? () => onRow(r) : undefined}>
                {cols.map((c) => <td key={c.key} className={cx(c.num && "text-end num whitespace-nowrap", c.className)}>{c.render(r)}</td>)}
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={cols.length} className="text-center text-text-2 py-6">{empty ?? t("common.noRows")}</td></tr>}
          </tbody>
        </table>
      </div>
      {pageSize && pages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2 text-xs text-text-2">
          <span className="num">{t("common.page", { page: p + 1, pages, rows: fmtNum(rows.length) })}</span>
          <button className="btn px-2 py-1" disabled={p === 0} onClick={() => setPage(p - 1)} aria-label={t("common.prev")}><ChevronLeft size={14} className="rtl:rotate-180" /></button>
          <button className="btn px-2 py-1" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} aria-label={t("common.next")}><ChevronRight size={14} className="rtl:rotate-180" /></button>
        </div>
      )}
    </div>
  );
}

/** Slide-in panel from the end side (right in LTR, left in RTL). */
export function SidePanel({ open, onClose, title, children, testId }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; testId?: string }) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" data-testid={testId}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-surface border-s border-border shadow-2xl">
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h3 className="font-semibold truncate">{title}</h3>
          <button className="btn px-2" onClick={onClose} aria-label={t("common.close")}><X size={16} /></button>
        </header>
        <div className="flex-1 overflow-y-auto scroll-thin p-4">{children}</div>
      </aside>
    </div>
  );
}

export const KV = ({ items }: { items: [ReactNode, ReactNode][] }) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
    {items.map(([k, v], i) => (<div key={i} className="contents"><dt className="text-text-2 whitespace-nowrap">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>))}
  </dl>
);

export const Note = ({ children, tone = "info" }: { children: ReactNode; tone?: Tone }) => <div className={cx("rounded-lg px-3 py-2 text-sm", TONES[tone])}>{children}</div>;

export function Select<T extends string>({ value, onChange, options, label, testId, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; testId?: string; className?: string }) {
  return (
    <select aria-label={label} title={label} data-testid={testId} className={cx("input py-1 max-w-[12rem]", className)} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export const ViewHeader = ({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) => (
  <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
    <div className="min-w-0">
      <h1 className="text-lg font-semibold">{title}</h1>
      {subtitle && <p className="text-sm text-text-2">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
