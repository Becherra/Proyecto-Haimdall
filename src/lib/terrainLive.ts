import { z } from "zod";
import { createPromiseCache } from "./climateCache";
import { LIVE_TERRAIN } from "./config";
import { planTerrainGrid, summarizeTerrainGrid, type GridPlan, type LiveTerrain, type TerrainTarget } from "./terrainGrid";

// OpenTopoData sirve NASA SRTM (1 arc-segundo, ~30 m) sin clave. La instancia pública limita el uso; con OPENTOPODATA_URL se apunta a una propia.
const DEFAULT_BASE_URL = "https://api.opentopodata.org";
const DATASET = "srtm30m";
/** Los puntos a menos de ~11 m comparten consulta: la malla es de 30 m, esa diferencia no cambia la pendiente. */
const COORDINATE_DECIMALS = 4;

const targetSchema = z.object({ lat: z.number().finite().gte(-90).lte(90), lon: z.number().finite().gte(-180).lte(180) });
const responseSchema = z.object({ status: z.literal("OK"), results: z.array(z.object({ elevation: z.number().nullable() })) });

export type LiveTerrainDependencies = { fetcher?: typeof fetch; baseUrl?: string };

// Se guardan las altitudes crudas, que no dependen de qué celdas cuenten (lote o punto). Solo en este proceso.
const cache = createPromiseCache<Array<number | null>>({ maxEntries: LIVE_TERRAIN.cacheMaxEntries });

const round = (value: number) => value.toFixed(COORDINATE_DECIMALS);

async function requestElevations(plan: GridPlan, { fetcher = fetch, baseUrl = process.env.OPENTOPODATA_URL?.trim() || DEFAULT_BASE_URL }: LiveTerrainDependencies): Promise<Array<number | null>> {
  const locations = plan.locations.map(({ lat, lon }) => `${lat.toFixed(6)},${lon.toFixed(6)}`).join("|");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_TERRAIN.timeoutMs);
  try {
    const response = await fetcher(`${baseUrl.replace(/\/+$/, "")}/v1/${DATASET}?locations=${locations}`, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = responseSchema.parse(await response.json());
    if (parsed.results.length !== plan.locations.length) throw new Error("La respuesta no trae un resultado por punto");
    return parsed.results.map(({ elevation }) => elevation);
  } finally { clearTimeout(timeout); }
}

/**
 * Mide la altitud y la pendiente reales de un punto o de un lote con NASA SRTM (30 m) vía OpenTopoData. Una sola consulta de hasta 100 puntos.
 * Nunca lanza: si el servicio no responde, limita el uso o el sitio está fuera de la cobertura de SRTM (60° N a 56° S) devuelve null
 * y quien llama usa las muestras precargadas. Los fallos no se guardan, así que la siguiente consulta vuelve a intentar.
 */
export async function fetchLiveTerrain(target: TerrainTarget, dependencies: LiveTerrainDependencies = {}): Promise<LiveTerrain | null> {
  const parsed = targetSchema.safeParse(target);
  if (!parsed.success) return null;
  const rounded = { ...target, lat: Number(round(parsed.data.lat)), lon: Number(round(parsed.data.lon)) };
  const plan = planTerrainGrid(rounded);
  const key = plan.locations.map(({ lat, lon }) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join("|");
  try {
    let elevations = cache.get(key);
    if (!elevations) {
      const request = requestElevations(plan, dependencies);
      elevations = request;
      cache.set(key, request, LIVE_TERRAIN.cacheTtlMs);
      request.catch(() => cache.delete(key));
    }
    return summarizeTerrainGrid(await elevations, plan);
  } catch { return null; }
}

export function clearLiveTerrainCache(): void { cache.clear(); }
