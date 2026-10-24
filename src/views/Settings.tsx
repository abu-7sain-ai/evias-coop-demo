import { CheckCircle2, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { bridgeHealth, type BridgeHealth } from "../agent/providers/bridge";
import { Badge, Card, Note, Tabs, ViewHeader } from "../components/ui";
import { useChat } from "../store/chat";
import { useData } from "../store/data";
import { ANTHROPIC_MODELS, OPENAI_MODELS, defaultBridgeUrl, readKey, useUi, type AgentMode, type ApiProvider, type BridgeCli } from "../store/ui";

const CUSTOM = "__custom__";

export function SettingsView() {
  const { t } = useTranslation();
  const ui = useUi();
  const load = useData((s) => s.load);
  const clearChat = useChat((s) => s.clear);
  return (
    <div className="space-y-4 max-w-3xl">
      <ViewHeader title={t("nav.settings")} />
      <Card title={t("settings.appearance")}>
        <div className="flex flex-wrap gap-6">
          <div className="space-y-1"><div className="text-xs text-text-2">{t("shell.theme")}</div>
            <Tabs testId="theme-tabs" value={ui.theme} onChange={ui.setTheme} tabs={[{ key: "light", label: t("settings.light") }, { key: "dark", label: t("settings.dark") }]} /></div>
          <div className="space-y-1"><div className="text-xs text-text-2">{t("shell.language")}</div>
            <Tabs testId="lang-tabs" value={ui.lang} onChange={ui.setLang} tabs={[{ key: "ar", label: "العربية" }, { key: "en", label: "English" }]} /></div>
        </div>
      </Card>
      <Card title={t("settings.agent")}>
        <div className="space-y-4">
          <div className="space-y-1"><div className="text-xs text-text-2">{t("settings.connection")}</div>
            <Tabs testId="mode-tabs" value={ui.agentMode} onChange={(m) => ui.setAgentMode(m as AgentMode)} tabs={[{ key: "bridge", label: t("settings.mode.bridge") }, { key: "api", label: t("settings.mode.api") }]} /></div>
          {ui.agentMode === "api" ? <ApiSettings /> : <BridgeSettings />}
        </div>
      </Card>
      <Card title={t("settings.demoData")}>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn" data-testid="reset-data" onClick={() => { clearChat(); void load(); }}><RefreshCw size={14} />{t("settings.reset")}</button>
          <span className="text-xs text-text-2">{t("settings.resetHelp")}</span>
        </div>
      </Card>
    </div>
  );
}

function ModelPicker({ options, value, onChange, testId }: { options: string[]; value: string; onChange: (v: string) => void; testId: string }) {
  const { t } = useTranslation();
  const custom = !options.includes(value);
  const [text, setText] = useState(custom ? value : "");
  return (
    <div className="flex flex-wrap gap-2">
      <select data-testid={testId} aria-label={t("settings.model")} className="input" dir="ltr" value={custom ? CUSTOM : value} onChange={(e) => { if (e.target.value === CUSTOM) setText(custom ? value : ""); else onChange(e.target.value); }}>
        {options.map((o, i) => <option key={o} value={o}>{o}{i === 0 ? ` (${t("settings.default")})` : ""}</option>)}
        <option value={CUSTOM}>{t("settings.customModel")}</option>
      </select>
      <input className="input w-56" dir="ltr" placeholder={t("settings.customModelPh")} aria-label={t("settings.customModel")} value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn" disabled={!text.trim()} onClick={() => onChange(text.trim())}>{t("settings.use")}</button>
    </div>
  );
}

function ApiSettings() {
  const { t } = useTranslation();
  const ui = useUi();
  const [v, setV] = useState("");
  void ui.keyVersion;
  const key = readKey(ui.apiProvider);
  return (
    <div className="space-y-4" data-testid="api-settings">
      <div className="space-y-1"><div className="text-xs text-text-2">{t("settings.provider")}</div>
        <Tabs testId="provider-tabs" value={ui.apiProvider} onChange={(p) => ui.setApiProvider(p as ApiProvider)} tabs={[{ key: "anthropic", label: t("settings.providers.anthropic") }, { key: "openai", label: t("settings.providers.openai") }]} /></div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-text-2">{t("settings.apiKey")}
          <span data-testid="key-status">{key ? <Badge tone="good">{t("settings.keySet", { last4: key.slice(-4) })}</Badge> : <Badge tone="muted">{t("settings.noKey")}</Badge>}</span></div>
        <div className="flex flex-wrap gap-2">
          <input data-testid="key-input" type="password" autoComplete="off" spellCheck={false} className="input flex-1 min-w-[14rem]" dir="ltr" placeholder={t("settings.keyPlaceholder")} value={v} onChange={(e) => setV(e.target.value)} aria-label={t("settings.apiKey")} />
          <button data-testid="key-save" className="btn-accent" disabled={!v.trim()} onClick={() => { ui.saveKey(ui.apiProvider, v); setV(""); }}>{t("settings.save")}</button>
          <button data-testid="key-clear" className="btn" disabled={!key} onClick={() => ui.clearKey(ui.apiProvider)}><Trash2 size={14} />{t("settings.clearKey")}</button>
        </div>
        <p className="text-xs text-text-2">{t(`settings.keyHelp.${ui.apiProvider}`)}</p>
      </div>
      <div className="space-y-1"><div className="text-xs text-text-2">{t("settings.model")}</div>
        <ModelPicker key={ui.apiProvider} testId="model-select" options={ui.apiProvider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS} value={ui.model[ui.apiProvider]} onChange={(m) => ui.setModel(ui.apiProvider, m)} /></div>
    </div>
  );
}

function BridgeSettings() {
  const { t } = useTranslation();
  const ui = useUi();
  const [h, setH] = useState<BridgeHealth | null>(null);
  const [url, setUrl] = useState(ui.bridgeUrl);
  const [model, setModel] = useState(ui.bridgeModel);
  const test = () => { setH(null); void bridgeHealth(ui.bridgeUrl).then(setH); };
  useEffect(test, [ui.bridgeUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const cli = h?.clis?.[ui.bridgeCli];
  return (
    <div className="space-y-4" data-testid="bridge-settings">
      <Note tone="muted">{t("settings.bridgeExplain")}</Note>
      <div className="space-y-1"><div className="text-xs text-text-2">{t("settings.cliLabel")}</div>
        <Tabs testId="cli-tabs" value={ui.bridgeCli} onChange={(c) => ui.setBridgeCli(c as BridgeCli)} tabs={[{ key: "claude", label: t("settings.cli.claude") }, { key: "codex", label: t("settings.cli.codex") }]} /></div>
      <div className="flex flex-wrap items-center gap-2" data-testid="bridge-status">
        {h === null ? <Badge tone="muted">{t("agent.checking")}</Badge> : !h.ok ? <Badge tone="bad"><XCircle size={12} />{t("settings.bridgeNotRunning")}</Badge>
          : cli?.found ? <Badge tone="good"><CheckCircle2 size={12} />{t("settings.bridgeOk", { cli: t(`settings.cli.${ui.bridgeCli}`), version: cli.version ?? "" })}</Badge>
          : <Badge tone="warn"><XCircle size={12} />{t("settings.cliMissing", { cli: t(`settings.cli.${ui.bridgeCli}`) })}</Badge>}
        <button className="btn" onClick={test} data-testid="bridge-test"><RefreshCw size={14} />{t("settings.testConnection")}</button>
      </div>
      <div className="space-y-1"><div className="text-xs text-text-2">{t("settings.bridgeModel")}</div>
        <div className="flex flex-wrap gap-2">
          <input className="input w-64" dir="ltr" placeholder={t("settings.bridgeModelPh")} value={model} onChange={(e) => setModel(e.target.value)} aria-label={t("settings.bridgeModel")} />
          <button className="btn" onClick={() => ui.setBridgeModel(model.trim())}>{t("settings.save")}</button>
        </div></div>
      <div className="space-y-1"><div className="text-xs text-text-2">{t("settings.bridgeUrl")}</div>
        <div className="flex flex-wrap gap-2">
          <input className="input w-64" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} aria-label={t("settings.bridgeUrl")} />
          <button className="btn" onClick={() => ui.setBridgeUrl(url.trim() || defaultBridgeUrl())}>{t("settings.save")}</button>
        </div></div>
      <div className="text-sm space-y-2">
        <div className="font-medium">{t("settings.howToStart")}</div>
        <ul className="list-disc ps-5 space-y-1 text-text-2">
          <li>{t("settings.startMac")}</li>
          <li>{t("settings.startWin")}</li>
          <li>{t("settings.startCli")} <code className="rounded bg-surface-2 px-1" dir="ltr">npm run demo</code></li>
          <li>{t("settings.loginNote")}</li>
        </ul>
      </div>
    </div>
  );
}
