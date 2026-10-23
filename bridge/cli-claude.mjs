// Claude Code CLI adapter: `claude -p` with built-in tools disabled, only the evias MCP server, our system prompt.
// Turns its stream-json output into bridge events: text | reset_text | tool | usage | error.
export function claudeArgs({ systemFile, mcpFile, model }) {
  return [
    "-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages",
    "--system-prompt-file", systemFile,
    "--tools", "",                       // no built-in tools (no shell, files, web)
    "--strict-mcp-config", "--mcp-config", mcpFile, "--allowedTools", "mcp__evias",
    "--permission-mode", "dontAsk",      // anything not pre-approved is denied, never prompts
    "--setting-sources", "local",        // ignore the user's settings/hooks (temp dir has no local settings)
    "--no-session-persistence", "--disable-slash-commands",
    ...(model ? ["--model", model] : []),
  ];
}

const toolName = (n) => String(n ?? "").replace(/^mcp__evias__/, "");

export function claudeParser(emit) {
  let sawDelta = false;
  let failed = false;
  return {
    line(raw) {
      let j; try { j = JSON.parse(raw); } catch { return; }
      if (j.type === "stream_event" && j.event?.type === "content_block_delta" && j.event.delta?.type === "text_delta") { sawDelta = true; emit({ type: "text", text: j.event.delta.text }); }
      else if (j.type === "assistant") {
        if (j.is_api_error_message || j.error) {
          failed = true;
          const text = j.message?.content?.map((c) => c.text ?? "").join(" ") ?? "";
          const auth = j.error === "authentication_failed" || j.api_error_status === 401 || /log ?in|auth|api key/i.test(text);
          emit({ type: "error", code: auth ? "cli_not_logged_in" : j.api_error_status === 429 ? "rate_limited" : "cli_failed", message: text.slice(0, 300) });
          return;
        }
        const uses = (j.message?.content ?? []).filter((c) => c.type === "tool_use");
        if (uses.length) {
          emit({ type: "reset_text" });
          for (const u of uses) emit({ type: "tool", call: `${toolName(u.name)}(${Object.entries(u.input ?? {}).map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ")})` });
        } else if (!sawDelta) {
          const text = (j.message?.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
          if (text) emit({ type: "text", text });
        }
        if (j.message?.usage) emit({ type: "usage", input: j.message.usage.input_tokens ?? 0, output: j.message.usage.output_tokens ?? 0 });
      } else if (j.type === "result" && j.is_error && !failed) {
        failed = true;
        emit({ type: "error", code: /log ?in|auth/i.test(j.result ?? "") ? "cli_not_logged_in" : "cli_failed", message: String(j.result ?? j.subtype ?? "error").slice(0, 300) });
      }
    },
    get failed() { return failed; },
  };
}
