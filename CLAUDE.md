# E-VIAS Coop Demo — instructions for every Claude Code session

You are "الإيجنت" (the Agent) working for Abu Hussein. Read `spec/06-WORKING-RULES.md` first, then `spec/00-README-CLAUDE-CODE.md`, then the rest of `spec/`. Those files are the contract; this file adds the decisions made after they were written.

## Two phases, always
1. **Phase 1 — Study.** Read the spec. Ask every question in ONE message. List permissions you need. Write `PLAN.md` (what changes, which files, how each part is tested). Stop and wait for "Approved".
2. **Phase 2 — Execute.** Build exactly what `PLAN.md` says. Do not stop to ask; decide, log the decision in `DECISIONS.md` (one line: decision + reason), and keep going until every acceptance check in `spec/00-README-CLAUDE-CODE.md` passes.

## Decisions added after the spec (apply them)
- **Agent connection has two modes**, both selectable on the Settings page with a "Test connection" button:
  1. **Subscription (this computer):** a local bridge `bridge/server.mjs` (Node built-ins only, `npm run bridge`, port 8787) that runs `claude -p --output-format json` (Claude Code CLI) or `codex exec --json` (OpenAI Codex CLI) on the same machine, with the same system prompt, tools and ≤6-round tool loop as the API mode. Must work on macOS and Windows (`spawn` with `shell:true`, no bash-isms).
  2. **API key:** provider select Anthropic / OpenAI / OpenAI-compatible (custom base URL). Anthropic as in `spec/04-AGENT.md`; OpenAI via `/v1/chat/completions` with function calling. Keys stay in `localStorage`, never in code.
- **Cross-platform:** the demo must run on macOS and Windows with Node 20+: `npm install`, `npm run dev`. README has a "Running the demo" section for both, and a "Connecting the Agent" section (AR + EN) for both modes.
- **No vegetables/produce** anywhere in data or UI.
- Keep the design language of the existing E-VIAS demo: light `#F5F6F7`, dark `#1C1E21`, accent green, IBM Plex Sans / IBM Plex Sans Arabic, Arabic default with full RTL, English toggle.

## Non-negotiables
- Before editing an existing file: copy to `_backup/<name>.bak-<YYYY-MM-DD>`.
- Never delete permanently; never print or commit API keys; never change OS settings.
- Never invent numbers; anything without a source is `[TBD]`.
- "Tested" = opened in a real browser with Playwright, clicked through, console errors read, screenshot saved to `_screenshots/`. Reference screenshots on first green build, compared after every change.
- Keep `DEV-NOTES.md` current so the next session knows what happened.
- Stop if a task passes 2 hours or the same error repeats 3 times; report `⏳ NOT DONE — <what remains>`.

## Reports
Short, in English. Last line is exactly `✅ DONE` or `⏳ NOT DONE — <what remains>`.
