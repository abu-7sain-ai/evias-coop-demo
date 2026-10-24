// Anthropic Messages API, called directly from the browser (spec/01-SPEC.md §5.1). Client-side tool loop, ≤ 6 rounds.
import type { Data } from "../../lib/types";
import { TOOL_DEFS, describeCall, runTool } from "../tools";
import { readSse, httpError } from "../sse";
import { MAX_TOKENS, MAX_TOOL_ROUNDS, TEMPERATURE, type RunArgs } from "../types";

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

export async function runAnthropic(d: Data, key: string, model: string, a: RunArgs, fetchImpl: typeof fetch = fetch) {
  const messages: { role: "user" | "assistant"; content: unknown }[] = [...a.history.map((h) => ({ role: h.role, content: h.content })), { role: "user", content: a.question }];
  let useTemperature = true;
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const last = round === MAX_TOOL_ROUNDS;
    const body = { model, max_tokens: MAX_TOKENS, ...(useTemperature ? { temperature: TEMPERATURE } : {}), system: a.system, messages, tools: TOOL_DEFS, ...(last ? { tool_choice: { type: "none" } } : {}), stream: true };
    let res: Response;
    try {
      res = await fetchImpl(ANTHROPIC_URL, {
        method: "POST", signal: a.signal,
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (a.signal?.aborted) return a.onEvent({ type: "error", code: "aborted", message: "" });
      return a.onEvent({ type: "error", code: "network", message: e instanceof Error ? e.message : String(e) });
    }
    if (!res.ok) {
      const err = httpError(res.status, await res.text());
      // Some models reject sampling parameters; retry once without temperature.
      if (res.status === 400 && useTemperature && /temperature/i.test(err.message)) { useTemperature = false; round--; continue; }
      return a.onEvent({ type: "error", code: res.status === 401 ? "invalid_key" : res.status === 429 ? "rate_limited" : "http", status: res.status, message: err.message });
    }
    const blocks: (Block & { json?: string })[] = [];
    let stop: string | null = null;
    for await (const ev of readSse(res, a.signal)) {
      let j: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      try { j = JSON.parse(ev.data); } catch { continue; }
      if (j.type === "message_start") a.onEvent({ type: "usage", input: j.message?.usage?.input_tokens ?? 0, output: 0 });
      else if (j.type === "content_block_start") blocks[j.index] = j.content_block.type === "tool_use" ? { type: "tool_use", id: j.content_block.id, name: j.content_block.name, input: {}, json: "" } : { type: "text", text: "" };
      else if (j.type === "content_block_delta") {
        const b = blocks[j.index];
        if (j.delta.type === "text_delta" && b?.type === "text") { b.text += j.delta.text; a.onEvent({ type: "text", text: j.delta.text }); }
        else if (j.delta.type === "input_json_delta" && b) b.json = (b.json ?? "") + j.delta.partial_json;
      } else if (j.type === "message_delta") { stop = j.delta?.stop_reason ?? stop; a.onEvent({ type: "usage", input: 0, output: j.usage?.output_tokens ?? 0 }); }
      else if (j.type === "error") return a.onEvent({ type: "error", code: j.error?.type === "rate_limit_error" ? "rate_limited" : "http", message: j.error?.message ?? "stream error" });
    }
    if (a.signal?.aborted) return a.onEvent({ type: "error", code: "aborted", message: "" });
    const content: Block[] = blocks.filter(Boolean).map((b): Block => (b.type === "tool_use" ? { type: "tool_use", id: b.id, name: b.name, input: b.json ? safeJson(b.json) : {} } : { type: "text", text: b.text })).filter((b) => b.type !== "text" || b.text);
    messages.push({ role: "assistant", content });
    const uses = content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
    if (stop !== "tool_use" || !uses.length) return;
    a.onEvent({ type: "reset_text" });
    messages.push({ role: "user", content: uses.map((u) => { a.onEvent({ type: "tool", call: describeCall(u.name, u.input) }); return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(runTool(d, u.name, u.input)) }; }) });
  }
}

export const safeJson = (s: string): Record<string, unknown> => { try { return JSON.parse(s) ?? {}; } catch { return {}; } };
