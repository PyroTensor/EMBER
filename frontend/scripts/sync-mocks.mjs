import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, "../../contracts/mock_data");
const destDir = resolve(__dirname, "../src/mock");

mkdirSync(destDir, { recursive: true });

const files = [
  "presets.json",
  "experiments_proxy.json",
  "telemetry_proxy.json",
];

for (const file of files) {
  const from = resolve(srcDir, file);
  const to = resolve(destDir, file);
  copyFileSync(from, to);
  console.log(`[sync-mocks] Copied ${file} -> src/mock/${file}`);
}
