// Regenera las muestras de respaldo data/samples/power-*.json con series diarias reales de NASA POWER.
// Uso:  node scripts/build-power-samples.mjs [--start=2011] [--end=2025] [--out-dir=data/samples]
// Las muestras son la respuesta cruda de la API (la misma que lee src/lib/nasaPower.ts) y sirven de respaldo si NASA POWER no responde.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Debe coincidir con CLIMATE_PARAMETERS de src/types/index.ts.
const PARAMETERS = ["T2M", "T2M_MIN", "T2M_MAX", "PRECTOTCORR", "EVLAND", "GWETROOT", "ALLSKY_SFC_SW_DWN"];
const SITES = [
  { file: "power-pereira.json", lat: 4.8133, lon: -75.6961 },
  { file: "power-manizales.json", lat: 5.0689, lon: -75.5174 },
  { file: "power-armenia.json", lat: 4.5339, lon: -75.6811 },
];
const BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";

function option(name, fallback) {
  const found = process.argv.slice(2).find((argument) => argument.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
}

const startYear = Number(option("start", "2011"));
const endYear = Number(option("end", String(new Date().getFullYear() - 1)));
const outDir = option("out-dir", "data/samples");
if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) {
  console.error("--start y --end deben ser años enteros con start <= end");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

for (const site of SITES) {
  const params = new URLSearchParams({ parameters: PARAMETERS.join(","), community: "AG", latitude: String(site.lat), longitude: String(site.lon), start: `${startYear}0101`, end: `${endYear}1231`, format: "JSON" });
  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}?${params}`);
  if (!response.ok) throw new Error(`NASA POWER respondió HTTP ${response.status} para ${site.file}`);
  const payload = await response.json();
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const series = payload?.properties?.parameter;
  for (const name of PARAMETERS) if (!series?.[name]) throw new Error(`Falta el parámetro ${name} en ${site.file}`);
  const dates = Object.keys(series.T2M).sort();
  const missing = Object.fromEntries(PARAMETERS.map((name) => [name, Object.values(series[name]).filter((value) => value === -999).length]));
  writeFileSync(path.join(outDir, site.file), JSON.stringify(payload));
  console.log(`${site.file}: ${dates.length} días (${dates[0]} a ${dates.at(-1)}) en ${seconds} s; faltantes -999: ${JSON.stringify(missing)}`);
}
