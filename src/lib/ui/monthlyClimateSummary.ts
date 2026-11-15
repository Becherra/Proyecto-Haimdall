import type { MonthlyClimate } from "../../types";
import { MIN_YEARS_FOR_WATER_SHORT_MONTHS, WATER_SHORT_YEAR_SHARE } from "../config";
import { monthlyWaterBalance } from "../indicators";

const MONTH_LABELS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"] as const;

export type MonthlyClimateSummary = {
  month: number;
  label: string;
  precipitationMm: number | null;
  evaporationMm: number | null;
  meanTemperatureC: number | null;
  rootZoneWetness: number | null;
};

function average(values: readonly (number | null | undefined)[]): number | null {
  const available = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return available.length === 0 ? null : available.reduce((sum, value) => sum + value, 0) / available.length;
}

/** Summarizes multiple historical years into a readable 12-month climate profile. */
export function summarizeMonthlyClimate(rows: readonly MonthlyClimate[]): MonthlyClimateSummary[] {
  const usePotentialEvaporation = rows.some((row) => row.potentialEvaporationMm !== undefined);
  return MONTH_LABELS.map((label, index) => {
    const monthRows = rows.filter((row) => row.month === index + 1);
    return {
      month: index + 1, label,
      precipitationMm: average(monthRows.map((row) => row.precipitationMm)),
      evaporationMm: average(monthRows.map((row) => usePotentialEvaporation ? row.potentialEvaporationMm : row.evaporationMm)),
      meanTemperatureC: average(monthRows.map((row) => row.meanTemperatureC)),
      rootZoneWetness: average(monthRows.map((row) => row.rootZoneWetness)),
    };
  });
}

/**
 * Meses del calendario (1–12) en que la lluvia no cubrió lo que se pierde por evaporación en al menos `WATER_SHORT_YEAR_SHARE` de los años.
 * Mira año por año y no el promedio: un mes con balance medio positivo puede faltar agua con frecuencia. Los meses sin dato no cuentan.
 * Devuelve null si la serie tiene menos de `MIN_YEARS_FOR_WATER_SHORT_MONTHS` años con balance: con tan pocos años no hay frecuencia que contar.
 */
export function waterShortMonths(rows: readonly MonthlyClimate[]): number[] | null {
  const balances = new Map<number, number[]>();
  const years = new Set<number>();
  for (const row of rows) {
    const balance = monthlyWaterBalance(row);
    if (balance === null) continue;
    years.add(row.year);
    balances.set(row.month, [...(balances.get(row.month) ?? []), balance]);
  }
  if (years.size < MIN_YEARS_FOR_WATER_SHORT_MONTHS) return null;
  return [...balances]
    .filter(([, values]) => values.length >= MIN_YEARS_FOR_WATER_SHORT_MONTHS && values.filter((value) => value < 0).length / values.length >= WATER_SHORT_YEAR_SHARE)
    .map(([month]) => month)
    .sort((a, b) => a - b);
}
