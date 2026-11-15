import type { ClimateRecord, CurrentSeason, CurrentSeasonStatus } from "../types";
import { CURRENT_SEASON_PERCENT, DRY_DAY_RAIN_MM, MIN_YEAR_COVERAGE, MIN_YEARS_FOR_CURRENT_SEASON } from "./config";

const mean = (values: readonly number[]): number | null => (values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length);
const monthDay = (date: string) => date.slice(4);

function statusOf(percent: number | null, rainMm: number): CurrentSeasonStatus {
  if (percent === null) return rainMm > 0 ? "much-wetter" : "normal";
  if (percent < CURRENT_SEASON_PERCENT.muchDrier) return "much-drier";
  if (percent < CURRENT_SEASON_PERCENT.drier) return "drier";
  if (percent <= CURRENT_SEASON_PERCENT.wetter) return "normal";
  return percent <= CURRENT_SEASON_PERCENT.muchWetter ? "wetter" : "much-wetter";
}

/** Días secos seguidos que terminan en el último registro recibido; un día sin dato corta la cuenta. */
function trailingDryStreak(window: readonly ClimateRecord[]): number {
  let streak = 0;
  for (let index = window.length - 1; index >= 0; index -= 1) {
    const rain = window[index].PRECTOTCORR;
    if (rain === null || rain >= DRY_DAY_RAIN_MM) break;
    streak += 1;
  }
  return streak;
}

type Totals = { rainMm: number; meanTemperatureC: number | null };

/** Lluvia total (escalada por los días faltantes) y temperatura media de un tramo, o null si tiene menos del `MIN_YEAR_COVERAGE` de días con lluvia. */
function totalsOf(days: readonly ClimateRecord[], expectedDays: number): Totals | null {
  const rains = days.flatMap(({ PRECTOTCORR }) => PRECTOTCORR ?? []);
  if (rains.length === 0 || rains.length / expectedDays < MIN_YEAR_COVERAGE) return null;
  const rainMm = (rains.reduce((sum, value) => sum + value, 0) * expectedDays) / rains.length;
  return { rainMm, meanTemperatureC: mean(days.flatMap(({ T2M }) => T2M ?? [])) };
}

/**
 * Compara los últimos días de NASA POWER (`recent`) con el mismo tramo del calendario en la serie histórica (`history`).
 * La ventana termina en el último día con dato de lluvia (NASA publica con unos días de retraso); si en toda la ventana pedida
 * hay menos del `MIN_YEAR_COVERAGE` de días con dato, o la historia tiene menos de `MIN_YEARS_FOR_CURRENT_SEASON` años con
 * dato suficiente en esa época, devuelve null en lugar de comparar contra algo débil. Los registros de la propia ventana se
 * ignoran en la historia. Es una lectura reciente y preliminar, no un pronóstico.
 */
export function computeCurrentSeason(recent: readonly ClimateRecord[], history: readonly ClimateRecord[]): CurrentSeason | null {
  const lastWithRain = recent.map((record) => record.PRECTOTCORR !== null).lastIndexOf(true);
  if (lastWithRain === -1) return null;
  const window = recent.slice(0, lastWithRain + 1);
  const current = totalsOf(window, window.length);
  if (!current || window.filter((record) => record.PRECTOTCORR !== null).length / recent.length < MIN_YEAR_COVERAGE) return null;

  const [firstDate, lastDate] = [window[0].date, window[window.length - 1].date];
  const keys = new Set(window.map((record) => monthDay(record.date)));
  const wraps = monthDay(firstDate) > monthDay(lastDate);
  const bySeason = new Map<number, ClimateRecord[]>();
  for (const record of history) {
    if (record.date >= firstDate && record.date <= lastDate) continue;
    const key = monthDay(record.date);
    if (!keys.has(key)) continue;
    const year = Number(record.date.slice(0, 4)) - (wraps && key <= monthDay(lastDate) ? 1 : 0);
    bySeason.set(year, [...(bySeason.get(year) ?? []), record]);
  }
  const normals = [...bySeason.values()].flatMap((days) => totalsOf(days, keys.size) ?? []);
  if (normals.length < MIN_YEARS_FOR_CURRENT_SEASON) return null;

  const normalRainMm = mean(normals.map(({ rainMm }) => rainMm)) as number;
  const normalTemperatureC = mean(normals.flatMap(({ meanTemperatureC }) => meanTemperatureC ?? []));
  const rainPercentOfNormal = normalRainMm > 0 ? (current.rainMm / normalRainMm) * 100 : null;
  return {
    windowDays: window.length, firstDate, lastDate, daysWithData: window.filter((record) => record.PRECTOTCORR !== null).length,
    rainMm: current.rainMm, normalRainMm, rainPercentOfNormal, status: statusOf(rainPercentOfNormal, current.rainMm),
    temperatureAnomalyC: current.meanTemperatureC === null || normalTemperatureC === null ? null : current.meanTemperatureC - normalTemperatureC,
    currentDryStreakDays: trailingDryStreak(window), baselineYears: normals.length,
  };
}
