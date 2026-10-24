import { Bot, Eraser, KeyRound, Mic, Send, Settings as SettingsIcon, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { bridgeHealth, type BridgeHealth } from "../../agent/providers/bridge";
import { fmtNum, isArabic } from "../../lib/format";
import { useChat, type ChatMsg } from "../../store/chat";
import { readKey, useUi, type AgentContext, type ApiProvider } from "../../store/ui";
import { Badge, Note, Select, cx } from "../ui";

export function useAgentReady() {
  const { agentMode, apiProvider, keyVersion, bridgeUrl } = useUi();
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  useEffect(() => {
    if (agentMode !== "bridge") return;
    let live = true;
    const check = () => void bridgeHealth(bridgeUrl).then((h) => live && setHealth(h));
    check();
    const id = setInterval(check, 10000);
    return () => { live = false; clearInterval(id); };
  }, [agentMode, bridgeUrl]);
  void keyVersion;
  const hasKey = !!readKey(apiProvider);
  return { ready: agentMode === "api" ? hasKey : !!health?.ok, hasKey, health };
}

export function ModelChip() {
  const { t } = useTranslation();
  const { agentMode, apiProvider, model, bridgeCli, bridgeModel } = useUi();
  const label = agentMode === "api" ? model[apiProvider] : `${t(`settings.cli.${bridgeCli}`)}${bridgeModel ? ` · ${bridgeModel}` : ""}`;
  return <Badge tone="accent" title={t(`settings.mode.${agentMode}`)}><span dir="ltr">{label}</span></Badge>;
}

function KeyCard() {
  const { t } = useTranslation();
  const { apiProvider, setApiProvider, saveKey, setView } = useUi();
  const [v, setV] = useState("");
  return (
    <div className="card p-4 space-y-3" data-testid="key-card">
      <div className="flex items-center gap-2 font-medium"><KeyRound size={16} />{t("agent.needKey")}</div>
      <Select label={t("settings.provider")} value={apiProvider} onChange={(p) => setApiProvider(p as ApiProvider)} options={[{ value: "anthropic", label: t("settings.providers.anthropic") }, { value: "openai", label: t("settings.providers.openai") }]} />
      <div className="flex gap-2">
        <input type="password" autoComplete="off" spellCheck={false} className="input flex-1 min-w-0" placeholder={t("settings.keyPlaceholder")} value={v} onChange={(e) => setV(e.target.value)} dir="ltr" aria-label={t("settings.apiKey")} />
        <button className="btn-accent" disabled={!v.trim()} onClick={() => { saveKey(apiProvider, v); setV(""); }}>{t("settings.save")}</button>
      </div>
      <p className="text-xs text-text-2">{t(`settings.keyHelp.${apiProvider}`)}</p>
      <button className="btn" onClick={() => setView("settings")}><SettingsIcon size={14} />{t("agent.openSettings")}</button>
    </div>
  );
}

function BridgeCard({ health }: { health: BridgeHealth | null }) {
  const { t } = useTranslation();
  const { setView, bridgeUrl } = useUi();
  return (
    <div className="card p-4 space-y-2 text-sm" data-testid="bridge-card">
      <div className="font-medium">{t("agent.bridgeDown")}</div>
      <p className="text-text-2">{t("agent.bridgeHow")}</p>
      <code className="block rounded bg-surface-2 px-2 py-1 text-xs" dir="ltr">{bridgeUrl}</code>
      {health === null && <p className="text-xs text-text-2">{t("agent.checking")}</p>}
      <button className="btn" onClick={() => setView("settings")}><SettingsIcon size={14} />{t("agent.openSettings")}</button>
    </div>
  );
}

function Message({ m }: { m: ChatMsg }) {
  const { t } = useTranslation();
  const rtl = isArabic(m.content);
  if (m.role === "user") return <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-ee-sm bg-accent px-3 py-2 text-sm text-white whitespace-pre-wrap" dir={rtl ? "rtl" : "ltr"}>{m.content}</div></div>;
  return (
    <div className="flex gap-2" data-testid="agent-message">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Bot size={15} /></div>
      <div className="min-w-0 flex-1 rounded-2xl rounded-es-sm border border-border bg-surface px-3 py-2 text-sm">
        {m.content ? <div className="md break-words" dir={rtl ? "rtl" : "ltr"}><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>
          : m.pending ? <span className="text-text-2 animate-pulse">{m.sources.length ? t("agent.working", { n: m.sources.length }) : t("agent.thinking")}</span> : null}
        {m.error && m.error.code !== "aborted" && <div className="mt-1 text-bad text-xs" data-testid="agent-error">{t(`agent.err.${m.error.code}`, { status: m.error.status ?? "", message: m.error.message })}</div>}
        {m.error?.code === "aborted" && <div className="mt-1 text-text-2 text-xs">{t("agent.stopped")}</div>}
        {m.sources.length > 0 && <div className="mt-2 border-t border-border pt-1.5 text-[11px] text-text-2" data-testid="sources"><span className="font-medium">{t("agent.sources")}:</span> <span dir="ltr" className="font-mono break-words">{m.sources.join(" · ")}</span></div>}
      </div>
    </div>
  );
}

export function ChatPanel({ variant, onClose }: { variant: "drawer" | "page"; onClose?: () => void }) {
  const { t } = useTranslation();
  const ui = useUi();
  const chat = useChat();
  const { ready, health } = useAgentReady();
  const [input, setInput] = useState("");
  const [ctx, setCtx] = useState<AgentContext | null>(null);
  const [more, setMore] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const scenarios = t("scenarios", { returnObjects: true }) as string[];

  useEffect(() => {
    if (!ui.agentDraft) return;
    setInput(ui.agentDraft.question); setCtx(ui.agentDraft.context); ui.clearDraft();
  }, [ui.agentDraft]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [chat.messages]);

  const send = (q = input) => { if (!q.trim() || chat.busy) return; void chat.send(q, ctx); setInput(""); setCtx(null); };

  return (
    <div className={cx("flex min-h-0 flex-col", variant === "drawer" ? "h-full" : "card h-[calc(100vh-11rem)]")} data-testid={`chat-${variant}`}>
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Bot size={18} className="text-accent shrink-0" />
        <div className="min-w-0">
          <h2 className="font-semibold leading-tight">{t("agent.title")}</h2>
          <div className="mt-0.5"><ModelChip /></div>
        </div>
        <div className="ms-auto flex items-center gap-1">
          <button className="btn px-2" onClick={chat.clear} title={t("agent.clear")} aria-label={t("agent.clear")} data-testid="clear-chat"><Eraser size={15} /></button>
          {onClose && <button className="btn px-2" onClick={onClose} aria-label={t("common.close")} data-testid="close-agent"><X size={15} /></button>}
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4 space-y-3" data-testid="chat-messages">
        {!ready && (ui.agentMode === "api" ? <KeyCard /> : <BridgeCard health={health} />)}
        {chat.messages.length === 0 && ready && <Note tone="accent">{t("agent.intro")}</Note>}
        {chat.messages.map((m) => <Message key={m.id} m={m} />)}
        <div ref={endRef} />
      </div>
      <div className="border-t border-border p-3 space-y-2">
        <div className="flex flex-wrap gap-1.5" data-testid="suggestions">
          {(more ? scenarios : scenarios.slice(0, 6)).map((q) => (
            <button key={q} className="chip hover:bg-surface-2 max-w-full truncate" onClick={() => { setInput(q); }} title={q}>{q}</button>
          ))}
          <button className="chip text-accent" onClick={() => setMore(!more)}>{more ? t("agent.less") : t("agent.more")}</button>
        </div>
        {ctx && <div className="flex items-center gap-2 text-xs text-text-2"><Badge tone="info">{t("agent.context")}</Badge><span dir="ltr" className="font-mono truncate">{ctx.fixture_id ?? ctx.record_id ?? ctx.coop_id}</span><button className="ms-auto underline" onClick={() => setCtx(null)}>{t("common.remove")}</button></div>}
        <div className="flex items-end gap-2">
          <textarea data-testid="agent-input" rows={2} className="input flex-1 min-w-0 resize-none" placeholder={t("agent.placeholder")} value={input} dir={isArabic(input) || (!input && ui.lang === "ar") ? "rtl" : "ltr"}
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="btn px-2" disabled title={t("agent.micSoon")} aria-label={t("agent.micSoon")}><Mic size={16} /></button>
          {chat.busy ? <button className="btn px-2" onClick={chat.stop} aria-label={t("agent.stop")} data-testid="stop"><Square size={16} /></button>
            : <button className="btn-accent px-2.5" disabled={!input.trim()} onClick={() => send()} aria-label={t("agent.send")} data-testid="agent-send"><Send size={16} className="rtl:-scale-x-100" /></button>}
        </div>
        <div className="flex justify-between text-[11px] text-text-2 num" data-testid="token-counter">
          <span>{t("agent.tokensLast", { i: fmtNum(chat.lastTurn.input), o: fmtNum(chat.lastTurn.output) })}</span>
          <span>{t("agent.tokensTotal", { i: fmtNum(chat.usage.input), o: fmtNum(chat.usage.output) })}</span>
        </div>
      </div>
    </div>
  );
}
