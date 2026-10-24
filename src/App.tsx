import { useEffect, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { AgentDrawer } from "./components/agent/AgentDrawer";
import { Footer, MobileNav, Sidebar, Topbar } from "./components/shell/Shell";
import { cx } from "./components/ui";
import { useData } from "./store/data";
import { useUi, type ViewKey } from "./store/ui";
import { AgentView } from "./views/AgentView";
import { Complaints } from "./views/Complaints";
import { Dashboard } from "./views/Dashboard";
import { Finance } from "./views/Finance";
import { Inventory } from "./views/Inventory";
import { Members } from "./views/Members";
import { Ministry } from "./views/Ministry";
import { Sales } from "./views/Sales";
import { SettingsView } from "./views/Settings";
import { ShelvesSuppliers } from "./views/ShelvesSuppliers";
import { Spaces } from "./views/Spaces";
import { Staff } from "./views/Staff";
import { StoreMap } from "./views/map/StoreMap";

const VIEW_COMPONENTS: Record<ViewKey, ComponentType> = {
  dashboard: Dashboard, agent: AgentView, map: StoreMap, spaces: Spaces, shelves: ShelvesSuppliers, inventory: Inventory, sales: Sales,
  finance: Finance, members: Members, staff: Staff, complaints: Complaints, ministry: Ministry, settings: SettingsView,
};

export default function App() {
  const { t } = useTranslation();
  const { data, error, progress, load } = useData();
  const { view, agentOpen } = useUi();
  useEffect(() => { void load(); }, [load]);

  if (!data) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="card w-full max-w-sm p-6 text-center space-y-3">
          <div className="font-semibold" dir="ltr">E-VIAS</div>
          {error ? (
            <>
              <p className="text-bad text-sm">{t("app.loadError")}</p>
              <p className="text-xs text-text-2 break-all" dir="ltr">{error}</p>
              <button className="btn-accent mx-auto" onClick={() => void load()}>{t("app.retry")}</button>
            </>
          ) : (
            <>
              <p className="text-sm text-text-2">{t("app.loading")}</p>
              <div className="h-1.5 rounded bg-surface-2 overflow-hidden"><div className="h-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            </>
          )}
          <p className="text-[11px] text-text-2">{t("footer.disclaimer")}</p>
        </div>
      </div>
    );
  }

  const View = VIEW_COMPONENTS[view];
  return (
    <div className="flex h-full flex-col">
      <Topbar />
      <MobileNav />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className={cx("min-w-0 flex-1 overflow-y-auto scroll-thin p-4 lg:p-6", agentOpen && "xl:pe-[440px]")} data-testid={`view-${view}`}>
          <View />
        </main>
      </div>
      <Footer />
      <AgentDrawer />
    </div>
  );
}
