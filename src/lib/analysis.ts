import type { AnalysisClimate, AnalysisResponse, ClimateResult, ClimateScenario, Crop, Rotation, RotationResult, UserPriorities } from "../types";
import { DEFAULT_CURRENT_CROP_ID, SOWING_CALENDAR_REGION } from "./config";
import { temperatureSuitability } from "./climateFit";
import { computeExtremeYears } from "./extremeYears";
import { listDataSources } from "./dataSources";
import { computeCurrentSeason } from "./currentSeason";
import { aggregateMonthly, computeIndicators, countYears } from "./indicators";
import { baselineRotation, candidateRotations, commonName, pickBest, startingRotations } from "./rotations";
import { applyScenario, isNeutralScenario, scenarioGap } from "./scenario";
import { scoreRotations } from "./scoring";
import { computeSeasonality } from "./seasonality";
import { adjustRecordsForElevation, resolveTerrain } from "./terrain";
import type { LiveTerrain } from "./terrainGrid";

/** Error causado por datos de entrada inválidos (el cliente puede corregirlos), a diferencia de un fallo interno. */
export class AnalysisInputError extends Error {}

/** Busca el cultivo actual declarado (o `DEFAULT_CURRENT_CROP_ID`). Lanza `AnalysisInputError` si no está en el catálogo. */
export function resolveCurrentCrop(crops: readonly Crop[], currentCropId: string | undefined): Crop {
  const cropId = currentCropId ?? DEFAULT_CURRENT_CROP_ID;
  const current = crops.find((crop) => crop.id === cropId);
  if (!current) throw new AnalysisInputError(`El cultivo actual "${cropId}" no existe en el catálogo`);
  return current;
}

/**
 * Cultivo con el que se compara cuando el agricultor no declara uno: el maíz (`DEFAULT_CURRENT_CROP_ID`) si encaja en la temperatura media del sitio.
 * Si el maíz no crece bien ahí (aptitud térmica menor que 1) y otro cultivo anual del catálogo encaja mejor, usa ese. Nunca elige un permanente.
 * `reason` explica el cambio (null si se queda el maíz). Es un supuesto del sistema: el análisis lo avisa como vacío de información.
 */
export function defaultCurrentCrop(crops: readonly Crop[], meanTemperatureC: number | null): { crop: Crop; reason: string | null } {
  const maize = resolveCurrentCrop(crops, undefined);
  if (meanTemperatureC === null || !maize.temperatureC) return { crop: maize, reason: null };
  const suitability = (crop: Crop) => (crop.temperatureC ? temperatureSuitability(crop.temperatureC, meanTemperatureC) : 0);
  if (suitability(maize) >= 1) return { crop: maize, reason: null };
  const best = crops.filter((crop) => crop.perennial !== true && crop.temperatureC)
    .reduce((top, crop) => (suitability(crop) > suitability(top) || (suitability(crop) === suitability(top) && crop.marketPotential > top.marketPotential) ? crop : top), maize);
  return best.id === maize.id ? { crop: maize, reason: null } : { crop: best, reason: `el ${commonName(maize).toLowerCase()} no crece bien a la temperatura media de este sitio (${meanTemperatureC.toFixed(1)} °C)` };
}

/** La mejor candidata de una estrategia según el puntaje; falla con un mensaje claro si el catálogo no dio ninguna. */
function bestOf(results: readonly RotationResult[], strategy: string): RotationResult {
  if (results.length === 0) throw new Error(`El catálogo no tiene cultivos suficientes para armar la alternativa de ${strategy}`);
  return pickBest(results);
}

type Scorer = (rotations: readonly Rotation[]) => RotationResult[];

/** Línea base (el cultivo actual) más la mejor alternativa de leguminosa y la mejor de cobertura con sequía. */
function alternativesAround(crops: readonly Crop[], current: Crop, score: Scorer): RotationResult[] {
  const candidates = candidateRotations(crops, current);
  return [...score([baselineRotation(current)]), bestOf(score(candidates.legume), "leguminosa"), bestOf(score(candidates.coverDrought), "cobertura y sequía")];
}

/** Sin cultivo actual: la mejor opción de un solo cultivo y la mejor de cada estrategia alternativa, sin línea base. */
function startingOptions(crops: readonly Crop[], score: Scorer): RotationResult[] {
  const candidates = startingRotations(crops);
  return [bestOf(score(candidates.single), "un solo cultivo"), bestOf(score(candidates.legume), "leguminosa"), bestOf(score(candidates.coverDrought), "cobertura y sequía")];
}

export type AnalysisInput = {
  climate: ClimateResult; crops: readonly Crop[]; priorities: UserPriorities; location: { lat: number; lon: number };
  /** Vacíos de información sobre el lote (p. ej. solo se conoce un punto); se agregan a todas las rotaciones. */
  siteGaps?: readonly string[];
  /** Escenario "¿y si…?" (más calor, menos lluvia) que se aplica a la serie antes de calcular indicadores y puntajes. */
  scenario?: ClimateScenario;
  /** Incluye los registros diarios originales en la respuesta; por defecto solo va el resumen de la serie. */
  includeDailyRecords?: boolean;
  /** Últimos días de NASA POWER: con ellos se compara la temporada actual con lo normal. Sin ellos no hay `currentSeason`. */
  recentClimate?: ClimateResult;
  /** Años de clima que se pidieron; si la serie trae menos (p. ej. una muestra de respaldo corta) se avisa como vacío de información. */
  requestedYears?: number;
  /** Altitud y pendiente medidas en vivo con NASA SRTM sobre el lote; con ellas no hace falta un punto piloto cercano. Sin ellas se usa la muestra precargada. */
  liveTerrain?: LiveTerrain | null;
};

const formatDate = (date: string) => `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;

/** Avisos sobre la serie de clima: muestra guardada en lugar de consulta en vivo, o menos años de los pedidos. */
function seriesGaps({ records, source }: ClimateResult, requestedYears: number | undefined): string[] {
  const years = countYears(records);
  const lastDate = records.map((record) => record.date).sort().at(-1);
  return [
    ...(source === "sample" && lastDate ? [`Los datos de clima son una muestra guardada de NASA POWER, no una consulta en vivo: llegan hasta ${formatDate(lastDate)}.`] : []),
    ...(requestedYears !== undefined && years < requestedYears ? [`Se pidieron ${requestedYears} años de clima y la serie trae ${years}.`] : []),
  ];
}

/** Resumen de la serie de NASA para la respuesta: sin los miles de registros diarios salvo que se pidan. */
function summarizeClimate({ records, ...summary }: ClimateResult, includeDailyRecords: boolean): AnalysisClimate {
  const dates = records.map((record) => record.date).sort();
  return { ...summary, daysAnalyzed: records.length, firstDate: dates[0], lastDate: dates[dates.length - 1], ...(includeDailyRecords ? { records } : {}) };
}

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
 * Con `scenario` todo se calcula sobre la serie modificada, pero `climate` conserva los datos originales de NASA.
 * Es pura (sin red ni archivos). Lanza `AnalysisInputError` si no hay registros o si el cultivo actual es desconocido.
 */
export function buildAnalysis({ climate, crops, priorities, location, siteGaps = [], scenario, includeDailyRecords = false, recentClimate, requestedYears, liveTerrain = null }: AnalysisInput): AnalysisResponse {
  if (climate.records.length === 0) throw new AnalysisInputError("No hay datos climáticos para analizar");
  const terrain = resolveTerrain(location, priorities, climate.cellElevationMeters !== undefined, undefined, liveTerrain);
  const terrainInput = terrain || climate.cellElevationMeters !== undefined
    ? { cellElevationMeters: climate.cellElevationMeters, siteElevationMeters: terrain?.elevationMeters, slopePercent: terrain?.slopePercent, terrainSource: terrain?.source, slopeRangePercent: terrain?.slopeRangePercent, terrainCellMeters: terrain?.cellMeters }
    : undefined;
  const applied = scenario && !isNeutralScenario(scenario) ? scenario : undefined;
  const records = applied ? applyScenario(climate.records, applied) : climate.records;
  const indicators = computeIndicators(records, location.lat, terrainInput);
  // «No tengo cultivo» no compara contra uno actual; sin cultivo declarado se parte de uno supuesto (se avisa), y si se declara uno desconocido se rechaza.
  const assumed = priorities.noCurrentCrop || priorities.currentCropId !== undefined ? null : defaultCurrentCrop(crops, indicators.meanTemperatureC ?? null);
  const current = priorities.noCurrentCrop ? null : (assumed?.crop ?? resolveCurrentCrop(crops, priorities.currentCropId));
  const baseGaps = [...siteGaps, ...seriesGaps(climate, requestedYears)];
  const assumedGap = assumed ? [`No indicaste qué cultivo tienes hoy: se compara contra ${commonName(assumed.crop)} como punto de partida (supuesto del sistema${assumed.reason ? `, elegido porque ${assumed.reason}` : ""}).`] : [];
  const extraGaps = [...assumedGap, ...baseGaps, ...(applied ? [scenarioGap(applied)] : [])];
  const monthlyClimate = aggregateMonthly(adjustRecordsForElevation(records, terrainInput?.cellElevationMeters, terrainInput?.siteElevationMeters), location.lat);
  const seasonality = isInSowingCalendarRegion(location.lat, location.lon) ? computeSeasonality(monthlyClimate) : undefined;
  const yearsAnalyzed = countYears(records);
  const score = (rotations: readonly Rotation[]) => scoreRotations({ rotations, crops, indicators, priorities, seasonality, yearsAnalyzed, monthlyClimate });
  const rotations = current ? alternativesAround(crops, current, score) : startingOptions(crops, score);
  const results = rotations.map((result) => ({ ...result, informationGaps: [...result.informationGaps, ...extraGaps] }));
  // La temporada actual se compara con los datos originales de NASA, no con la serie modificada por un escenario.
  const currentSeason = recentClimate ? computeCurrentSeason(recentClimate.records, climate.records) : null;
  // Los años extremos se buscan en los datos originales de NASA, no en la serie con escenario.
  const extremeYears = computeExtremeYears(climate.records);
  return { climate: summarizeClimate(climate, includeDailyRecords), monthlyClimate, indicators, rotations: results, dataSources: listDataSources(indicators, { currentSeason: currentSeason !== null }), ...(currentSeason ? { currentSeason } : {}), ...(extremeYears ? { extremeYears } : {}), ...(scenario ? { scenario } : {}) };
}
