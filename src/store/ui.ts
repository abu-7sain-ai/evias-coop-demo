// UI state: theme, language, scope, role, current view, agent settings. Persistent keys are the ones named in the spec.
import { create } from "zustand";
import i18n from "../i18n";

export type Theme = "light" | "dark";
export type Lang = "ar" | "en";
export type ViewKey = "dashboard" | "agent" | "map" | "spaces" | "shelves" | "inventory" | "sales" | "finance" | "members" | "staff" | "complaints" | "ministry" | "settings";
export const VIEWS: ViewKey[] = ["dashboard", "agent", "map", "spaces", "shelves", "inventory", "sales", "finance", "members", "staff", "complaints", "ministry", "settings"];
export const ROLES = ["ministry_admin", "inspector", "auditor", "coop_admin", "chair", "treasurer", "accountant", "purchaser", "leasing", "hr", "branch_manager", "cashier", "stockkeeper", "supplier"] as const;
export type Role = (typeof ROLES)[number];
export const MINISTRY_ROLES: Role[] = ["ministry_admin", "inspector", "auditor"];

/** Which views each role sees (cosmetic only, spec §3). Ministry view only for the first three roles. */
const ALL_COOP: ViewKey[] = VIEWS.filter((v) => v !== "ministry");
export const ROLE_VIEWS: Record<Role, ViewKey[]> = {
  ministry_admin: VIEWS, inspector: VIEWS, auditor: VIEWS, coop_admin: ALL_COOP, chair: ALL_COOP,
  treasurer: ["dashboard", "agent", "spaces", "sales", "finance", "members", "settings"],
  accountant: ["dashboard", "agent", "spaces", "sales", "finance", "members", "settings"],
  purchaser: ["dashboard", "agent", "map", "shelves", "inventory", "sales", "finance", "complaints", "settings"],
  leasing: ["dashboard", "agent", "map", "spaces", "shelves", "settings"],
  hr: ["dashboard", "agent", "staff", "settings"],
  branch_manager: ["dashboard", "agent", "map", "spaces", "shelves", "inventory", "sales", "staff", "complaints", "settings"],
  cashier: ["sales", "complaints", "settings"],
  stockkeeper: ["map", "shelves", "inventory", "settings"],
  supplier: ["shelves", "inventory", "finance", "settings"],
};

export type AgentMode = "api" | "bridge";
export type ApiProvider = "anthropic" | "openai";
export type BridgeCli = "claude" | "codex";
export const ANTHROPIC_MODELS = ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"];
export const OPENAI_MODELS = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o"];

export interface AgentContext { coop_id: string; branch_id: string | null; fixture_id?: string; record_id?: string; view: ViewKey }

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};
const systemTheme = (): Theme => (typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

/** Default bridge URL: same origin when the app is served by the bridge, else the bridge's default port. */
export const defaultBridgeUrl = () => (typeof location !== "undefined" && location.port === "5317" ? location.origin : "http://127.0.0.1:5317");

interface UiState {
  theme: Theme; lang: Lang; coopId: string; branchId: string | null; role: Role; view: ViewKey;
  agentOpen: boolean; agentDraft: { question: string; context: AgentContext | null; nonce: number } | null;
  agentMode: AgentMode; apiProvider: ApiProvider; bridgeCli: BridgeCli; bridgeUrl: string; bridgeModel: string;
  model: Record<ApiProvider, string>; keyVersion: number;
  setTheme: (t: Theme) => void; setLang: (l: Lang) => void; setCoop: (c: string) => void; setBranch: (b: string | null) => void;
  setRole: (r: Role) => void; setView: (v: ViewKey) => void; setAgentOpen: (o: boolean) => void;
  askAgent: (question: string, context: AgentContext | null) => void; clearDraft: () => void;
  setAgentMode: (m: AgentMode) => void; setApiProvider: (p: ApiProvider) => void; setBridgeCli: (c: BridgeCli) => void;
  setBridgeUrl: (u: string) => void; setBridgeModel: (m: string) => void; setModel: (p: ApiProvider, m: string) => void;
  saveKey: (p: ApiProvider, key: string) => void; clearKey: (p: ApiProvider) => void;
}

export const keyStorageName = (p: ApiProvider) => (p === "anthropic" ? "evias.anthropic_key" : "evias.openai_key");
/** Keys are read on demand from localStorage and never kept in React state or logged. */
export const readKey = (p: ApiProvider) => ls.get(keyStorageName(p)) ?? "";

const applyDoc = (theme: Theme, lang: Lang) => {
  const el = document.documentElement;
  el.dataset.theme = theme; el.lang = lang; el.dir = lang === "ar" ? "rtl" : "ltr";
};

const initialTheme = (ls.get("evias.theme") as Theme) || systemTheme();
const initialLang = (ls.get("evias.lang") as Lang) || "ar";

export const useUi = create<UiState>((set, get) => ({
  theme: initialTheme, lang: initialLang, coopId: "C1", branchId: null, role: "coop_admin", view: "dashboard",
  agentOpen: false, agentDraft: null,
  agentMode: (ls.get("evias.agent_mode") as AgentMode) || "api",
  apiProvider: (ls.get("evias.api_provider") as ApiProvider) || "anthropic",
  bridgeCli: (ls.get("evias.bridge_cli") as BridgeCli) || "claude",
  bridgeUrl: ls.get("evias.bridge_url") || defaultBridgeUrl(),
  bridgeModel: ls.get("evias.bridge_model") || "",
  model: { anthropic: ls.get("evias.model.anthropic") || ANTHROPIC_MODELS[0], openai: ls.get("evias.model.openai") || OPENAI_MODELS[0] },
  keyVersion: 0,
  setTheme: (theme) => { ls.set("evias.theme", theme); applyDoc(theme, get().lang); set({ theme }); },
  setLang: (lang) => { ls.set("evias.lang", lang); applyDoc(get().theme, lang); void i18n.changeLanguage(lang); set({ lang }); },
  setCoop: (coopId) => set({ coopId, branchId: null }),
  setBranch: (branchId) => set({ branchId }),
  setRole: (role) => {
    const views = ROLE_VIEWS[role]; const { view, coopId } = get();
    const ministry = MINISTRY_ROLES.includes(role);
    set({ role, view: views.includes(view) ? view : views[0], coopId: !ministry && coopId === "ALL" ? "C1" : coopId, branchId: !ministry && coopId === "ALL" ? null : get().branchId });
  },
  setView: (view) => set({ view }),
  setAgentOpen: (agentOpen) => set({ agentOpen }),
  askAgent: (question, context) => set({ agentOpen: true, agentDraft: { question, context, nonce: Date.now() } }),
  clearDraft: () => set({ agentDraft: null }),
  setAgentMode: (agentMode) => { ls.set("evias.agent_mode", agentMode); set({ agentMode }); },
  setApiProvider: (apiProvider) => { ls.set("evias.api_provider", apiProvider); set({ apiProvider }); },
  setBridgeCli: (bridgeCli) => { ls.set("evias.bridge_cli", bridgeCli); set({ bridgeCli }); },
  setBridgeUrl: (bridgeUrl) => { ls.set("evias.bridge_url", bridgeUrl); set({ bridgeUrl }); },
  setBridgeModel: (bridgeModel) => { ls.set("evias.bridge_model", bridgeModel || null); set({ bridgeModel }); },
  setModel: (p, m) => { ls.set(`evias.model.${p}`, m); set({ model: { ...get().model, [p]: m } }); },
  saveKey: (p, key) => { ls.set(keyStorageName(p), key.trim()); set({ keyVersion: get().keyVersion + 1 }); },
  clearKey: (p) => { ls.set(keyStorageName(p), null); set({ keyVersion: get().keyVersion + 1 }); },
}));
