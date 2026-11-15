import type { MonthlyClimate } from "../../types";

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
