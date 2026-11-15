import type { ClimateRecord, ExtremeYear, ExtremeYears } from "../types";
import { MIN_YEAR_COVERAGE, MIN_YEARS_FOR_WORST_YEAR } from "./config";

/** Límites de `climateScenarioSchema`: un año extremo tiene que poder usarse como escenario. */
const RAIN_FACTOR_RANGE = [0.5, 1.5] as const;
const TEMPERATURE_DELTA_RANGE = [-2, 5] as const;
const DAYS_IN_YEAR = 365;

type YearSummary = { year: number; rainMm: number; meanTemperatureC: number };

const clamp = (value: number, [min, max]: readonly [number, number]) => Math.min(Math.max(value, min), max);
const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Lluvia anual (escalada por los días sin dato) y temperatura media de cada año con dato suficiente de lluvia y de temperatura. */
function summarizeYears(records: readonly ClimateRecord[]): YearSummary[] {
  const byYear = new Map<number, ClimateRecord[]>();
  for (const record of records) {
    const year = Number(record.date.slice(0, 4));
    byYear.set(year, [...(byYear.get(year) ?? []), record]);
  }
  return [...byYear].flatMap(([year, days]) => {
    const rains = days.flatMap(({ PRECTOTCORR }) => PRECTOTCORR ?? []);
    const temperatures = days.flatMap(({ T2M }) => T2M ?? []);
    const enough = (count: number) => count / DAYS_IN_YEAR >= MIN_YEAR_COVERAGE;
    if (!enough(rains.length) || !enough(temperatures.length)) return [];
    return [{ year, rainMm: (rains.reduce((sum, value) => sum + value, 0) * DAYS_IN_YEAR) / rains.length, meanTemperatureC: mean(temperatures) }];
  });
}

function asScenario({ year, rainMm, meanTemperatureC }: YearSummary, meanRainMm: number, meanTemperature: number): ExtremeYear {
  return {
    year,
    rainFactor: round(clamp(rainMm / meanRainMm, RAIN_FACTOR_RANGE), 2),
    tempDeltaC: round(clamp(meanTemperatureC - meanTemperature, TEMPERATURE_DELTA_RANGE), 1),
    rainChangePercent: Math.round((rainMm / meanRainMm - 1) * 100),
  };
}

/**
 * El año más seco, el más lluvioso y el más cálido de la serie, como escenarios "como el año X": cuánto cambió la lluvia y la temperatura
 * de ese año real frente al promedio de los años comparados. Sirve para probar los cultivos con años que de verdad ocurrieron en el sitio
 * y no con cifras inventadas. Solo cuentan los años con al menos `MIN_YEAR_COVERAGE` de días con dato; con menos de `MIN_YEARS_FOR_WORST_YEAR`
 * años devuelve null, porque con tan pocos no hay un año extremo que valga.
 * Aplicar el factor a toda la serie conserva la lluvia total de ese año, no su reparto en meses.
 */
export function computeExtremeYears(records: readonly ClimateRecord[]): ExtremeYears | null {
  const years = summarizeYears(records);
  if (years.length < MIN_YEARS_FOR_WORST_YEAR) return null;
  const meanRainMm = mean(years.map(({ rainMm }) => rainMm));
  const meanTemperature = mean(years.map(({ meanTemperatureC }) => meanTemperatureC));
  if (meanRainMm <= 0) return null;
  const pick = (better: (a: YearSummary, b: YearSummary) => boolean) => years.reduce((best, candidate) => (better(candidate, best) ? candidate : best));
  const scenario = (year: YearSummary) => asScenario(year, meanRainMm, meanTemperature);
  return {
    driest: scenario(pick((a, b) => a.rainMm < b.rainMm)),
    wettest: scenario(pick((a, b) => a.rainMm > b.rainMm)),
    warmest: scenario(pick((a, b) => a.meanTemperatureC > b.meanTemperatureC)),
    yearsCompared: years.length,
  };
}
