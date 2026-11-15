import { NextResponse } from "next/server";
import { AnalysisInputError, buildAnalysis } from "../../../lib/analysis";
import { resolveAnalysisSite } from "../../../lib/analysisSite";
import { CROPS } from "../../../lib/catalog";
import { fetchDailyClimate, fetchRecentClimate, InvalidClimateRequestError } from "../../../lib/nasaPower";
import { fetchLiveTerrain } from "../../../lib/terrainLive";
import { analysisRequestSchema, type ClimateResult } from "../../../types";

const RECENT_CLIMATE_GAP = "No se pudo consultar el clima de los últimos días: no se muestra cómo va la temporada actual frente a lo normal.";
const LIVE_TERRAIN_GAP = "No se pudo medir la altitud y la pendiente del lote en vivo con NASA SRTM: se usa el punto piloto más cercano si lo hay y, si no, no se ajusta la temperatura por altitud ni se evalúa la ladera.";

/** El clima reciente es un extra: si NASA POWER no responde, el análisis sigue sin él. */
async function fetchRecentOrNull(location: { lat: number; lon: number }): Promise<ClimateResult | null> {
  try { return await fetchRecentClimate(location); } catch { return null; }
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "El cuerpo debe ser JSON válido" }, { status: 400 }); }
  const parsed = analysisRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  const { priorities, startYear, endYear, scenario, includeDailyRecords } = parsed.data;
  const site = resolveAnalysisSite(parsed.data);
  if (!site.valid) return NextResponse.json({ error: site.errors.join(" ") }, { status: 400 });
  try {
    // Primero la serie larga: valida el rango antes de hacer cualquier petición; los últimos días se piden en paralelo.
    const climateRequest = fetchDailyClimate({ ...site.location, startYear, endYear });
    const recentRequest = fetchRecentOrNull(site.location);
    // Si el agricultor ya declaró altitud y pendiente no hace falta medirlas; la medición nunca lanza error (devuelve null).
    const needsTerrain = priorities.elevationMeters === undefined || priorities.slopePercent === undefined;
    const farmTerrain = parsed.data.farm?.terrain;
    const terrainRequest = needsTerrain ? fetchLiveTerrain({ ...site.location, ...(farmTerrain?.kind === "polygon" ? { ring: farmTerrain.ring } : {}) }) : Promise.resolve(null);
    const climate = await climateRequest;
    const recent = await recentRequest;
    const liveTerrain = await terrainRequest;
    const siteGaps = [...site.informationGaps, ...(recent ? [] : [RECENT_CLIMATE_GAP]), ...(needsTerrain && !liveTerrain ? [LIVE_TERRAIN_GAP] : [])];
    return NextResponse.json(buildAnalysis({ climate, crops: CROPS, priorities, location: site.location, siteGaps, scenario, includeDailyRecords, ...(recent ? { recentClimate: recent } : {}), liveTerrain, requestedYears: endYear - startYear + 1 }));
  } catch (error) {
    if (error instanceof AnalysisInputError || error instanceof InvalidClimateRequestError) return NextResponse.json({ error: error.message }, { status: 400 });
    const message = error instanceof Error ? error.message : "No fue posible completar el análisis";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
