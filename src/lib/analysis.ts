import type { AnalysisResponse, ClimateResult, Crop, Rotation, RotationResult, UserPriorities } from "../types";
import { DEFAULT_CURRENT_CROP_ID, SOWING_CALENDAR_REGION } from "./config";
import { aggregateMonthly, computeIndicators, countYears } from "./indicators";
import { baselineRotation, candidateRotations, pickBest } from "./rotations";
import { scoreRotations } from "./scoring";
import { computeSeasonality } from "./seasonality";

/** Error causado por datos de entrada inválidos (el cliente puede corregirlos), a diferencia de un fallo interno. */
export class AnalysisInputError extends Error {}

/** Busca el cultivo actual declarado (o `DEFAULT_CURRENT_CROP_ID`). Lanza `AnalysisInputError` si no está en el catálogo. */
export function resolveCurrentCrop(crops: readonly Crop[], currentCropId: string | undefined): Crop {
  const cropId = currentCropId ?? DEFAULT_CURRENT_CROP_ID;
  const current = crops.find((crop) => crop.id === cropId);
  if (!current) throw new AnalysisInputError(`El cultivo actual "${cropId}" no existe en el catálogo`);
  return current;
}

/** La mejor candidata de una estrategia según el puntaje; falla con un mensaje claro si el catálogo no dio ninguna. */
function bestOf(results: readonly RotationResult[], strategy: string): RotationResult {
  if (results.length === 0) throw new Error(`El catálogo no tiene cultivos suficientes para armar la alternativa de ${strategy}`);
  return pickBest(results);
}

export type AnalysisInput = { climate: ClimateResult; crops: readonly Crop[]; priorities: UserPriorities; location: { lat: number; lon: number } };

/** ¿Cae el sitio dentro de la zona donde vale el calendario de siembra del catálogo (Eje Cafetero)? */
export function isInSowingCalendarRegion(lat: number, lon: number): boolean {
  const { minLat, maxLat, minLon, maxLon } = SOWING_CALENDAR_REGION;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

/**
 * Convierte el clima diario de NASA POWER en el análisis completo: resumen mensual, indicadores y rotaciones puntuadas.
 * Compara la línea base (el cultivo actual solo) con dos alternativas armadas alrededor de ese cultivo; de cada alternativa
 * se puntúan todas las combinaciones del catálogo y se muestra la de mayor puntaje para el sitio y las prioridades.
 * La ubicación sirve para tres cosas: estimar la evaporación potencial (depende de la latitud), decidir si aplica el
 * calendario de siembra del catálogo (solo en el Eje Cafetero) y pasar los conteos de días a días por año.
 * Es pura (sin red ni archivos). Lanza `AnalysisInputError` si no hay registros o si el cultivo actual es desconocido.
 */
export function buildAnalysis({ climate, crops, priorities, location }: AnalysisInput): AnalysisResponse {
  if (climate.records.length === 0) throw new AnalysisInputError("No hay datos climáticos para analizar");
  const current = resolveCurrentCrop(crops, priorities.currentCropId);
  const indicators = computeIndicators(climate.records, location.lat);
  const monthlyClimate = aggregateMonthly(climate.records, location.lat);
  const seasonality = isInSowingCalendarRegion(location.lat, location.lon) ? computeSeasonality(monthlyClimate) : undefined;
  const yearsAnalyzed = countYears(climate.records);
  const score = (rotations: readonly Rotation[]) => scoreRotations({ rotations, crops, indicators, priorities, seasonality, yearsAnalyzed });
  const candidates = candidateRotations(crops, current);
  const rotations = [...score([baselineRotation(current)]), bestOf(score(candidates.legume), "leguminosa"), bestOf(score(candidates.coverDrought), "cobertura y sequía")];
  return { climate, monthlyClimate, indicators, rotations };
}
