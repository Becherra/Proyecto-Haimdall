import { describe, expect, it } from "vitest";
import { assessSowing, computeSeasonality, formatMonths, type MonthSeason } from "../src/lib/seasonality";
import type { MonthlyClimate } from "../src/types";

function month(year: number, number: number, precipitationMm: number | null, evaporationMm: number | null): MonthlyClimate {
  return { year, month: number, meanTemperatureC: 20, precipitationMm, evaporationMm, rootZoneWetness: 0.8, missingByParameter: {} };
}

/** Un año completo con la misma lluvia y evaporación en todos los meses, salvo los que se sobreescriben. */
function year(yearNumber: number, overrides: Record<number, [number | null, number | null]> = {}): MonthlyClimate[] {
  return Array.from({ length: 12 }, (_, index) => {
    const [rain, evaporation] = overrides[index + 1] ?? [100, 20];
    return month(yearNumber, index + 1, rain, evaporation);
  });
}

const seasonOf = (seasonality: MonthSeason[], monthNumber: number) => seasonality[monthNumber - 1];

describe("computeSeasonality", () => {
  it("devuelve 12 meses en orden y promedia la lluvia de todos los años", () => {
    const seasonality = computeSeasonality([...year(2020, { 3: [100, 20] }), ...year(2021, { 3: [200, 20] })]);
    expect(seasonality.map((entry) => entry.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(seasonOf(seasonality, 3).meanRainMm).toBe(150);
    expect(seasonOf(seasonality, 3).meanBalanceMm).toBe(130);
  });

  it("no marca ningún mes seco cuando todos los meses son iguales y llueve más de lo que se evapora", () => {
    expect(computeSeasonality(year(2020)).some((entry) => entry.dry)).toBe(false);
  });

  it("marca un mes seco cuando la evaporación supera a la lluvia, aunque la lluvia sea normal", () => {
    const seasonality = computeSeasonality(year(2020, { 5: [90, 120] }));
    expect(seasonOf(seasonality, 5).dry).toBe(true);
    expect(seasonality.filter((entry) => entry.dry)).toHaveLength(1);
  });

  it("marca un mes seco cuando llueve mucho menos que el promedio del sitio, aunque el balance sea positivo", () => {
    const seasonality = computeSeasonality(year(2020, { 8: [40, 10] }));
    expect(seasonOf(seasonality, 8).meanBalanceMm).toBeGreaterThan(0);
    expect(seasonOf(seasonality, 8).dry).toBe(true);
  });

  it("deja sin dato (y no seco) los meses que no aparecen en la serie", () => {
    const seasonality = computeSeasonality([month(2020, 1, 100, 20), month(2020, 2, 100, 20)]);
    expect(seasonality).toHaveLength(12);
    expect(seasonOf(seasonality, 7)).toEqual({ month: 7, meanRainMm: null, meanBalanceMm: null, dry: false });
  });

  it("usa solo la regla de lluvia relativa cuando falta la evaporación", () => {
    const seasonality = computeSeasonality(year(2020, { 4: [100, null], 6: [30, null] }));
    expect(seasonOf(seasonality, 4)).toMatchObject({ meanBalanceMm: null, dry: false });
    expect(seasonOf(seasonality, 6).dry).toBe(true);
  });

  it("con una serie vacía devuelve 12 meses sin dato", () => {
    const seasonality = computeSeasonality([]);
    expect(seasonality).toHaveLength(12);
    expect(seasonality.every((entry) => entry.meanRainMm === null && !entry.dry)).toBe(true);
  });
});

describe("assessSowing", () => {
  const seasonality = computeSeasonality([...year(2020, { 8: [40, 10] }).filter((entry) => entry.month !== 11)]);

  it("separa los meses de siembra en secos, con lluvia suficiente y sin dato", () => {
    expect(assessSowing([3, 8, 11], seasonality)).toEqual({ dryMonths: [8], wetMonths: [3], unknownMonths: [11] });
  });

  it("ignora meses de siembra fuera de 1–12", () => {
    expect(assessSowing([0, 13, 3], seasonality)).toEqual({ dryMonths: [], wetMonths: [3], unknownMonths: [] });
  });
});

describe("formatMonths", () => {
  it("escribe los meses en español, abreviados y en orden", () => {
    expect(formatMonths([10, 3, 9, 4])).toBe("mar, abr, sep, oct");
    expect(formatMonths([])).toBe("ninguno");
  });
});
