#!/usr/bin/env node
// Bundles src/agent/tools.ts (+ src/lib/metrics.ts) for Node so the bridge's MCP server runs the SAME tool code as the browser.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await build({
  entryPoints: [join(root, "src/agent/tools.ts")],
  outfile: join(root, "bridge/dist/tools.mjs"),
  bundle: true, platform: "node", format: "esm", target: "node20", logLevel: "warning",
});
console.log("bridge tools bundled → bridge/dist/tools.mjs");
