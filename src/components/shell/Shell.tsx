import {
  type LucideIcon, Bot, Building2, Gauge, Landmark, LayoutGrid, Map as MapIcon, Moon, Package, Search, Settings, ShoppingCart, Sun, Users, UserCheck, Wallet, MessageSquareWarning,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { nameOf } from "../../lib/format";
import { useD } from "../../store/data";
import { MINISTRY_ROLES, ROLES, ROLE_VIEWS, useUi, type Role, type ViewKey } from "../../store/ui";
import { Select, cx } from "../ui";

export const VIEW_ICONS: Record<ViewKey, LucideIcon> = {
  dashboard: Gauge, agent: Bot, map: MapIcon, spaces: Building2, shelves: LayoutGrid, inventory: Package, sales: ShoppingCart,
  finance: Wallet, members: Users, staff: UserCheck, complaints: MessageSquareWarning, ministry: Landmark, settings: Settings,
};

export function Topbar() {
  const { t } = useTranslation();
  const d = useD();
  const ui = useUi();
  const ministry = MINISTRY_ROLES.includes(ui.role);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    // the agent drawer sits below the topbar, whose height changes when it wraps
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--topbar-h", `${el.offsetHeight}px`));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const coopOptions = [...(ministry ? [{ value: "ALL", label: t("shell.allCoops") }] : []), ...d.coops.map((c) => ({ value: c.id, label: nameOf(c, ui.lang) }))];
  const branchOptions = [{ value: "", label: t("shell.allBranches") }, ...d.branches.filter((b) => b.coop_id === ui.coopId).map((b) => ({ value: b.id, label: nameOf(b, ui.lang) }))];
  return (
    <header ref={ref} className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2">
      <div className="flex items-center gap-2 me-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white font-bold">E</div>
        <div className="leading-tight">
          <div className="font-semibold tracking-wide" dir="ltr">E-VIAS</div>
          <div className="text-[11px] text-text-2">{t("shell.tagline")}</div>
        </div>
      </div>
      <Select testId="coop-select" label={t("shell.coop")} value={ui.coopId} onChange={ui.setCoop} options={coopOptions} />
      {ui.coopId !== "ALL" && <Select testId="branch-select" label={t("shell.branch")} value={ui.branchId ?? ""} onChange={(v) => ui.setBranch(v || null)} options={branchOptions} />}
      <Select testId="role-select" label={t("shell.role")} value={ui.role} onChange={(v) => ui.setRole(v as Role)} options={ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))} />
      <div className="relative hidden lg:block">
        <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-2.5 text-text-2" aria-hidden />
        <input className="input ps-8 w-48" placeholder={t("shell.search")} aria-label={t("shell.search")}
          onKeyDown={(e) => { const v = (e.target as HTMLInputElement).value.trim(); if (e.key === "Enter" && v) { ui.askAgent(v, { coop_id: ui.coopId, branch_id: ui.branchId, view: ui.view }); (e.target as HTMLInputElement).value = ""; } }} />
      </div>
      <div className="ms-auto flex items-center gap-2">
        <button data-testid="lang-toggle" className="btn" onClick={() => ui.setLang(ui.lang === "ar" ? "en" : "ar")} aria-label={t("shell.language")}>
          {ui.lang === "ar" ? "English" : "العربية"}
        </button>
        <button data-testid="theme-toggle" className="btn px-2" onClick={() => ui.setTheme(ui.theme === "dark" ? "light" : "dark")} aria-label={t("shell.theme")} title={t("shell.theme")}>
          {ui.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button data-testid="agent-toggle" className={cx("btn-accent")} onClick={() => ui.setAgentOpen(!ui.agentOpen)}>
          <Bot size={16} /> {t("agent.name")}
          <span className="h-2 w-2 rounded-full bg-white/90" aria-hidden />
        </button>
      </div>
    </header>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const { role, view, setView, setAgentOpen } = useUi();
  const visible = ROLE_VIEWS[role];
  return (
    <nav className="w-56 shrink-0 border-e border-border bg-surface p-2 overflow-y-auto scroll-thin hidden md:block" aria-label={t("shell.nav")}>
      <ul className="space-y-0.5">
        {ROLE_VIEWS.ministry_admin.filter((v) => visible.includes(v)).map((v) => {
          const Icon = VIEW_ICONS[v];
          return (
            <li key={v}>
              <button data-testid={`nav-${v}`} onClick={() => { if (v === "agent") setAgentOpen(false); setView(v); }}
                className={cx("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-start", view === v ? "bg-accent-soft text-accent font-medium" : "text-text-2 hover:bg-surface-2 hover:text-text")}>
                <Icon size={16} className="shrink-0" /> <span className="truncate">{t(`nav.${v}`)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Narrow screens: horizontal nav strip instead of the sidebar. */
export function MobileNav() {
  const { t } = useTranslation();
  const { role, view, setView } = useUi();
  return (
    <div className="md:hidden flex gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-1.5 scroll-thin">
      {ROLE_VIEWS[role].map((v) => (
        <button key={v} onClick={() => setView(v)} className={cx("chip", view === v && "bg-accent-soft text-accent")}>{t(`nav.${v}`)}</button>
      ))}
    </div>
  );
}

export function Footer() {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--footer-h", `${el.offsetHeight}px`));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return <footer ref={ref} data-testid="footer" className="border-t border-border bg-surface px-4 py-2 text-center text-xs text-text-2">{t("footer.disclaimer")}</footer>;
}

