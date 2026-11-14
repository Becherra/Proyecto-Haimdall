import { CLIMATE_PARAMETERS, type ClimateParameter, type ClimateRecord, type Indicators, type IndicatorValue, type MonthlyClimate, type MonthlyWaterDeficit, type MonthlyWetnessAnomaly } from "../types";
import { dayOfYear, extraterrestrialRadiation, hargreavesDailyPet } from "./evapotranspiration";
import { EXTREME_RAIN_PERCENTILE, FROST_THRESHOLD_C, HEAT_STRESS_THRESHOLD_C, MIN_YEARS_FOR_ANOMALY_BASELINE } from "./config";

type NumericParameter = ClimateParameter;

const AGGREGATED_PARAMETERS: readonly ClimateParameter[] = ["T2M", "T2M_MIN", "T2M_MAX", "PRECTOTCORR", "EVLAND", "GWETROOT"];

/** Separa los valores válidos de un parámetro y cuenta los días en que faltó (null). */
function validValues(records: readonly ClimateRecord[], parameter: NumericParameter): IndicatorValue<number[]> {
  const values: number[] = [];
  for (const record of records) {
    const value = record[parameter];
    if (value !== null) values.push(value);
  }
  return { value: values, missing: records.length - values.length };
}

function sum(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((total, value) => total + value, 0);
}

function mean(values: readonly number[]): number | null {
  const total = sum(values);
  return total === null ? null : total / values.length;
}

function groupByMonth(records: readonly ClimateRecord[]): Map<string, ClimateRecord[]> {
  const groups = new Map<string, ClimateRecord[]>();
  for (const record of records) {
    const key = record.date.slice(0, 6);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return groups;
}

/** Evaporación potencial de un día (Hargreaves–Samani) o null si falta alguna de las tres temperaturas. */
function dailyPotentialEvaporation(record: ClimateRecord, latitude: number): number | null {
  const { T2M, T2M_MIN, T2M_MAX } = record;
  if (T2M === null || T2M_MIN === null || T2M_MAX === null) return null;
  return hargreavesDailyPet(T2M, T2M_MIN, T2M_MAX, extraterrestrialRadiation(latitude, dayOfYear(record.date)));
}

function monthlyPotentialEvaporation(days: readonly ClimateRecord[], latitude: number): number | null {
  return sum(days.flatMap((record) => dailyPotentialEvaporation(record, latitude) ?? []));
}

function aggregateMonth(key: string, days: readonly ClimateRecord[], latitude: number | undefined): MonthlyClimate {
  const data = Object.fromEntries(AGGREGATED_PARAMETERS.map((name) => [name, validValues(days, name)])) as Record<NumericParameter, IndicatorValue<number[]>>;
  return {
    year: Number(key.slice(0, 4)),
    month: Number(key.slice(4, 6)),
    meanTemperatureC: mean(data.T2M.value),
    minTemperatureC: mean(data.T2M_MIN.value),
    maxTemperatureC: mean(data.T2M_MAX.value),
    // Si faltan días, la suma cubre solo los días con dato; `missingByParameter` dice cuántos faltaron.
    precipitationMm: sum(data.PRECTOTCORR.value),
    evaporationMm: sum(data.EVLAND.value),
    rootZoneWetness: mean(data.GWETROOT.value),
    missingByParameter: Object.fromEntries(AGGREGATED_PARAMETERS.map((name) => [name, data[name].missing])),
    ...(latitude === undefined ? {} : { potentialEvaporationMm: monthlyPotentialEvaporation(days, latitude) }),
  };
}

/**
 * Agrega los registros diarios por mes calendario, en orden cronológico.
 * Temperaturas y humedad: promedio de los días con dato (T2M_MIN/T2M_MAX: promedio de las mínimas/máximas diarias).
 * Lluvia y evaporación: suma (mm) de los días con dato. Un parámetro sin ningún dato en el mes queda en null.
 * Con `latitude` (grados, sur negativo) agrega además `potentialEvaporationMm`: la evaporación potencial estimada
 * (Hargreaves–Samani) sumada sobre los días con las tres temperaturas; sin latitud no se calcula y el campo no existe.
 */
export function aggregateMonthly(records: readonly ClimateRecord[], latitude?: number): MonthlyClimate[] {
  return [...groupByMonth(records).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, days]) => aggregateMonth(key, days, latitude));
}

/**
 * Balance hídrico de un mes = lluvia − demanda de agua (mm). La demanda es la evaporación potencial estimada si se
 * calculó (`potentialEvaporationMm`) y, si no, EVLAND de NASA POWER. EVLAND es evaporación *real*: en un sitio árido
 * queda limitada por la poca lluvia y el balance parece equilibrado aunque falte agua; por eso se prefiere la potencial.
 * Devuelve null si falta la lluvia o la demanda.
 */
export function monthlyWaterBalance({ precipitationMm, evaporationMm, potentialEvaporationMm }: MonthlyClimate): number | null {
  const demand = potentialEvaporationMm === undefined ? evaporationMm : potentialEvaporationMm;
  return precipitationMm === null || demand === null ? null : precipitationMm - demand;
}

/**
 * Balance hídrico mensual (ver `monthlyWaterBalance`). Negativo = la demanda de agua supera a la lluvia (déficit).
 * `missing` suma los días faltantes de lluvia y de la demanda (EVLAND, o las temperaturas si se usó la potencial);
 * con faltantes el balance es parcial porque cada total solo cubre los días con dato.
 */
export function computeMonthlyWaterDeficit(monthly: readonly MonthlyClimate[]): MonthlyWaterDeficit[] {
  return monthly.map((entry) => {
    const missing = entry.missingByParameter;
    const demandMissing = entry.potentialEvaporationMm === undefined ? (missing.EVLAND ?? 0) : Math.max(missing.T2M ?? 0, missing.T2M_MIN ?? 0, missing.T2M_MAX ?? 0);
    return { year: entry.year, month: entry.month, waterDeficitMm: monthlyWaterBalance(entry), missing: (missing.PRECTOTCORR ?? 0) + demandMissing };
  });
}

/** Años calendario distintos que cubre la serie (los parciales cuentan como uno). */
export function countYears(records: readonly ClimateRecord[]): number {
  return new Set(records.map((record) => record.date.slice(0, 4))).size;
}

function countDays(records: readonly ClimateRecord[], parameter: NumericParameter, isRisk: (value: number) => boolean): IndicatorValue<number> {
  const { value, missing } = validValues(records, parameter);
  return { value: value.filter(isRisk).length, missing };
}

/** Días con temperatura máxima (T2M_MAX) estrictamente por encima de `HEAT_STRESS_THRESHOLD_C`. */
export function countHeatStressDays(records: readonly ClimateRecord[]): IndicatorValue<number> {
  return countDays(records, "T2M_MAX", (value) => value > HEAT_STRESS_THRESHOLD_C);
}

/** Días con temperatura mínima (T2M_MIN) estrictamente por debajo de `FROST_THRESHOLD_C`. */
export function countFrostRiskDays(records: readonly ClimateRecord[]): IndicatorValue<number> {
  return countDays(records, "T2M_MIN", (value) => value < FROST_THRESHOLD_C);
}

/**
 * Percentil `p` (0–1) por interpolación lineal entre rangos (método por defecto de NumPy).
 * Devuelve null si no hay valores.
 */
export function percentile(values: readonly number[], p: number): number | null {
  if (p < 0 || p > 1) throw new RangeError("El percentil debe estar entre 0 y 1");
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = p * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/**
 * Umbral de lluvia extrema: percentil 95 (`EXTREME_RAIN_PERCENTILE`) de la lluvia diaria, mm/día.
 * Incluye los días sin lluvia, así que describe la serie completa y no solo los días lluviosos.
 */
export function extremeRainThreshold(records: readonly ClimateRecord[]): IndicatorValue<number | null> {
  const { value, missing } = validValues(records, "PRECTOTCORR");
  return { value: percentile(value, EXTREME_RAIN_PERCENTILE), missing };
}

function historicalWetnessByMonth(monthly: readonly MonthlyClimate[]): Map<number, number | null> {
  const byMonth = new Map<number, number[]>();
  for (const { month, rootZoneWetness } of monthly) {
    if (rootZoneWetness !== null) byMonth.set(month, [...(byMonth.get(month) ?? []), rootZoneWetness]);
  }
  return new Map([...byMonth].map(([month, values]) => [month, values.length >= MIN_YEARS_FOR_ANOMALY_BASELINE ? mean(values) : null]));
}

/**
 * Humedad de zona radicular (GWETROOT, 0–1): media mensual y anomalía como DIFERENCIA
 * (media del mes − promedio histórico del mismo mes calendario), en unidades de GWETROOT.
 * Se usa diferencia y no desviaciones estándar porque con pocos años la desviación es inestable.
 * Con menos de `MIN_YEARS_FOR_ANOMALY_BASELINE` años con dato en ese mes no hay línea base y la anomalía es null
 * (compararla contra sí misma daría 0, que sería engañoso). El promedio histórico incluye el propio mes.
 */
export function computeWetnessAnomalies(monthly: readonly MonthlyClimate[]): MonthlyWetnessAnomaly[] {
  const baseline = historicalWetnessByMonth(monthly);
  return monthly.map(({ year, month, rootZoneWetness, missingByParameter }) => {
    const historical = baseline.get(month) ?? null;
    return {
      year,
      month,
      meanWetness: rootZoneWetness,
      historicalMeanWetness: historical,
      anomaly: rootZoneWetness === null || historical === null ? null : rootZoneWetness - historical,
      missing: missingByParameter.GWETROOT ?? 0,
    };
  });
}

/**
 * Arma el objeto `Indicators` completo a partir de los registros diarios.
 * - `waterDeficitMm`: promedio de los balances mensuales (lluvia − demanda de agua) en mm/mes; negativo = déficit.
 *   Con `latitude` la demanda es la evaporación potencial estimada (`waterBalanceMethod: "potential"`); sin ella, EVLAND ("evland").
 * - `heatStressDays` / `frostRiskDays`: total de días de toda la serie (no promedio anual).
 * - `extremeRainThresholdMm`: percentil 95 de lluvia diaria.
 * - `meanRootZoneWetness`: promedio de los días con dato de GWETROOT.
 * - `missingByParameter`: días sin dato por cada uno de los parámetros NASA.
 * Un indicador sin datos suficientes queda en null (o 0 en los conteos de días).
 */
export function computeIndicators(records: readonly ClimateRecord[], latitude?: number): Indicators {
  const monthlyBalances = computeMonthlyWaterDeficit(aggregateMonthly(records, latitude)).flatMap(({ waterDeficitMm }) => (waterDeficitMm === null ? [] : [waterDeficitMm]));
  return {
    waterDeficitMm: mean(monthlyBalances),
    heatStressDays: countHeatStressDays(records).value,
    frostRiskDays: countFrostRiskDays(records).value,
    extremeRainThresholdMm: extremeRainThreshold(records).value,
    meanRootZoneWetness: mean(validValues(records, "GWETROOT").value),
    missingByParameter: Object.fromEntries(CLIMATE_PARAMETERS.map((name) => [name, validValues(records, name).missing])),
    waterBalanceMethod: latitude === undefined ? "evland" : "potential",
  };
}
