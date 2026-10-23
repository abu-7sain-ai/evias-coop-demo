import { useUi } from "../../store/ui";
import { ChatPanel } from "./ChatPanel";

/** Right-side drawer (left in RTL) that stays open while navigating. Hidden on the full-page Agent view. */
export function AgentDrawer() {
  const { agentOpen, setAgentOpen, view } = useUi();
  if (!agentOpen || view === "agent") return null;
  return (
    <aside data-testid="agent-drawer" className="fixed end-0 z-30 w-full sm:w-[420px] border-s border-border bg-surface shadow-2xl"
      style={{ top: "var(--topbar-h, 52px)", bottom: "var(--footer-h, 33px)" }}>
      <ChatPanel variant="drawer" onClose={() => setAgentOpen(false)} />
    </aside>
  );
}
