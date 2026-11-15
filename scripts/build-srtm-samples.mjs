// Regenera data/samples/srtm-eje-cafetero.json leyendo altitud y pendiente de tiles SRTM (.hgt) ya descargados.
// Uso:  node scripts/build-srtm-samples.mjs <carpeta-con-tiles> [--source=lpdaac|aws] [--out=<archivo.json>]
//   --source  de dónde salieron los tiles; define la nota de fuente que se escribe (por defecto lpdaac, el producto oficial de NASA).
//   --out     archivo de salida (por defecto data/samples/srtm-eje-cafetero.json).
// Requiere Node 22.18 o superior (importa el módulo TypeScript src/lib/srtm.ts directamente).
// Los tiles se descargan aparte (ver docs/srtm-samples.md); este script no usa la red.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { meanElevationAt, parseHgt, slopePercentAt } from "../src/lib/srtm.ts";

/** Radio de la ventana (en celdas de ~30 m) que se promedia alrededor de cada punto: 3 celdas = ventana de 7×7, ~210 m. */
const SAMPLE_RADIUS_CELLS = 3;
const SAMPLES_FILE = new URL("../data/samples/srtm-eje-cafetero.json", import.meta.url);
const WINDOW_NOTE = "Altitud: promedio de una ventana de 7×7 celdas (~210 m) alrededor del punto. Pendiente: promedio del método de Horn en esa ventana. Es el valor del punto, no de todo el lote.";
const SOURCES = {
  lpdaac: (tile, size) => `Leído del tile ${tile} del producto oficial NASA SRTMGL1 versión 003 (NASA/USGS, LP DAAC; ${size}×${size} celdas, ~30 m). ${WINDOW_NOTE}`,
  aws: (tile, size) => `Leído del tile SRTM ${tile} (${size}×${size} celdas, ~30 m) de los tiles públicos de AWS Open Data (elevation-tiles-prod/skadi), que en Colombia se arman con SRTM y se rellenan con GMTED/ETOPO1; no es el producto oficial SRTMGL1 v003 de LP DAAC. ${WINDOW_NOTE}`,
};

function tileName(lat, lon) {
  const south = Math.floor(lat);
  const west = Math.floor(lon);
  const latPart = `${south >= 0 ? "N" : "S"}${String(Math.abs(south)).padStart(2, "0")}`;
  const lonPart = `${west >= 0 ? "E" : "W"}${String(Math.abs(west)).padStart(3, "0")}`;
  return { name: `${latPart}${lonPart}`, south, west };
}

function loadTile(directory, lat, lon) {
  const { name, south, west } = tileName(lat, lon);
  const plain = path.join(directory, `${name}.hgt`);
  const zipped = `${plain}.gz`;
  if (existsSync(plain)) return { name, tile: parseHgt(new Uint8Array(readFileSync(plain)), south, west) };
  if (existsSync(zipped)) return { name, tile: parseHgt(new Uint8Array(gunzipSync(readFileSync(zipped))), south, west) };
  throw new Error(`Falta el tile ${name}: pon ${name}.hgt o ${name}.hgt.gz en ${directory}`);
}

function option(name, fallback) {
  const found = process.argv.slice(3).find((argument) => argument.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
}

const directory = process.argv[2];
if (!directory) {
  console.error("Uso: node scripts/build-srtm-samples.mjs <carpeta-con-tiles>");
  process.exit(1);
}

const sourceKey = option("source", "lpdaac");
if (!(sourceKey in SOURCES)) {
  console.error(`--source debe ser lpdaac o aws (recibido: ${sourceKey})`);
  process.exit(1);
}
const outFile = option("out", null);
const samples = JSON.parse(readFileSync(SAMPLES_FILE, "utf8"));
const updated = samples.map((sample) => {
  const { name, tile } = loadTile(directory, sample.lat, sample.lon);
  const elevation = meanElevationAt(tile, sample.lat, sample.lon, SAMPLE_RADIUS_CELLS);
  const slope = slopePercentAt(tile, sample.lat, sample.lon, SAMPLE_RADIUS_CELLS);
  if (elevation === null || slope === null) throw new Error(`No se pudo leer altitud o pendiente de ${sample.id} en ${name}`);
  const next = { ...sample, elevationMeters: Math.round(elevation), slopePercent: Math.round(slope), source: SOURCES[sourceKey](name, tile.size) };
  console.log(`${sample.id}: altitud ${sample.elevationMeters} → ${next.elevationMeters} m; pendiente ${sample.slopePercent} → ${next.slopePercent} %  (${name})`);
  return next;
});
writeFileSync(outFile ?? SAMPLES_FILE, `${JSON.stringify(updated, null, 2)}\n`);
console.log(`Escrito ${updated.length} puntos en ${outFile ?? "data/samples/srtm-eje-cafetero.json"}`);
