#!/usr/bin/env node
// One command for macOS and Windows: build if needed, start the local bridge (which serves the app), open the browser.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import spawn from "cross-spawn";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.EVIAS_PORT || 5317);
const URL_ = `http://127.0.0.1:${PORT}/`;
// Windows consoles often garble Arabic, so print English only there (or when EVIAS_CONSOLE_LANG=en).
const ENGLISH_ONLY = process.platform === "win32" || process.env.EVIAS_CONSOLE_LANG === "en";
const say = (ar, en) => console.log(ENGLISH_ONLY ? `${en}\n` : `${ar}\n${en}\n`);

const [maj, min] = process.versions.node.split(".").map(Number);
if (maj < 20 || (maj === 20 && min < 19)) {
  say(`نسخة Node.js قديمة (${process.versions.node}). ثبّت نسخة 22 أو أحدث من https://nodejs.org`, `Node.js ${process.versions.node} is too old. Install version 22 or newer from https://nodejs.org`);
  process.exit(1);
}
const run = (cmd, args) => new Promise((res, rej) => spawn(cmd, args, { cwd: root, stdio: "inherit" }).on("close", (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${args.join(" ")} exited ${c}`)))));
const openBrowser = (url) => {
  if (process.env.EVIAS_NO_OPEN) return;
  const [cmd, args] = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).unref(); } catch { /* user can open the link manually */ }
};

try {
  const already = await fetch(`${URL_}health`, { signal: AbortSignal.timeout(1500) }).then((r) => r.ok).catch(() => false);
  if (already) { say("الديمو يعمل مسبقاً — جاري فتح المتصفح.", `The demo is already running — opening ${URL_}`); openBrowser(URL_); process.exit(0); }
  if (!existsSync(join(root, "node_modules"))) { say("تثبيت الحزم لأول مرة…", "Installing packages (first run)…"); await run("npm", ["install", "--no-audit", "--no-fund"]); }
  if (!existsSync(join(root, "dist", "index.html")) || !existsSync(join(root, "bridge", "dist", "tools.mjs"))) { say("تجهيز الديمو لأول مرة (دقيقة تقريباً)…", "Building the demo (first run, about a minute)…"); await run("npm", ["run", "build"]); }
  await import("../bridge/server.mjs");
  say(`الديمو جاهز: ${URL_}\nأبقِ هذه النافذة مفتوحة أثناء العرض. للإغلاق: Ctrl+C`, `Demo ready: ${URL_}\nKeep this window open during the presentation. To stop: Ctrl+C`);
  openBrowser(URL_);
} catch (e) {
  say("تعذّر تشغيل الديمو:", "Could not start the demo:");
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
