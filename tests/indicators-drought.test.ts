import { describe, expect, it } from "vitest";
import { DRY_DAY_RAIN_MM, MIN_YEARS_FOR_WORST_YEAR } from "../src/lib/config";
import { annualDrySpells, computeIndicators, longestDrySpell } from "../src/lib/indicators";
import type { ClimateRecord } from "../src/types";

function day(date: string, rain: number | null, overrides: Partial<ClimateRecord> = {}): ClimateRecord {
  return { date, T2M: 20, T2M_MIN: 14, T2M_MAX: 27, PRECTOTCORR: rain, EVLAND: 3, GWETROOT: 0.8, ALLSKY_SFC_SW_DWN: 15, ...overrides };
}

function rainSequence(values: Array<number | null>, year = 2021): ClimateRecord[] {
  return values.map((rain, index) => day(`${year}01${String(index + 1).padStart(2, "0")}`, rain));
}

/** Año calendario completo con la misma lluvia diaria (o la que decida `rainOf`). */
function fullYear(year: number, rainOf: (dayIndex: number) => number | null): ClimateRecord[] {
  const records: ClimateRecord[] = [];
  const cursor = new Date(Date.UTC(year, 0, 1));
  for (let index = 0; cursor.getUTCFullYear() === year; index += 1) {
    const date = `${cursor.getUTCFullYear()}${String(cursor.getUTCMonth() + 1).padStart(2, "0")}${String(cursor.getUTCDate()).padStart(2, "0")}`;
    records.push(day(date, rainOf(index)));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return records;
}

describe("longestDrySpell", () => {
  it("cuenta la racha más larga de días con lluvia menor que el umbral de día seco", () => {
    expect(longestDrySpell(rainSequence([0, 0.5, 3, 0, 0, 0, 2]))).toBe(3);
  });

  it("trata el umbral exacto como día lluvioso y lo que queda por debajo como seco", () => {
    expect(longestDrySpell(rainSequence([DRY_DAY_RAIN_MM, DRY_DAY_RAIN_MM, 0]))).toBe(1);
    expect(longestDrySpell(rainSequence([DRY_DAY_RAIN_MM - 0.01, DRY_DAY_RAIN_MM - 0.01]))).toBe(2);
  });

  it("corta la racha en un día sin dato en lugar de suponer que siguió seco", () => {
    expect(longestDrySpell(rainSequence([0, 0, null, 0, 0, 0]))).toBe(3);
  });

  it("devuelve 0 sin registros o si siempre llueve", () => {
    expect(longestDrySpell([])).toBe(0);
    expect(longestDrySpell(rainSequence([5, 6, 7]))).toBe(0);
  });
});

describe("annualDrySpells", () => {
  it("da la racha seca más larga de cada año y no cruza de un año al siguiente", () => {
    const records = [...fullYear(2020, (index) => (index < 10 ? 0 : 5)), ...fullYear(2021, (index) => (index < 4 ? 0 : 5))];
    expect(annualDrySpells(records)).toEqual([{ year: 2020, days: 10 }, { year: 2021, days: 4 }]);
    const wraps = [...fullYear(2020, (index) => (index >= 360 ? 0 : 5)), ...fullYear(2021, (index) => (index < 6 ? 0 : 5))];
    expect(annualDrySpells(wraps).map(({ days }) => days)).toEqual([6, 6]);
  });

  it("deja fuera los años con menos del 80 % de días con dato de lluvia", () => {
    const sparse = fullYear(2020, (index) => (index < 100 ? 0 : null));
    expect(annualDrySpells([...sparse, ...fullYear(2021, () => 5)])).toEqual([{ year: 2021, days: 0 }]);
  });
});

describe("computeIndicators: sequía de años malos", () => {
  const years = (rainByYear: Record<number, number>) => Object.entries(rainByYear).flatMap(([year, rain]) => fullYear(Number(year), () => rain));

  it("expone la racha seca más larga y su promedio anual", () => {
    const records = [...fullYear(2020, (index) => (index < 10 ? 0 : 5)), ...fullYear(2021, (index) => (index < 4 ? 0 : 5))];
    const indicators = computeIndicators(records);
    expect(indicators.longestDrySpellDays).toBe(10);
    expect(indicators.meanAnnualDrySpellDays).toBeCloseTo(7, 5);
  });

  it("identifica el año con el balance hídrico más bajo cuando hay suficientes años", () => {
    const rain: Record<number, number> = {};
    for (let offset = 0; offset < MIN_YEARS_FOR_WORST_YEAR + 1; offset += 1) rain[2015 + offset] = 6;
    rain[2016] = 0.5;
    const { worstYear } = computeIndicators(years(rain));
    expect(worstYear?.year).toBe(2016);
    expect(worstYear?.waterBalanceMm).toBeLessThan(0);
  });

  it("no declara peor año con una serie corta", () => {
    expect(computeIndicators(years({ 2020: 6, 2021: 1, 2022: 6 })).worstYear).toBeUndefined();
  });

  it("no inventa nada sin datos de lluvia", () => {
    const indicators = computeIndicators(fullYear(2020, () => null));
    expect(indicators.longestDrySpellDays).toBe(0);
    expect(indicators.meanAnnualDrySpellDays).toBeNull();
    expect(indicators.worstYear).toBeUndefined();
  });
});
