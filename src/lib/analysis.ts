import type { AnalysisResponse, ClimateResult, Crop, Rotation, UserPriorities } from "../types";
import { DEFAULT_CURRENT_CROP_ID, SOWING_CALENDAR_REGION } from "./config";
import { aggregateMonthly, computeIndicators, countYears } from "./indicators";
import { scoreRotations } from "./scoring";
import { computeSeasonality } from "./seasonality";

/** Error causado por datos de entrada inválidos (el cliente puede corregirlos), a diferencia de un fallo interno. */
export class AnalysisInputError extends Error {}

/** Alternativas fijas de la versión inicial (CONTEXT.md §8); la línea base depende del cultivo actual. */
const ALTERNATIVE_ROTATIONS: readonly Rotation[] = [
  { id: "legume", name: "Maíz → fríjol → maíz", cropIds: ["maiz", "frijol"], description: "Intercala una leguminosa fijadora de nitrógeno para diversificar ingresos y aportar al suelo." },
  { id: "cover-drought", name: "Cobertura + cultivo tolerante a sequía", cropIds: ["mucuna", "yuca"], description: "Usa abono verde como cobertura y un cultivo de raíz resistente para proteger el suelo y el agua." },
];

/**
 * Arma las rotaciones a comparar: la línea base (el cultivo actual declarado, o `DEFAULT_CURRENT_CROP_ID`) y las alternativas.
 * Lanza `AnalysisInputError` si el cultivo actual no está en el catálogo.
 */
export function buildRotations(crops: readonly Crop[], currentCropId: string | undefined): Rotation[] {
  const cropId = currentCropId ?? DEFAULT_CURRENT_CROP_ID;
  const current = crops.find((crop) => crop.id === cropId);
  if (!current) throw new AnalysisInputError(`El cultivo actual "${cropId}" no existe en el catálogo`);
  const baseline: Rotation = { id: "baseline", name: `Actual: ${current.name}`, cropIds: [current.id], description: "Mantiene la práctica declarada como línea base de comparación." };
  return [baseline, ...ALTERNATIVE_ROTATIONS];
}

export type AnalysisInput = { climate: ClimateResult; crops: readonly Crop[]; priorities: UserPriorities; location: { lat: number; lon: number } };

/** ¿Cae el sitio dentro de la zona donde vale el calendario de siembra del catálogo (Eje Cafetero)? */
export function isInSowingCalendarRegion(lat: number, lon: number): boolean {
  const { minLat, maxLat, minLon, maxLon } = SOWING_CALENDAR_REGION;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

/**
 * Convierte el clima diario de NASA POWER en el análisis completo: resumen mensual, indicadores y rotaciones puntuadas.
 * La ubicación sirve para tres cosas: estimar la evaporación potencial (depende de la latitud), decidir si aplica el
 * calendario de siembra del catálogo (solo en el Eje Cafetero) y pasar los conteos de días a días por año.
 * Es pura (sin red ni archivos). Lanza `AnalysisInputError` si no hay registros o si el cultivo actual es desconocido.
 */
export function buildAnalysis({ climate, crops, priorities, location }: AnalysisInput): AnalysisResponse {
  if (climate.records.length === 0) throw new AnalysisInputError("No hay datos climáticos para analizar");
  const rotations = buildRotations(crops, priorities.currentCropId);
  const indicators = computeIndicators(climate.records, location.lat);
  const monthlyClimate = aggregateMonthly(climate.records, location.lat);
  const seasonality = isInSowingCalendarRegion(location.lat, location.lon) ? computeSeasonality(monthlyClimate) : undefined;
  const yearsAnalyzed = countYears(climate.records);
  return { climate, monthlyClimate, indicators, rotations: scoreRotations({ rotations, crops, indicators, priorities, seasonality, yearsAnalyzed }) };
}
