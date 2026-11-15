import type { Crop, MonthlyClimate } from "../types";
import { CALENDAR_DAYS_PER_MONTH, DEFAULT_TEMPERATURE_MARGIN_C, MIN_YEARS_FOR_SOWING_WINDOWS, SOWING_WINDOW_TOLERANCE_MONTHS } from "./config";
import { monthlyWaterBalance } from "./indicators";

/**
 * `exposureByMonth[m - 1]`: meses del ciclo con déficit de agua, en promedio, al sembrar en el mes `m`; null si ese mes no se puede
 * (el ciclo pasa por meses demasiado fríos) o no hay años suficientes. `months` son los mejores meses de siembra.
 */
export type SowingWindows = { months: number[]; exposureByMonth: Array<number | null>; cycleMonths: number };

const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** Temperatura media de cada mes del calendario (índice 0 = enero) a lo largo de la serie; null si ese mes no tiene dato. */
function climatologyOfTemperature(rows: readonly MonthlyClimate[]): Array<number | null> {
  return Array.from({ length: 12 }, (_, index) => {
    const values = rows.flatMap(({ month, meanTemperatureC }) => (month === index + 1 && meanTemperatureC !== null ? [meanTemperatureC] : []));
    return values.length === 0 ? null : mean(values);
  });
}

/**
 * Mejores meses para sembrar un cultivo anual según el clima de este sitio y no un calendario fijo: para cada mes de siembra mira los meses de
 * su ciclo (`cycleDays` / `CALENDAR_DAYS_PER_MONTH`) año por año y cuenta cuántos tuvieron la lluvia por debajo de la demanda de agua. Un mes de siembra
 * no vale si algún mes de su ciclo tiene una temperatura media bajo el límite del cultivo (el de su fuente o, si falta, el inicio del rango bueno menos
 * `DEFAULT_TEMPERATURE_MARGIN_C`). Los mejores meses son los de menor exposición y los que no pasan de ella por más de `SOWING_WINDOW_TOLERANCE_MONTHS`.
 * Usa la serie mensual ya corregida por altitud. Devuelve null para un cultivo permanente, un ciclo de más de un año, menos de
 * `MIN_YEARS_FOR_SOWING_WINDOWS` ciclos por mes o si ningún mes sirve. No mira plagas, heladas locales ni mercado: es evidencia, no un calendario agronómico.
 */
export function sowingWindows(crop: Crop, monthly: readonly MonthlyClimate[]): SowingWindows | null {
  const cycleMonths = Math.ceil(crop.cycleDays / CALENDAR_DAYS_PER_MONTH);
  if (crop.perennial === true || cycleMonths < 1 || cycleMonths > 12) return null;
  const ordered = [...monthly].sort((a, b) => a.year - b.year || a.month - b.month);
  const position = ({ year, month }: MonthlyClimate) => year * 12 + month;
  const coldLimit = crop.temperatureC ? (crop.temperatureC.limitMin ?? crop.temperatureC.goodMin - DEFAULT_TEMPERATURE_MARGIN_C) : null;
  const temperature = climatologyOfTemperature(ordered);
  const tooCold = (startMonth: number) => coldLimit !== null && Array.from({ length: cycleMonths }, (_, step) => temperature[(startMonth - 1 + step) % 12]).some((value) => value !== null && value < coldLimit);

  const exposureByMonth = Array.from({ length: 12 }, (_, index): number | null => {
    const startMonth = index + 1;
    if (tooCold(startMonth)) return null;
    const counts: number[] = [];
    ordered.forEach((row, rowIndex) => {
      if (row.month !== startMonth) return;
      const cycle = ordered.slice(rowIndex, rowIndex + cycleMonths);
      const balances = cycle.map(monthlyWaterBalance);
      const consecutive = cycle.length === cycleMonths && cycle.every((entry, step) => position(entry) === position(row) + step);
      if (consecutive && balances.every((balance) => balance !== null)) counts.push(balances.filter((balance) => (balance as number) < 0).length);
    });
    return counts.length >= MIN_YEARS_FOR_SOWING_WINDOWS ? mean(counts) : null;
  });
  const known = exposureByMonth.flatMap((value) => value ?? []);
  if (known.length === 0) return null;
  const best = Math.min(...known);
  const months = exposureByMonth.flatMap((value, index) => (value !== null && value <= best + SOWING_WINDOW_TOLERANCE_MONTHS + 1e-9 ? [index + 1] : []));
  return { months, exposureByMonth, cycleMonths };
}
