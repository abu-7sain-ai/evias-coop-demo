#!/usr/bin/env node
// Fails if: ar/en key sets differ; a static t("key") is missing; a component has literal Arabic or English UI text;
// layout uses physical ml-/mr-/pl-/pr- classes instead of logical ms-/me-/ps-/pe-.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ar = JSON.parse(readFileSync("src/i18n/ar.json", "utf8"));
const en = JSON.parse(readFileSync("src/i18n/en.json", "utf8"));
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const A = new Set(flat(ar)), E = new Set(flat(en));
const problems = [];
for (const k of A) if (!E.has(k)) problems.push(`en.json missing ${k}`);
for (const k of E) if (!A.has(k)) problems.push(`ar.json missing ${k}`);
if (ar.scenarios.length !== en.scenarios.length) problems.push("scenarios length differs");

const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
walk("src");
const has = (k) => E.has(k) || [...E].some((x) => x.startsWith(k + "."));
for (const f of files) {
  const src = readFileSync(f, "utf8");
  if (f.endsWith("prompt.ts")) continue; // the spec's system prompt is model-facing, not UI text
  for (const m of src.matchAll(/\bt\(\s*"([^"]+)"/g)) if (!has(m[1])) problems.push(`${f}: unknown key "${m[1]}"`);
  // Arabic letters in code (UI text must come from the strings files). Language-switch labels "العربية"/"English" are the only exceptions.
  for (const [i, line] of src.split("\n").entries()) {
    const cleaned = line.replace(/"العربية"|"English"|>English<|>العربية</g, "").replace(/\/\/.*$/, "");
    if (/[؀-ۿ]/.test(cleaned)) problems.push(`${f}:${i + 1}: Arabic literal`);
  }
  if (f.endsWith(".tsx")) {
    // JSX text nodes containing words: >Some words<
    for (const m of src.matchAll(/(?<![=])>\s*([A-Za-z][A-Za-z ,.'!?-]{2,})\s*</g)) {
      // brand name, the language-switch label and shell commands are not translated
      if (!/^(English|E-VIAS|npm run demo)$/.test(m[1].trim())) problems.push(`${f}: literal JSX text "${m[1].trim()}"`);
    }
    for (const m of src.matchAll(/className=[{"`][^"`}]*\b(ml|mr|pl|pr)-\d/g)) problems.push(`${f}: physical margin/padding class ${m[1]}- (use ms-/me-/ps-/pe-)`);
    for (const m of src.matchAll(/(?:placeholder|title|aria-label|label)="([A-Za-z][^"]{2,})"/g)) problems.push(`${f}: literal attribute text "${m[1]}"`);
  }
}
if (problems.length) { console.log(problems.join("\n")); console.log(`\n${problems.length} i18n problem(s)`); process.exit(1); }
console.log(`i18n OK — ${A.size} keys in both languages, ${files.length} source files clean`);
