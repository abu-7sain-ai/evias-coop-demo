// Chat state for the agent panel. Survives navigation; cleared by "clear chat" or "Reset demo data".
import { create } from "zustand";
import { buildSystemPrompt } from "../agent/prompt";
import { runAnthropic } from "../agent/providers/anthropic";
import { runBridge } from "../agent/providers/bridge";
import { runOpenAi } from "../agent/providers/openai";
import { HISTORY_LIMIT, type AgentErrorCode, type AgentEvent, type ChatTurn, type RunArgs } from "../agent/types";
import { useData } from "./data";
import { readKey, useUi, type AgentContext } from "./ui";

export interface ChatMsg { id: number; role: "user" | "assistant"; content: string; sources: string[]; error?: { code: AgentErrorCode; message: string; status?: number }; pending?: boolean }

interface ChatState {
  messages: ChatMsg[]; busy: boolean; usage: { input: number; output: number }; lastTurn: { input: number; output: number };
  send: (question: string, context: AgentContext | null) => Promise<void>; stop: () => void; clear: () => void;
}

let controller: AbortController | null = null;
let nextId = 1;

export const useChat = create<ChatState>((set, get) => ({
  messages: [], busy: false, usage: { input: 0, output: 0 }, lastTurn: { input: 0, output: 0 },
  stop: () => controller?.abort(),
  clear: () => { controller?.abort(); set({ messages: [], busy: false, usage: { input: 0, output: 0 }, lastTurn: { input: 0, output: 0 } }); },
  send: async (question, context) => {
    const q = question.trim();
    const data = useData.getState().data;
    if (!q || get().busy || !data) return;
    const ui = useUi.getState();
    const history: ChatTurn[] = get().messages.filter((m) => !m.error && !m.pending && m.content).slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content }));
    const user: ChatMsg = { id: nextId++, role: "user", content: q, sources: [] };
    const bot: ChatMsg = { id: nextId++, role: "assistant", content: "", sources: [], pending: true };
    set({ messages: [...get().messages, user, bot], busy: true, lastTurn: { input: 0, output: 0 } });
    const patch = (f: (m: ChatMsg) => ChatMsg) => set({ messages: get().messages.map((m) => (m.id === bot.id ? f(m) : m)) });
    const onEvent = (e: AgentEvent) => {
      if (e.type === "text") patch((m) => ({ ...m, content: m.content + e.text }));
      else if (e.type === "reset_text") patch((m) => ({ ...m, content: "" }));
      else if (e.type === "tool") patch((m) => ({ ...m, sources: [...m.sources, e.call] }));
      else if (e.type === "usage") set({ usage: { input: get().usage.input + e.input, output: get().usage.output + e.output }, lastTurn: { input: get().lastTurn.input + e.input, output: get().lastTurn.output + e.output } });
      else if (e.type === "error") patch((m) => ({ ...m, error: { code: e.code, message: e.message, status: e.status } }));
    };
    const ctx = context ?? { coop_id: ui.coopId, branch_id: ui.branchId, view: ui.view };
    controller = new AbortController();
    const args: RunArgs = { system: buildSystemPrompt(data, ctx), history, question: q, onEvent, signal: controller.signal };
    try {
      if (ui.agentMode === "bridge") await runBridge(ui.bridgeUrl, ui.bridgeCli, ui.bridgeModel, args);
      else {
        const key = readKey(ui.apiProvider);
        if (!key) onEvent({ type: "error", code: "no_key", message: "" });
        else if (ui.apiProvider === "openai") await runOpenAi(data, key, ui.model.openai, args);
        else await runAnthropic(data, key, ui.model.anthropic, args);
      }
    } catch (e) {
      onEvent({ type: "error", code: "network", message: e instanceof Error ? e.message : String(e) });
    } finally {
      patch((m) => ({ ...m, pending: false }));
      set({ busy: false });
      controller = null;
    }
  },
}));
