export type AgentErrorCode = "invalid_key" | "rate_limited" | "network" | "http" | "no_key" | "bridge_down" | "cli_missing" | "cli_not_logged_in" | "cli_failed" | "aborted";
export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "reset_text" }
  | { type: "tool"; call: string }
  | { type: "usage"; input: number; output: number }
  | { type: "error"; code: AgentErrorCode; message: string; status?: number };

export interface ChatTurn { role: "user" | "assistant"; content: string }
export interface RunArgs { system: string; history: ChatTurn[]; question: string; onEvent: (e: AgentEvent) => void; signal?: AbortSignal }
export const MAX_TOOL_ROUNDS = 6;
export const MAX_TOKENS = 1500;
export const TEMPERATURE = 0.2;
export const HISTORY_LIMIT = 12;
