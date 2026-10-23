import { useTranslation } from "react-i18next";
import { ChatPanel } from "../components/agent/ChatPanel";
import { ViewHeader } from "../components/ui";

export function AgentView() {
  const { t } = useTranslation();
  return (
    <div>
      <ViewHeader title={t("nav.agent")} subtitle={t("agent.subtitle")} />
      <ChatPanel variant="page" />
    </div>
  );
}
