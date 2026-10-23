// Subscription mode: the local bridge (bridge/server.mjs) runs the Claude Code CLI or the Codex CLI on this computer.
// The CLI calls the same 22 tools through the bridge's MCP server; the bridge re-emits everything as one SSE format.
import { readSse } from "../sse";
import type { AgentEvent, RunArgs } from "../types";
import type { BridgeCli } from "../../store/ui";

export interface BridgeHealth { ok: boolean; version?: string; clis?: Record<BridgeCli, { found: boolean; version?: string; path?: string }>; data?: boolean }

export async function bridgeHealth(url: string, fetchImpl: typeof fetch = fetch): Promise<BridgeHealth> {
  try {
    const r = await fetchImpl(`${url.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return { ok: false };
    return { ...((await r.json()) as object), ok: true };
  } catch {
    return { ok: false };
  }
}

export async function runBridge(url: string, cli: BridgeCli, model: string, a: RunArgs, fetchImpl: typeof fetch = fetch) {
  let res: Response;
  try {
    res = await fetchImpl(`${url.replace(/\/$/, "")}/agent`, {
      method: "POST", signal: a.signal, headers: { "content-type": "application/json" },
      body: JSON.stringify({ cli, model: model || undefined, system: a.system, history: a.history, question: a.question }),
    });
  } catch (e) {
    if (a.signal?.aborted) return a.onEvent({ type: "error", code: "aborted", message: "" });
    return a.onEvent({ type: "error", code: "bridge_down", message: e instanceof Error ? e.message : String(e) });
  }
  if (!res.ok) return a.onEvent({ type: "error", code: "http", status: res.status, message: (await res.text()).slice(0, 300) });
  for await (const ev of readSse(res, a.signal)) {
    let j: AgentEvent | { type: "done" };
    try { j = JSON.parse(ev.data); } catch { continue; }
    if (j.type === "done") return;
    a.onEvent(j);
  }
  if (a.signal?.aborted) a.onEvent({ type: "error", code: "aborted", message: "" });
}
