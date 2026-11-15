import { describe, expect, it } from "vitest";
import { SEASON_DRY_SOIL_RATIO } from "../src/lib/config";
import { assessSowing, assessSowingSoil, computeSeasonality } from "../src/lib/seasonality";
import type { MonthlyClimate } from "../src/types";

function month(year: number, number: number, wetness: number | null, rain = 100): MonthlyClimate {
  return { year, month: number, meanTemperatureC: 20, precipitationMm: rain, evaporationMm: 20, rootZoneWetness: wetness, missingByParameter: {} };
}

/** Años completos con la humedad de cada mes dada por `wetnessOf(mes)`. */
function years(yearNumbers: number[], wetnessOf: (monthNumber: number) => number | null): MonthlyClimate[] {
  return yearNumbers.flatMap((yearNumber) => Array.from({ length: 12 }, (_, index) => month(yearNumber, index + 1, wetnessOf(index + 1))));
}

describe("computeSeasonality: humedad del suelo", () => {
  it("promedia la humedad de cada mes calendario sobre todos los años", () => {
    const seasonality = computeSeasonality([...years([2020], (m) => (m === 3 ? 0.9 : 0.8)), ...years([2021], (m) => (m === 3 ? 0.7 : 0.8))]);
    expect(seasonality[2].meanWetness).toBeCloseTo(0.8, 5);
    expect(seasonality[0].meanWetness).toBeCloseTo(0.8, 5);
  });

  it("marca el suelo más seco de lo normal solo en los meses por debajo del corte frente a la media del sitio", () => {
    const seasonality = computeSeasonality(years([2020], (m) => (m === 1 ? 0.5 : 0.8)));
    expect(seasonality[0].soilDry).toBe(true);
    expect(seasonality.slice(1).every((entry) => entry.soilDry === false)).toBe(true);
    const siteMean = (0.5 + 11 * 0.8) / 12;
    expect(seasonality[0].meanWetness).toBeLessThan(SEASON_DRY_SOIL_RATIO * siteMean);
  });

  it("no marca ningún mes si la humedad es pareja todo el año", () => {
    expect(computeSeasonality(years([2020, 2021], () => 0.8)).some((entry) => entry.soilDry)).toBe(false);
  });

  it("un mes sin dato de humedad queda en null y no se marca seco", () => {
    const seasonality = computeSeasonality(years([2020], (m) => (m === 5 ? null : 0.8)));
    expect(seasonality[4].meanWetness).toBeNull();
    expect(seasonality[4].soilDry).toBe(false);
  });

  it("no cambia qué meses son secos por lluvia o balance: la humedad es solo un dato extra", () => {
    const monthly = years([2020], (m) => (m === 1 ? 0.5 : 0.8));
    const withoutWetness = monthly.map((entry) => ({ ...entry, rootZoneWetness: null }));
    expect(computeSeasonality(monthly).map((entry) => entry.dry)).toEqual(computeSeasonality(withoutWetness).map((entry) => entry.dry));
  });
});

describe("assessSowingSoil", () => {
  const seasonality = computeSeasonality(years([2020], (m) => ({ 1: 0.5, 2: 0.6, 3: 0.9 } as Record<number, number>)[m] ?? 0.85));

  it("da los meses de siembra con suelo seco y el rango de humedad de esos meses", () => {
    const soil = assessSowingSoil([1, 3, 4], seasonality);
    expect(soil.soilDryMonths).toEqual([1]);
    expect(soil.wetness).toEqual({ min: 0.5, max: 0.9 });
  });

  it("ignora meses fuera de 1–12 y devuelve null si ningún mes tiene dato de humedad", () => {
    expect(assessSowingSoil([0, 13], seasonality)).toEqual({ soilDryMonths: [], wetness: null });
    expect(assessSowingSoil([5], computeSeasonality(years([2020], () => null)))).toEqual({ soilDryMonths: [], wetness: null });
  });

  it("no altera lo que ya devolvía assessSowing", () => {
    expect(assessSowing([1, 3], seasonality)).toEqual({ dryMonths: [], wetMonths: [1, 3], unknownMonths: [] });
  });
});
