#!/usr/bin/env node
// Cross-platform smoke test (CI on macOS + Windows): start the real bridge with a fake CLI, check it serves the app,
// reports the CLI, and answers one question end-to-end through the real MCP tool server.
import { fork } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5393;
const base = `http://127.0.0.1:${PORT}`;
const child = fork(join(root, "bridge", "server.mjs"), [], { env: { ...process.env, EVIAS_PORT: String(PORT), EVIAS_CLAUDE_BIN: "tests/fixtures/fake-claude.mjs", EVIAS_CODEX_BIN: "codex-not-installed-smoke" }, stdio: "inherit" });
const fail = (m) => { console.error(`SMOKE FAIL: ${m}`); child.kill(); process.exit(1); };
await new Promise((res, rej) => { child.on("message", (m) => m?.ready && res()); child.on("exit", (c) => rej(new Error(`bridge exited ${c}`))); setTimeout(() => rej(new Error("bridge start timeout")), 20000); }).catch((e) => fail(e.message));

const index = await fetch(`${base}/`); const html = await index.text();
if (!index.ok || !html.includes('id="root"')) fail("index.html not served");
const h = await (await fetch(`${base}/health`)).json();
if (!h.clis.claude.found || h.clis.claude.version !== "9.9.9" || h.clis.codex.found || !h.data) fail(`health ${JSON.stringify(h)}`);
const evil = await fetch(`${base}/health`, { headers: { origin: "https://example.com" } });
if (evil.status !== 403) fail("foreign origin not blocked");
const r = await fetch(`${base}/agent`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cli: "claude", system: "أنت الوكيل", history: [], question: "منو متأخر بالإيجار؟" }) });
const text = await r.text();
if (!text.includes("FAKE-CLI M-07 45 prompt-ok single") || !text.includes("rent_arrears(coop_id=C1)") || !text.includes('"type":"done"')) fail(`agent stream:\n${text}`);
const missing = await (await fetch(`${base}/agent`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cli: "codex", system: "x", question: "q" }) })).text();
if (!missing.includes("cli_missing")) fail("codex missing not reported");
console.log(`SMOKE OK on ${process.platform} — app served, CLI detected, question answered through MCP tools`);
child.kill();
process.exit(0);
