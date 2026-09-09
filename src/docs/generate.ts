import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openApiDocument } from "./openapi.js";

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docs");
const outFile = path.join(outDir, "openapi.json");

await mkdir(outDir, { recursive: true });
await writeFile(outFile, `${JSON.stringify(openApiDocument, null, 2)}\n`, "utf8");
console.log(`已生成 Swagger 文档: ${outFile}`);
