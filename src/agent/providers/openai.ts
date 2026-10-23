// OpenAI Chat Completions API from the browser, function tools, streaming, client-side tool loop ≤ 6 rounds.
import type { Data } from "../../lib/types";
import { TOOL_DEFS, describeCall, runTool } from "../tools";
import { readSse, httpError } from "../sse";
import { MAX_TOKENS, MAX_TOOL_ROUNDS, TEMPERATURE, type RunArgs } from "../types";
import { safeJson } from "./anthropic";

export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const TOOLS = TOOL_DEFS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));

export async function runOpenAi(d: Data, key: string, model: string, a: RunArgs, fetchImpl: typeof fetch = fetch) {
  const messages: Record<string, unknown>[] = [{ role: "system", content: a.system }, ...a.history.map((h) => ({ role: h.role, content: h.content })), { role: "user", content: a.question }];
  let useTemperature = true;
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const last = round === MAX_TOOL_ROUNDS;
    const body = { model, messages, tools: TOOLS, tool_choice: last ? "none" : "auto", ...(useTemperature ? { temperature: TEMPERATURE } : {}), max_completion_tokens: MAX_TOKENS, stream: true, stream_options: { include_usage: true } };
    let res: Response;
    try {
      res = await fetchImpl(OPENAI_URL, { method: "POST", signal: a.signal, headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
    } catch (e) {
      if (a.signal?.aborted) return a.onEvent({ type: "error", code: "aborted", message: "" });
      return a.onEvent({ type: "error", code: "network", message: e instanceof Error ? e.message : String(e) });
    }
    if (!res.ok) {
      const err = httpError(res.status, await res.text());
      if (res.status === 400 && useTemperature && /temperature/i.test(err.message)) { useTemperature = false; round--; continue; }
      return a.onEvent({ type: "error", code: res.status === 401 ? "invalid_key" : res.status === 429 ? "rate_limited" : "http", status: res.status, message: err.message });
    }
    let text = ""; let finish: string | null = null;
    const calls: { id: string; name: string; args: string }[] = [];
    for await (const ev of readSse(res, a.signal)) {
      if (ev.data === "[DONE]") break;
      let j: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      try { j = JSON.parse(ev.data); } catch { continue; }
      if (j.usage) a.onEvent({ type: "usage", input: j.usage.prompt_tokens ?? 0, output: j.usage.completion_tokens ?? 0 });
      const c = j.choices?.[0];
      if (!c) continue;
      if (c.delta?.content) { text += c.delta.content; a.onEvent({ type: "text", text: c.delta.content }); }
      for (const tc of c.delta?.tool_calls ?? []) {
        const slot = (calls[tc.index] ??= { id: "", name: "", args: "" });
        if (tc.id) slot.id = tc.id;
        if (tc.function?.name) slot.name += tc.function.name;
        if (tc.function?.arguments) slot.args += tc.function.arguments;
      }
      if (c.finish_reason) finish = c.finish_reason;
    }
    if (a.signal?.aborted) return a.onEvent({ type: "error", code: "aborted", message: "" });
    const used = calls.filter(Boolean);
    if (finish !== "tool_calls" || !used.length) return;
    a.onEvent({ type: "reset_text" });
    messages.push({ role: "assistant", content: text || null, tool_calls: used.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args || "{}" } })) });
    for (const c of used) {
      const input = safeJson(c.args);
      a.onEvent({ type: "tool", call: describeCall(c.name, input) });
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(runTool(d, c.name, input)) });
    }
  }
}
