import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_FILES, type Data } from "../../src/lib/types";

export function loadData(dir = join(process.cwd(), "public", "data")): Data {
  return Object.fromEntries(DATA_FILES.map((f) => [f, JSON.parse(readFileSync(join(dir, `${f}.json`), "utf8"))])) as unknown as Data;
}
