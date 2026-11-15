import type { MonthlyClimate } from "../types";
import { SEASON_DRY_RAIN_RATIO } from "./config";
import { monthlyWaterBalance } from "./indicators";

/** Clima típico de un mes calendario (enero a diciembre) promediado sobre todos los años de la serie. */
export type MonthSeason = { month: number; meanRainMm: number | null; meanBalanceMm: number | null; dry: boolean };

/** Cómo caen los meses de siembra de un cultivo en las épocas seca y no seca del sitio. */
export type SowingAssessment = { dryMonths: number[]; wetMonths: number[]; unknownMonths: number[] };

const MONTHS_IN_YEAR = 12;
const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length;
}

function valuesForMonth(monthly: readonly MonthlyClimate[], month: number, pick: (entry: MonthlyClimate) => number | null): number[] {
  return monthly.filter((entry) => entry.month === month).flatMap((entry) => pick(entry) ?? []);
}

function meanBalance(monthly: readonly MonthlyClimate[], month: number): number | null {
  return mean(monthly.filter((entry) => entry.month === month).flatMap((entry) => monthlyWaterBalance(entry) ?? []));
}

/**
 * Promedia lluvia y balance hídrico (lluvia − demanda de agua, ver `monthlyWaterBalance`) de cada mes calendario sobre todos los años y marca los meses secos.
 * Un mes es seco si la demanda de agua supera a la lluvia (balance negativo) o si llueve menos de `SEASON_DRY_RAIN_RATIO`
 * veces el promedio mensual del sitio; la segunda regla detecta épocas secas también en zonas húmedas como Pereira.
 * Un mes sin ningún dato de lluvia queda con `meanRainMm` null y no se marca seco (se trata como desconocido).
 */
export function computeSeasonality(monthly: readonly MonthlyClimate[]): MonthSeason[] {
  const rain = Array.from({ length: MONTHS_IN_YEAR }, (_, index) => mean(valuesForMonth(monthly, index + 1, (entry) => entry.precipitationMm)));
  const siteMean = mean(rain.flatMap((value) => value ?? []));
  return rain.map((meanRainMm, index) => {
    const meanBalanceMm = meanBalance(monthly, index + 1);
    const isDrier = meanRainMm !== null && siteMean !== null && meanRainMm < SEASON_DRY_RAIN_RATIO * siteMean;
    return { month: index + 1, meanRainMm, meanBalanceMm, dry: isDrier || (meanBalanceMm !== null && meanBalanceMm < 0) };
  });
}

/** Separa los meses de siembra en secos, con lluvia suficiente y sin dato de lluvia. Ignora meses fuera de 1–12. */
export function assessSowing(sowingMonths: readonly number[], seasonality: readonly MonthSeason[]): SowingAssessment {
  const assessment: SowingAssessment = { dryMonths: [], wetMonths: [], unknownMonths: [] };
  for (const month of sowingMonths) {
    const season = seasonality.find((entry) => entry.month === month);
    if (!season) continue;
    if (season.meanRainMm === null) assessment.unknownMonths.push(month);
    else if (season.dry) assessment.dryMonths.push(month);
    else assessment.wetMonths.push(month);
  }
  return assessment;
}

/** Meses en español abreviado y en orden, p. ej. "mar, abr, sep, oct"; "ninguno" si no hay. */
export function formatMonths(months: readonly number[]): string {
  if (months.length === 0) return "ninguno";
  return [...months].sort((a, b) => a - b).map((month) => MONTH_NAMES[month - 1]).join(", ");
}
