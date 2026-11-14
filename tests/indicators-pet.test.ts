import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { dayOfYear, extraterrestrialRadiation, hargreavesDailyPet } from "../src/lib/evapotranspiration";
import { aggregateMonthly, computeIndicators, computeMonthlyWaterDeficit, countYears, monthlyWaterBalance } from "../src/lib/indicators";
import { clearClimateCache, fetchDailyClimate } from "../src/lib/nasaPower";
import { indicatorsSchema, type ClimateRecord, type MonthlyClimate } from "../src/types";

const fixture = JSON.parse(readFileSync("tests/fixtures/power-pereira.json", "utf8")) as unknown;
const EMPTY_DAY = { T2M: null, T2M_MIN: null, T2M_MAX: null, PRECTOTCORR: null, EVLAND: null, GWETROOT: null, ALLSKY_SFC_SW_DWN: null };
const day = (date: string, values: Partial<ClimateRecord> = {}): ClimateRecord => ({ ...EMPTY_DAY, date, ...values });

function monthlyEntry(overrides: Partial<MonthlyClimate>): MonthlyClimate {
  return { year: 2020, month: 1, meanTemperatureC: 20, precipitationMm: 10, evaporationMm: 4, rootZoneWetness: 0.8, missingByParameter: {}, ...overrides };
}

describe("aggregateMonthly con latitud", () => {
  const records = [
    day("20200101", { T2M: 24, T2M_MIN: 18, T2M_MAX: 30 }),
    day("20200102", { T2M: 22, T2M_MIN: 16, T2M_MAX: 29 }),
    day("20200103", { T2M: null, T2M_MIN: 16, T2M_MAX: 29 }),
  ];

  it("no agrega la evaporación potencial si no se conoce la latitud", () => {
    expect("potentialEvaporationMm" in aggregateMonthly(records)[0]).toBe(false);
  });

  it("suma la evaporación potencial diaria solo de los días con las tres temperaturas", () => {
    const expected = [["20200101", 24, 18, 30], ["20200102", 22, 16, 29]].reduce(
      (total, [date, mean, min, max]) => total + hargreavesDailyPet(mean as number, min as number, max as number, extraterrestrialRadiation(4.8, dayOfYear(date as string))), 0);
    expect(aggregateMonthly(records, 4.8)[0].potentialEvaporationMm).toBeCloseTo(expected, 8);
  });

  it("deja null la evaporación potencial si ningún día tiene temperaturas completas", () => {
    expect(aggregateMonthly([day("20200101", { T2M: 20 })], 4.8)[0].potentialEvaporationMm).toBeNull();
  });
});

describe("monthlyWaterBalance y computeMonthlyWaterDeficit", () => {
  it("usa la evaporación potencial cuando existe y EVLAND cuando no se calculó", () => {
    expect(monthlyWaterBalance(monthlyEntry({ potentialEvaporationMm: 100 }))).toBe(-90);
    expect(monthlyWaterBalance(monthlyEntry({}))).toBe(6);
  });

  it("devuelve null si falta la lluvia o la demanda de agua", () => {
    expect(monthlyWaterBalance(monthlyEntry({ potentialEvaporationMm: null }))).toBeNull();
    expect(monthlyWaterBalance(monthlyEntry({ precipitationMm: null, potentialEvaporationMm: 100 }))).toBeNull();
  });

  it("cuenta como faltantes los días sin temperatura cuando el balance usa evaporación potencial", () => {
    const entry = monthlyEntry({ potentialEvaporationMm: 80, missingByParameter: { PRECTOTCORR: 1, EVLAND: 9, T2M: 2, T2M_MIN: 0, T2M_MAX: 3 } });
    expect(computeMonthlyWaterDeficit([entry])[0]).toMatchObject({ waterDeficitMm: -70, missing: 4 });
  });
});

describe("computeIndicators: detecta la aridez que EVLAND esconde", () => {
  it("en un sitio árido, el balance con EVLAND parece equilibrado y el de evaporación potencial muestra un déficit grande", () => {
    const records = Array.from({ length: 30 }, (_, index) => day(`202107${String(index + 1).padStart(2, "0")}`, { T2M: 22, T2M_MIN: 12, T2M_MAX: 32, PRECTOTCORR: 0.5, EVLAND: 0.5 }));
    const real = computeIndicators(records);
    const potential = computeIndicators(records, 36.84);
    expect(real.waterBalanceMethod).toBe("evland");
    expect(real.waterDeficitMm).toBeCloseTo(0, 5);
    expect(potential.waterBalanceMethod).toBe("potential");
    expect(potential.waterDeficitMm).toBeLessThan(-100);
    expect(indicatorsSchema.safeParse(potential).success).toBe(true);
  });

  it("deja el balance en null con latitud pero sin temperaturas", () => {
    expect(computeIndicators([day("20200101", { PRECTOTCORR: 3, EVLAND: 1 })], 4.8).waterDeficitMm).toBeNull();
  });
});

describe("con la fixture real de Pereira", () => {
  let pereira: ClimateRecord[] = [];

  beforeAll(async () => {
    clearClimateCache();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    pereira = (await fetchDailyClimate({ lat: 4.8133, lon: -75.6961, startYear: 2020, endYear: 2022 })).records;
    vi.unstubAllGlobals();
  });

  it("estima una evaporación potencial mensual plausible para un sitio tropical de montaña (60–180 mm)", () => {
    for (const month of aggregateMonthly(pereira, 4.8133)) {
      expect(month.potentialEvaporationMm).toBeGreaterThan(60);
      expect(month.potentialEvaporationMm).toBeLessThan(180);
    }
  });

  it("sigue sin marcar sequía en promedio: Pereira es húmedo", () => {
    expect(computeIndicators(pereira, 4.8133).waterDeficitMm).toBeGreaterThan(0);
  });
});

describe("countYears", () => {
  it("cuenta los años distintos de la serie", () => {
    expect(countYears([day("20200101"), day("20200630"), day("20220101")])).toBe(2);
    expect(countYears([])).toBe(0);
  });
});

