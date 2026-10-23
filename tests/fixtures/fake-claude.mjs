#!/usr/bin/env node
// Stand-in for the Claude Code CLI in the bridge smoke test (CI on macOS/Windows has no logged-in CLI).
// It checks the lock-down flags, starts the real evias MCP server from the --mcp-config file, calls one tool through it,
// and prints stream-json lines like `claude -p --output-format stream-json` does.
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
if (args[0] === "--version") { console.log("9.9.9 (Fake Claude Code)"); process.exit(0); }
const val = (f) => args[args.indexOf(f) + 1];
const must = [["--tools", ""], ["--allowedTools", "mcp__evias"], ["--permission-mode", "dontAsk"]];
for (const [f, v] of must) if (val(f) !== v) { console.log(JSON.stringify({ type: "result", is_error: true, result: `fake-cli: expected ${f} ${JSON.stringify(v)}` })); process.exit(1); }
const system = readFileSync(val("--system-prompt-file"), "utf8");
const cfg = JSON.parse(readFileSync(val("--mcp-config"), "utf8")).mcpServers.evias;
let prompt = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (c) => (prompt += c));
process.stdin.on("end", () => {
  const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");
  out({ type: "system", subtype: "init", tools: ["mcp__evias__rent_arrears"] });
  const mcp = spawn(cfg.command, cfg.args, { env: { ...process.env, ...cfg.env }, stdio: ["pipe", "pipe", "inherit"] });
  let buf = "";
  const send = (m) => mcp.stdin.write(JSON.stringify(m) + "\n");
  mcp.stdout.setEncoding("utf8");
  mcp.stdout.on("data", (c) => {
    buf += c; let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
      if (msg.id === 1) { send({ jsonrpc: "2.0", method: "notifications/initialized" }); send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "rent_arrears", arguments: { coop_id: "C1" } } }); out({ type: "assistant", message: { content: [{ type: "tool_use", name: "mcp__evias__rent_arrears", input: { coop_id: "C1" } }] } }); }
      if (msg.id === 2) {
        const r = JSON.parse(msg.result.content[0].text).rows[0];
        const text = `FAKE-CLI ${r.space_id} ${r.days_late} ${system.includes("الوكيل") ? "prompt-ok" : "prompt-missing"} ${prompt.includes("Conversation so far") ? "history" : "single"}`;
        out({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text } } });
        out({ type: "assistant", message: { content: [{ type: "text", text }], usage: { input_tokens: 123, output_tokens: 45 } } });
        out({ type: "result", subtype: "success", is_error: false });
        mcp.kill(); process.exit(0);
      }
    }
  });
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "1" } } });
});
