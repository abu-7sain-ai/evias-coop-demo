// Simulated runs of the agent loop (no live model): mocked HTTP streams for Anthropic/OpenAI, recorded CLI output for the bridge.
import { describe, expect, it } from "vitest";
import { buildSystemPrompt, REFUSAL_AR, REFUSAL_EN, SYSTEM_TEMPLATE } from "../../src/agent/prompt";
import { ANTHROPIC_URL, runAnthropic } from "../../src/agent/providers/anthropic";
import { runBridge } from "../../src/agent/providers/bridge";
import { OPENAI_URL, runOpenAi } from "../../src/agent/providers/openai";
import type { AgentEvent } from "../../src/agent/types";
// @ts-expect-error plain JS module
import { claudeArgs, claudeParser } from "../../bridge/cli-claude.mjs";
// @ts-expect-error plain JS module
import { codexArgs, codexParser } from "../../bridge/cli-codex.mjs";
import { loadData } from "./load";

const d = loadData();
const sse = (events: unknown[], named = false) => new Response(new ReadableStream({
  start(c) { for (const e of events) c.enqueue(new TextEncoder().encode(`${named ? `event: ${(e as { type: string }).type}\n` : ""}data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`)); c.close(); },
}), { status: 200, headers: { "content-type": "text/event-stream" } });
const collect = () => { const ev: AgentEvent[] = []; return { ev, onEvent: (e: AgentEvent) => ev.push(e), text: () => { let t = ""; for (const e of ev) { if (e.type === "text") t += e.text; if (e.type === "reset_text") t = ""; } return t; } }; };
const sys = buildSystemPrompt(d, { coop_id: "C1", branch_id: "C1-B1", view: "dashboard" });

describe("system prompt", () => {
  it("is the spec text with placeholders filled", () => {
    expect(sys).toContain('You are "الوكيل" (the Agent)');
    expect(sys).toContain("جمعية الواحة التعاونية / Al-Waha Co-op (السوق المركزي / Central Market). Demo date: 2026-11-01.");
    expect(sys).toContain(REFUSAL_AR);
    expect(sys).toContain(REFUSAL_EN);
    expect(sys).not.toMatch(/\{\{/);
    expect(SYSTEM_TEMPLATE.split("\n").length).toBeGreaterThan(15);
  });
});

describe("Anthropic provider (mocked stream)", () => {
  it("runs a tool round, returns the tool result to the model, then streams the answer", async () => {
    const bodies: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    let call = 0;
    const fetchMock = (async (url: string, init: RequestInit) => {
      expect(url).toBe(ANTHROPIC_URL);
      const h = init.headers as Record<string, string>;
      expect(h["x-api-key"]).toBe("sk-test");
      expect(h["anthropic-dangerous-direct-browser-access"]).toBe("true");
      bodies.push(JSON.parse(init.body as string));
      if (call++ === 0) return sse([
        { type: "message_start", message: { usage: { input_tokens: 1000, output_tokens: 1 } } },
        { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "tu1", name: "rent_arrears", input: {} } },
        { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"coop_' } },
        { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: 'id":"C1"}' } },
        { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 20 } },
      ], true);
      return sse([
        { type: "message_start", message: { usage: { input_tokens: 1400, output_tokens: 1 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "M-07 صرافة الخليج متأخرة " } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "45 يوم." } },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 60 } },
      ], true);
    }) as unknown as typeof fetch;
    const c = collect();
    await runAnthropic(d, "sk-test", "claude-sonnet-5-5", { system: sys, history: [], question: "منو متأخر بالإيجار؟", onEvent: c.onEvent }, fetchMock);
    expect(c.text()).toBe("M-07 صرافة الخليج متأخرة 45 يوم.");
    expect(c.ev.filter((e) => e.type === "tool")).toEqual([{ type: "tool", call: "rent_arrears(coop_id=C1)" }]);
    expect(bodies[0]).toMatchObject({ model: "claude-sonnet-5-5", max_tokens: 1500, temperature: 0.2, stream: true });
    expect(bodies[0].tools).toHaveLength(22);
    const toolResult = JSON.parse(bodies[1].messages.at(-1).content[0].content);
    expect(toolResult.rows[0]).toMatchObject({ space_id: "M-07", days_late: 45, amount: 530 });
    const usage = c.ev.filter((e): e is Extract<AgentEvent, { type: "usage" }> => e.type === "usage");
    expect(usage.reduce((a, u) => a + u.input, 0)).toBe(2400);
    expect(usage.reduce((a, u) => a + u.output, 0)).toBe(80);
  });
  it("caps at 6 tool rounds, then forces a final answer without tools", async () => {
    const bodies: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const fetchMock = (async (_u: string, init: RequestInit) => {
      const b = JSON.parse(init.body as string); bodies.push(b);
      if (b.tool_choice?.type === "none") return sse([{ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }, { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "final" } }, { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 3 } }]);
      return sse([{ type: "content_block_start", index: 0, content_block: { type: "tool_use", id: `t${bodies.length}`, name: "get_kpis", input: {} } }, { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"coop_id":"C1"}' } }, { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 3 } }]);
    }) as unknown as typeof fetch;
    const c = collect();
    await runAnthropic(d, "k", "m", { system: sys, history: [], question: "q", onEvent: c.onEvent }, fetchMock);
    expect(bodies).toHaveLength(7);
    expect(c.ev.filter((e) => e.type === "tool")).toHaveLength(6);
    expect(c.text()).toBe("final");
  });
  it("maps 401 and 429 to the spec's messages; retries once without temperature if rejected", async () => {
    for (const [status, code] of [[401, "invalid_key"], [429, "rate_limited"], [500, "http"]] as const) {
      const c = collect();
      await runAnthropic(d, "k", "m", { system: sys, history: [], question: "q", onEvent: c.onEvent }, (async () => new Response(JSON.stringify({ error: { message: "x" } }), { status })) as unknown as typeof fetch);
      expect(c.ev).toContainEqual(expect.objectContaining({ type: "error", code, status }));
    }
    const sent: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const c = collect();
    await runAnthropic(d, "k", "m", { system: sys, history: [], question: "q", onEvent: c.onEvent }, (async (_u: string, init: RequestInit) => {
      const b = JSON.parse(init.body as string); sent.push(b);
      if ("temperature" in b) return new Response(JSON.stringify({ error: { message: "temperature is not supported for this model" } }), { status: 400 });
      return sse([{ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }, { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok" } }, { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: {} }]);
    }) as unknown as typeof fetch);
    expect(sent).toHaveLength(2);
    expect(c.text()).toBe("ok");
  });
  it("network failure is reported, not swallowed", async () => {
    const c = collect();
    await runAnthropic(d, "k", "m", { system: sys, history: [], question: "q", onEvent: c.onEvent }, (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch);
    expect(c.ev).toContainEqual({ type: "error", code: "network", message: "Failed to fetch" });
  });
});

describe("OpenAI provider (mocked stream)", () => {
  it("function call → tool message → streamed answer", async () => {
    const bodies: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const fetchMock = (async (url: string, init: RequestInit) => {
      expect(url).toBe(OPENAI_URL);
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-o");
      const b = JSON.parse(init.body as string); bodies.push(b);
      if (bodies.length === 1) return sse([
        { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "supplier_scorecard", arguments: '{"coop_id":"C1",' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"supplier_id":"SUP-12"}' } }] } }] },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
        { choices: [], usage: { prompt_tokens: 900, completion_tokens: 25 } }, "[DONE]",
      ]);
      return sse([{ choices: [{ delta: { content: "SUP-12: 33% on time." } }] }, { choices: [{ delta: {}, finish_reason: "stop" }] }, "[DONE]"]);
    }) as unknown as typeof fetch;
    const c = collect();
    await runOpenAi(d, "sk-o", "gpt-4.1-mini", { system: sys, history: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }], question: "Rate Frozen Meats Co.", onEvent: c.onEvent }, fetchMock);
    expect(c.text()).toBe("SUP-12: 33% on time.");
    expect(bodies[0]).toMatchObject({ model: "gpt-4.1-mini", max_completion_tokens: 1500, temperature: 0.2, stream: true });
    expect(bodies[0].messages[0]).toEqual({ role: "system", content: sys });
    expect(bodies[0].messages).toHaveLength(4);
    const tool = bodies[1].messages.at(-1);
    expect(tool.role).toBe("tool");
    expect(JSON.parse(tool.content).rows[0]).toMatchObject({ supplier_id: "SUP-12", on_time_pct: 33.3, short_deliveries: 2 });
    expect(c.ev).toContainEqual({ type: "tool", call: "supplier_scorecard(coop_id=C1, supplier_id=SUP-12)" });
  });
});

describe("bridge provider + CLI parsers (recorded output)", () => {
  it("relays bridge SSE events and stops at done", async () => {
    const c = collect();
    await runBridge("http://127.0.0.1:5317", "claude", "", { system: sys, history: [], question: "q", onEvent: c.onEvent },
      (async () => sse([{ type: "tool", call: "ghost_employees(coop_id=C3)" }, { type: "text", text: "6 employees" }, { type: "done" }, { type: "text", text: "ignored" }])) as unknown as typeof fetch);
    expect(c.text()).toBe("6 employees");
    const down = collect();
    await runBridge("http://127.0.0.1:1", "codex", "", { system: sys, history: [], question: "q", onEvent: down.onEvent }, (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch);
    expect(down.ev[0]).toMatchObject({ type: "error", code: "bridge_down" });
  });
  it("Claude Code stream-json → text, tools, usage; auth failure → not logged in", () => {
    const ev: AgentEvent[] = [];
    const p = claudeParser((e: AgentEvent) => ev.push(e));
    p.line(JSON.stringify({ type: "system", subtype: "init", tools: ["mcp__evias__get_kpis"] }));
    p.line(JSON.stringify({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "let me check" } } }));
    p.line(JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "mcp__evias__ghost_employees", input: { coop_id: "C3" } }], usage: { input_tokens: 10, output_tokens: 5 } } }));
    p.line(JSON.stringify({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "C3-B2: 6" } } }));
    p.line(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "C3-B2: 6" }], usage: { input_tokens: 20, output_tokens: 9 } } }));
    p.line(JSON.stringify({ type: "result", subtype: "success", is_error: false }));
    let t = ""; for (const e of ev) { if (e.type === "text") t += e.text; if (e.type === "reset_text") t = ""; }
    expect(t).toBe("C3-B2: 6");
    expect(ev).toContainEqual({ type: "tool", call: "ghost_employees(coop_id=C3)" });
    const bad: AgentEvent[] = [];
    // recorded from claude 2.1.309 with an invalid key
    claudeParser((e: AgentEvent) => bad.push(e)).line(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Invalid API key · Fix external API key" }] }, error: "authentication_failed", is_api_error_message: true, api_error_status: 401 }));
    expect(bad[0]).toMatchObject({ type: "error", code: "cli_not_logged_in" });
  });
  it("Claude args lock the CLI down to the evias tools", () => {
    const a = claudeArgs({ systemFile: "/t/s.txt", mcpFile: "/t/m.json", model: "" });
    expect(a).toEqual(expect.arrayContaining(["-p", "--system-prompt-file", "--strict-mcp-config", "--permission-mode", "dontAsk"]));
    expect(a[a.indexOf("--tools") + 1]).toBe("");
    expect(a[a.indexOf("--allowedTools") + 1]).toBe("mcp__evias");
    expect(a).not.toContain("--model");
  });
  it("Codex JSONL → tool + message; transient reconnect errors are not fatal; real failure is", () => {
    const ev: AgentEvent[] = [];
    const p = codexParser((e: AgentEvent) => ev.push(e));
    p.line(JSON.stringify({ type: "thread.started", thread_id: "x" }));
    p.line(JSON.stringify({ type: "error", message: "Reconnecting... 2/5 (stream disconnected)" }));
    p.line(JSON.stringify({ type: "item.started", item: { id: "i1", type: "mcp_tool_call", server: "evias", tool: "subsidized_breaches", arguments: { coop_id: "ALL" } } }));
    p.line(JSON.stringify({ type: "item.completed", item: { id: "i1", type: "mcp_tool_call", server: "evias", tool: "subsidized_breaches", arguments: { coop_id: "ALL" } } }));
    p.line(JSON.stringify({ type: "item.completed", item: { id: "i2", type: "agent_message", text: "4 branches" } }));
    p.line(JSON.stringify({ type: "turn.completed", usage: { input_tokens: 50, output_tokens: 7 } }));
    p.finish();
    expect(ev.filter((e) => e.type === "error")).toHaveLength(0);
    expect(ev.filter((e) => e.type === "tool")).toEqual([{ type: "tool", call: "subsidized_breaches(coop_id=ALL)" }]);
    expect(ev).toContainEqual({ type: "text", text: "4 branches" });
    const bad: AgentEvent[] = [];
    const q = codexParser((e: AgentEvent) => bad.push(e));
    q.line(JSON.stringify({ type: "turn.failed", error: { message: "unexpected status 401 Unauthorized" } }));
    expect(bad[0]).toMatchObject({ type: "error", code: "cli_not_logged_in" });
  });
  it("Codex args: read-only, no shell, evias MCP, prompt on stdin", () => {
    const a = codexArgs({ system: 'rules "quoted" — عربي', mcpCommand: "/usr/bin/node", mcpArgs: ["/x/mcp-tools.mjs"], dataDir: "C:\\demo\\data", cwd: "/tmp/w", model: "" });
    expect(a.slice(0, 2)).toEqual(["exec", "--json"]);
    expect(a).toEqual(expect.arrayContaining(["--sandbox", "read-only", "--disable", "shell_tool", "--ignore-user-config", "--ephemeral"]));
    expect(a).toContain('developer_instructions="rules \\"quoted\\" — عربي"');
    expect(a).toContain('mcp_servers.evias.env={ EVIAS_DATA_DIR = "C:\\\\demo\\\\data" }');
    expect(a.at(-1)).toBe("-");
  });
});
