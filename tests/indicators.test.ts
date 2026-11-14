import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aggregateMonthly, computeMonthlyWaterDeficit, computeWetnessAnomalies, countFrostRiskDays, countHeatStressDays, extremeRainThreshold, percentile,
} from "../src/lib/indicators";
import { clearClimateCache, fetchDailyClimate } from "../src/lib/nasaPower";
import type { ClimateRecord } from "../src/types";

const fixture = JSON.parse(readFileSync("tests/fixtures/power-pereira.json", "utf8")) as unknown;
const EMPTY_DAY = { T2M: null, T2M_MIN: null, T2M_MAX: null, PRECTOTCORR: null, EVLAND: null, GWETROOT: null, ALLSKY_SFC_SW_DWN: null };

function day(date: string, values: Partial<ClimateRecord> = {}): ClimateRecord {
  return { ...EMPTY_DAY, date, ...values };
}

let pereira: ClimateRecord[] = [];

beforeAll(async () => {
  clearClimateCache();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
  pereira = (await fetchDailyClimate({ lat: 4.8133, lon: -75.6961, startYear: 2020, endYear: 2022 })).records;
  vi.unstubAllGlobals();
});

describe("aggregateMonthly", () => {
  it("agrega la fixture real de Pereira en 36 meses ordenados", () => {
    const monthly = aggregateMonthly(pereira);
    expect(monthly).toHaveLength(36);
    expect(monthly[0]).toMatchObject({ year: 2020, month: 1 });
    expect(monthly[35]).toMatchObject({ year: 2022, month: 12 });
    const [january] = monthly;
    expect(january.precipitationMm).toBeCloseTo(54.23, 6);
    expect(january.evaporationMm).toBeCloseTo(106.28, 6);
    expect(january.meanTemperatureC).toBeCloseTo(16.440645, 5);
    expect(january.minTemperatureC).toBeCloseTo(12.783548, 5);
    expect(january.maxTemperatureC).toBeCloseTo(21.354516, 5);
    expect(january.rootZoneWetness).toBeCloseTo(0.824516, 5);
    expect(january.missingByParameter).toEqual({ T2M: 0, T2M_MIN: 0, T2M_MAX: 0, PRECTOTCORR: 0, EVLAND: 0, GWETROOT: 0 });
  });

  it("suma lluvia, promedia temperatura y cuenta los días faltantes del mes", () => {
    const monthly = aggregateMonthly([
      day("20200102", { T2M: 10, PRECTOTCORR: 4 }),
      day("20200101", { T2M: 20, PRECTOTCORR: 6, EVLAND: 2 }),
      day("20200103", { T2M: null, PRECTOTCORR: null, EVLAND: 3 }),
    ]);
    expect(monthly).toHaveLength(1);
    expect(monthly[0]).toMatchObject({ meanTemperatureC: 15, precipitationMm: 10, evaporationMm: 5 });
    expect(monthly[0].missingByParameter).toMatchObject({ T2M: 1, PRECTOTCORR: 1, EVLAND: 1, GWETROOT: 3 });
  });

  it("deja null un parámetro sin ningún dato en el mes", () => {
    const [january] = aggregateMonthly([day("20200101"), day("20200102")]);
    expect(january.meanTemperatureC).toBeNull();
    expect(january.precipitationMm).toBeNull();
    expect(january.rootZoneWetness).toBeNull();
    expect(january.missingByParameter.T2M).toBe(2);
  });

  it("devuelve una lista vacía si no hay registros", () => {
    expect(aggregateMonthly([])).toEqual([]);
  });
});

describe("computeMonthlyWaterDeficit", () => {
  it("calcula lluvia − evaporación y marca el déficit en negativo", () => {
    const [january] = computeMonthlyWaterDeficit(aggregateMonthly(pereira));
    expect(january).toMatchObject({ year: 2020, month: 1, missing: 0 });
    expect(january.waterDeficitMm).toBeCloseTo(54.23 - 106.28, 6);
  });

  it("devuelve null y reporta faltantes cuando un mes no tiene evaporación", () => {
    const monthly = aggregateMonthly([day("20200101", { PRECTOTCORR: 5 }), day("20200102", { PRECTOTCORR: null })]);
    expect(computeMonthlyWaterDeficit(monthly)).toEqual([{ year: 2020, month: 1, waterDeficitMm: null, missing: 3 }]);
  });

  it("devuelve una lista vacía si no hay meses", () => {
    expect(computeMonthlyWaterDeficit([])).toEqual([]);
  });
});

describe("countHeatStressDays y countFrostRiskDays", () => {
  it("no encuentra estrés térmico ni heladas en Pereira (máx. 24.4 °C, mín. 8.5 °C)", () => {
    expect(countHeatStressDays(pereira)).toEqual({ value: 0, missing: 0 });
    expect(countFrostRiskDays(pereira)).toEqual({ value: 0, missing: 0 });
  });

  it("usa umbrales estrictos y reporta los días sin dato", () => {
    const records = [
      day("20200101", { T2M_MAX: 35.1, T2M_MIN: -0.5 }),
      day("20200102", { T2M_MAX: 35, T2M_MIN: 0 }),
      day("20200103", { T2M_MAX: null, T2M_MIN: null }),
      day("20200104", { T2M_MAX: 30, T2M_MIN: -3 }),
    ];
    expect(countHeatStressDays(records)).toEqual({ value: 1, missing: 1 });
    expect(countFrostRiskDays(records)).toEqual({ value: 2, missing: 1 });
  });

  it("devuelve cero con una serie vacía", () => {
    expect(countHeatStressDays([])).toEqual({ value: 0, missing: 0 });
    expect(countFrostRiskDays([])).toEqual({ value: 0, missing: 0 });
  });
});

describe("percentile y extremeRainThreshold", () => {
  it("interpola linealmente entre rangos", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([10], 0.95)).toBe(10);
    expect(percentile([], 0.95)).toBeNull();
  });

  it("rechaza percentiles fuera de 0–1", () => {
    expect(() => percentile([1, 2], 1.5)).toThrow(RangeError);
  });

  it("calcula el P95 de lluvia diaria de la fixture real", () => {
    const result = extremeRainThreshold(pereira);
    expect(result.value).toBeCloseTo(17.4475, 4);
    expect(result.missing).toBe(0);
  });

  it("ignora los días sin dato pero los cuenta como faltantes", () => {
    const records = [0, 1, 2, 3, 4].map((mm, index) => day(`2020010${index + 1}`, { PRECTOTCORR: mm })).concat(day("20200106"));
    expect(extremeRainThreshold(records)).toEqual({ value: 3.8, missing: 1 });
  });

  it("devuelve null con una serie vacía", () => {
    expect(extremeRainThreshold([])).toEqual({ value: null, missing: 0 });
  });
});

describe("computeWetnessAnomalies", () => {
  let anomalies: ReturnType<typeof computeWetnessAnomalies>;
  beforeEach(() => { anomalies = computeWetnessAnomalies(aggregateMonthly(pereira)); });

  it("calcula la anomalía como diferencia frente al promedio del mismo mes en los 3 años", () => {
    const januaries = anomalies.filter((entry) => entry.month === 1);
    expect(januaries.map((entry) => entry.year)).toEqual([2020, 2021, 2022]);
    expect(januaries[0].historicalMeanWetness).toBeCloseTo(0.773656, 5);
    expect(januaries[0].anomaly).toBeCloseTo(0.05086, 5);
    expect(januaries[2].anomaly).toBeCloseTo(-0.047527, 5);
    expect(januaries.reduce((total, entry) => total + (entry.anomaly ?? 0), 0)).toBeCloseTo(0, 10);
  });

  it("deja la anomalía en null si el mes mismo no tiene dato, sin romper los demás años", () => {
    const records = [
      day("20200115", { GWETROOT: 0.8 }), day("20210115", { GWETROOT: null }), day("20220115", { GWETROOT: 0.6 }),
    ];
    const [first, second, third] = computeWetnessAnomalies(aggregateMonthly(records));
    expect(first.anomaly).toBeCloseTo(0.1, 10);
    expect(second).toMatchObject({ meanWetness: null, historicalMeanWetness: 0.7, anomaly: null, missing: 1 });
    expect(third.anomaly).toBeCloseTo(-0.1, 10);
  });

  it("no inventa anomalía con un solo año de datos", () => {
    const oneYear = pereira.filter((record) => record.date.startsWith("2020"));
    const result = computeWetnessAnomalies(aggregateMonthly(oneYear));
    expect(result).toHaveLength(12);
    expect(result.every((entry) => entry.anomaly === null && entry.historicalMeanWetness === null)).toBe(true);
    expect(result[0].meanWetness).toBeCloseTo(0.824516, 5);
  });

  it("devuelve una lista vacía si no hay meses", () => {
    expect(computeWetnessAnomalies([])).toEqual([]);
  });
});
