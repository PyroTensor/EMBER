// Copy contract examples + the domain parity fixture into src/mocks/fixtures/ and derive the
// mock datasets the MSW handlers read. Run with `npm run sync:contracts`.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contracts = resolve(here, "../../contracts");
const examplesDir = resolve(contracts, "examples");
const parityFile = resolve(contracts, "fixtures/domain_parity.json");
const outDir = resolve(here, "../src/mocks/fixtures");

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (name, data) => {
  writeFileSync(resolve(outDir, name), JSON.stringify(data, null, 2) + "\n");
  console.log(`[sync:contracts] wrote ${name}`);
};

mkdirSync(outDir, { recursive: true });

// 1. Verbatim copies.
const exampleFiles = readdirSync(examplesDir).filter((f) => f.endsWith(".json"));
for (const file of exampleFiles) {
  copyFileSync(resolve(examplesDir, file), resolve(outDir, file));
  console.log(`[sync:contracts] copied examples/${file}`);
}
copyFileSync(parityFile, resolve(outDir, "domain_parity.json"));
console.log("[sync:contracts] copied fixtures/domain_parity.json");

// 2. Derived datasets.
const parity = readJson(parityFile);
if (!Array.isArray(parity.runs)) throw new Error("domain_parity.json has no 'runs' array");
writeJson("experiments.json", parity.runs);

writeJson("presets.json", readJson(resolve(examplesDir, "presets.json")));

const telemetry = {};
for (const file of exampleFiles.filter((f) => f.startsWith("telemetry_"))) {
  const series = readJson(resolve(examplesDir, file));
  if (!series.experiment_id) throw new Error(`${file} has no experiment_id`);
  telemetry[series.experiment_id] = series;
}
writeJson("telemetry.json", telemetry);
