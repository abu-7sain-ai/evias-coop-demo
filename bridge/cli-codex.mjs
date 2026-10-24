// Codex CLI adapter: `codex exec --json` read-only, shell tool disabled, our rules as developer instructions, evias MCP server.
// Codex prints whole messages (no token deltas), so text arrives in one piece per message.
const toml = (s) => JSON.stringify(String(s)); // JSON string escapes are valid TOML basic strings

export function codexArgs({ system, mcpCommand, mcpArgs, dataDir, cwd, model }) {
  return [
    "exec", "--json", "--skip-git-repo-check", "--ephemeral", "--ignore-user-config", "--sandbox", "read-only", "-C", cwd,
    "--disable", "shell_tool",
    "-c", `developer_instructions=${toml(system)}`,
    "-c", 'web_search="disabled"',
    "-c", `mcp_servers.evias.command=${toml(mcpCommand)}`,
    "-c", `mcp_servers.evias.args=[${mcpArgs.map(toml).join(",")}]`,
    "-c", `mcp_servers.evias.env={ EVIAS_DATA_DIR = ${toml(dataDir)} }`,
    ...(model ? ["-m", model] : []),
    "-",                                  // prompt from stdin
  ];
}

export function codexParser(emit) {
  let failed = false, answered = false, lastError = null;
  const seen = new Set();
  const fail = (message) => {
    failed = true;
    emit({ type: "error", code: /401|unauthori[sz]ed|log ?in|auth/i.test(message) ? "cli_not_logged_in" : /429|rate/i.test(message) ? "rate_limited" : "cli_failed", message: message.slice(0, 300) });
  };
  return {
    line(raw) {
      let j; try { j = JSON.parse(raw); } catch { return; }
      const item = j.item ?? j.msg ?? {};
      if ((j.type === "item.started" || j.type === "item.completed") && /tool/.test(item.type ?? "")) {
        const id = item.id ?? `${item.tool}-${JSON.stringify(item.arguments)}`;
        if (seen.has(id)) return;   // a call may be reported as started and completed
        seen.add(id);
        emit({ type: "reset_text" });
        const args = item.arguments ?? item.input ?? {};
        emit({ type: "tool", call: `${item.tool ?? item.name ?? "tool"}(${Object.entries(typeof args === "string" ? safe(args) : args).map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ")})` });
      } else if (j.type === "item.completed" && (item.type === "agent_message" || item.type === "assistant_message")) {
        answered = true;
        emit({ type: "text", text: item.text ?? "" });
      } else if (j.type === "turn.completed" && j.usage) {
        emit({ type: "usage", input: j.usage.input_tokens ?? 0, output: j.usage.output_tokens ?? 0 });
      } else if (j.type === "error") {
        // Codex reports transient problems ("Reconnecting... 2/5") as error events; only remember the last one
        if (!/^Reconnecting/i.test(String(j.message ?? ""))) lastError = String(j.message ?? "error");
      } else if (j.type === "turn.failed" && !failed) {
        fail(String(j.error?.message ?? j.message ?? lastError ?? "turn failed"));
      }
    },
    /** Called when the process exits: report a remembered error if no answer came. */
    finish() { if (!failed && !answered && lastError) fail(lastError); },
    get failed() { return failed; },
  };
}
const safe = (s) => { try { return JSON.parse(s); } catch { return {}; } };
