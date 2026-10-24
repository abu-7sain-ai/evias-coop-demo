#!/usr/bin/env node
// MCP stdio server exposing the 22 demo tools to the Claude Code / Codex CLI. Started by the bridge, one per question.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFS, runTool } from "./dist/tools.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.EVIAS_DATA_DIR || join(here, "..", "dist", "data");
const FILES = ["coops", "branches", "products", "suppliers", "subsidized_prices", "floorplan", "traffic", "spaces", "tenants", "lease_contracts", "lease_invoices",
  "shelf_reservations", "lots", "stock_locations", "members", "employees", "attendance", "sales", "sale_items", "voids", "refunds", "shifts",
  "cash_movements", "daily_sales", "purchase_orders", "grns", "supplier_invoices", "supplier_deliveries", "complaints", "promotions", "writeoffs",
  "subsidized_breaches", "ramadan", "agent_alerts", "meta"];
const data = Object.fromEntries(FILES.map((f) => [f, JSON.parse(readFileSync(join(DATA_DIR, `${f}.json`), "utf8"))]));

const server = new Server({ name: "evias", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema })) }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const out = runTool(data, req.params.name, req.params.arguments ?? {});
  return { content: [{ type: "text", text: JSON.stringify(out) }], isError: !!(out && typeof out === "object" && "error" in out) };
});
await server.connect(new StdioServerTransport());
