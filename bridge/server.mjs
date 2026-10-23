#!/usr/bin/env node
// E-VIAS local bridge — subscription mode. Listens on 127.0.0.1 only.
//   GET  /            → the built demo (dist/)
//   GET  /health      → which CLIs are installed
//   POST /agent       → runs one question through the Claude Code CLI or Codex CLI, streams SSE events back
// The CLI answers through the evias MCP server (bridge/mcp-tools.mjs) = the same 22 tools the browser uses.
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import spawn from "cross-spawn";
import { claudeArgs, claudeParser } from "./cli-claude.mjs";
import { codexArgs, codexParser } from "./cli-codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.EVIAS_PORT || 5317);
const HOST = "127.0.0.1";
const TIMEOUT_MS = Number(process.env.EVIAS_TIMEOUT_MS || 240000);
const CLI_BIN = { claude: process.env.EVIAS_CLAUDE_BIN || "claude", codex: process.env.EVIAS_CODEX_BIN || "codex" };
const VERSION = "1.0.0";
const dataDir = () => (existsSync(join(DIST, "data", "meta.json")) ? join(DIST, "data") : join(ROOT, "public", "data"));

// ---- security: only this computer, only pages served from localhost (blocks other websites and DNS rebinding)
const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;
const okHost = (req) => LOCAL.test(req.headers.host ?? "");
const okOrigin = (origin) => !origin || /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(origin);
const cors = (req, res) => { const o = req.headers.origin; if (o && okOrigin(o)) { res.setHeader("access-control-allow-origin", o); res.setHeader("vary", "origin"); } };

// A CLI given as a .js/.mjs path (used by the CI smoke test's fake CLI) runs through this Node.
const launch = (bin, args, opts) => (/\.m?js$/i.test(bin) ? spawn(process.execPath, [resolve(ROOT, bin), ...args], opts) : spawn(bin, args, opts));

// ---- CLI detection (cached 30 s)
let healthCache = { at: 0, value: null };
const runVersion = (bin) => new Promise((resolve) => {
  try {
    const p = launch(bin, ["--version"], { windowsHide: true });
    let out = ""; const t = setTimeout(() => { p.kill(); resolve({ found: false }); }, 8000);
    p.stdout?.on("data", (b) => (out += b)); p.on("error", () => { clearTimeout(t); resolve({ found: false }); });
    p.on("close", (code) => { clearTimeout(t); resolve(code === 0 ? { found: true, version: (out.match(/\d+\.\d+\.\d+/) ?? [out.trim()])[0] } : { found: false }); });
  } catch { resolve({ found: false }); }
});
async function health() {
  if (Date.now() - healthCache.at < 30000 && healthCache.value) return healthCache.value;
  const [claude, codex] = await Promise.all([runVersion(CLI_BIN.claude), runVersion(CLI_BIN.codex)]);
  healthCache = { at: Date.now(), value: { version: VERSION, clis: { claude, codex }, data: existsSync(join(dataDir(), "meta.json")), platform: process.platform } };
  return healthCache.value;
}

// ---- static files
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".ico": "image/x-icon" };
function serveStatic(req, res) {
  if (!existsSync(join(DIST, "index.html"))) { res.writeHead(503, { "content-type": "text/plain; charset=utf-8" }); return res.end("dist/ not built yet — run: npm run build"); }
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = normalize(join(DIST, url === "/" ? "index.html" : url));
  if (!file.startsWith(DIST + sep) && file !== join(DIST, "index.html")) { res.writeHead(403); return res.end(); }
  const target = existsSync(file) && statSync(file).isFile() ? file : join(DIST, "index.html");
  res.writeHead(200, { "content-type": MIME[extname(target)] ?? "application/octet-stream", "cache-control": target.endsWith("index.html") ? "no-cache" : "max-age=3600" });
  res.end(readFileSync(target));
}

// ---- one question → one CLI process
const transcript = (history, question) => {
  const turns = (history ?? []).slice(-12).map((h) => `${h.role === "user" ? "User" : "Agent"}: ${h.content}`).join("\n\n");
  return turns ? `Conversation so far:\n\n${turns}\n\nNew question (answer this one):\n${question}` : question;
};
function killTree(p) {
  if (!p || p.exitCode != null) return;
  if (process.platform === "win32") spawn("taskkill", ["/pid", String(p.pid), "/T", "/F"], { windowsHide: true });
  else p.kill("SIGTERM");
}

async function runAgent(req, res, body) {
  const send = (e) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", connection: "keep-alive" });
  const cli = body.cli === "codex" ? "codex" : "claude";
  const h = await health();
  if (!h.clis[cli].found) { send({ type: "error", code: "cli_missing", message: CLI_BIN[cli] }); send({ type: "done" }); return res.end(); }
  if (typeof body.question !== "string" || !body.question.trim() || typeof body.system !== "string") { send({ type: "error", code: "cli_failed", message: "bad request" }); send({ type: "done" }); return res.end(); }

  const work = mkdtempSync(join(tmpdir(), "evias-"));
  const mcpScript = join(here, "mcp-tools.mjs");
  const data = dataDir();
  let args;
  if (cli === "claude") {
    const systemFile = join(work, "system.txt"); writeFileSync(systemFile, body.system, "utf8");
    const mcpFile = join(work, "mcp.json");
    writeFileSync(mcpFile, JSON.stringify({ mcpServers: { evias: { command: process.execPath, args: [mcpScript], env: { EVIAS_DATA_DIR: data } } } }), "utf8");
    args = claudeArgs({ systemFile, mcpFile, model: body.model });
  } else {
    args = codexArgs({ system: body.system, mcpCommand: process.execPath, mcpArgs: [mcpScript], dataDir: data, cwd: work, model: body.model });
  }
  const parser = (cli === "claude" ? claudeParser : codexParser)(send);
  let stderr = "";
  const p = launch(CLI_BIN[cli], args, { cwd: work, windowsHide: true, env: { ...process.env, EVIAS_DATA_DIR: data } });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; send({ type: "error", code: "cli_failed", message: `timeout ${TIMEOUT_MS / 1000}s` }); killTree(p); }, TIMEOUT_MS);
  res.on("close", () => killTree(p));   // browser pressed Stop or closed the tab
  let buf = "";
  p.stdout.setEncoding("utf8");
  p.stdout.on("data", (chunk) => { buf += chunk; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) parser.line(line); } });
  p.stderr.on("data", (b) => { stderr = (stderr + b).slice(-2000); });
  p.on("error", (e) => { if (!parser.failed) send({ type: "error", code: "cli_failed", message: e.message }); });
  p.on("close", (code) => {
    clearTimeout(timer);
    if (buf.trim()) parser.line(buf.trim());
    if (!timedOut) parser.finish?.();
    if (code !== 0 && !timedOut && !parser.failed && !res.writableEnded) {
      const msg = stderr.trim() || `exit code ${code}`;
      send({ type: "error", code: /log ?in|auth|401|unauthori[sz]ed/i.test(msg) ? "cli_not_logged_in" : "cli_failed", message: msg.slice(-300) });
    }
    if (!res.writableEnded) { send({ type: "done" }); res.end(); }
    try { rmSync(work, { recursive: true, force: true }); } catch { /* temp dir, best effort */ }
  });
  p.stdin.end(transcript(body.history, body.question), "utf8");
}

const server = createServer((req, res) => {
  if (!okHost(req) || !okOrigin(req.headers.origin)) { res.writeHead(403, { "content-type": "text/plain" }); return res.end("forbidden: local use only"); }
  cors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-methods": "GET,POST", "access-control-allow-headers": "content-type", "access-control-max-age": "600" }); return res.end(); }
  const path = new URL(req.url, "http://x").pathname;
  if (req.method === "GET" && path === "/health") return void health().then((h) => { res.writeHead(200, { "content-type": "application/json", "cache-control": "no-cache" }); res.end(JSON.stringify(h)); });
  if (req.method === "POST" && path === "/agent") {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on("end", () => { let body; try { body = JSON.parse(raw); } catch { res.writeHead(400); return res.end("bad json"); } runAgent(req, res, body).catch((e) => { try { res.end(`data: ${JSON.stringify({ type: "error", code: "cli_failed", message: String(e?.message ?? e) })}\n\n`); } catch { /* closed */ } }); });
    return;
  }
  if (req.method === "GET") return serveStatic(req, res);
  res.writeHead(405); res.end();
});

server.on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? `Port ${PORT} is busy — the demo may already be running: http://${HOST}:${PORT}  (or set EVIAS_PORT)` : e.message);
  process.exit(1);
});
server.listen(PORT, HOST, () => {
  console.log(`E-VIAS bridge on http://${HOST}:${PORT}  (data: ${dataDir()})`);
  if (process.send) process.send({ ready: true, port: PORT });
});
