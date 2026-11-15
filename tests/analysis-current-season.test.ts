import { describe, expect, it } from "vitest";
import { buildAnalysis } from "../src/lib/analysis";
import { CROPS } from "../src/lib/catalog";
import { analysisResponseSchema, type ClimateRecord, type ClimateResult, type UserPriorities } from "../src/types";

const PEREIRA = { lat: 4.8133, lon: -75.6961 };
const priorities: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };
const NO_MISSING = { T2M: 0, T2M_MIN: 0, T2M_MAX: 0, PRECTOTCORR: 0, EVLAND: 0, GWETROOT: 0, ALLSKY_SFC_SW_DWN: 0 };

function days(startIso: string, count: number, rain: number): ClimateRecord[] {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => ({
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10).replaceAll("-", ""),
    T2M: 20, T2M_MIN: 14, T2M_MAX: 27, PRECTOTCORR: rain, EVLAND: 3, GWETROOT: 0.8, ALLSKY_SFC_SW_DWN: 15,
  }));
}

const series = (years: number[], source: ClimateResult["source"] = "live"): ClimateResult => ({
  records: years.flatMap((year) => days(`${year}-01-01`, 365, 5)), source, missingByParameter: NO_MISSING, cellElevationMeters: 2138,
});
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023];
const recent = (rain: number): ClimateResult => ({ records: days("2026-10-01", 30, rain), source: "live", missingByParameter: NO_MISSING });
const gapsOf = (response: ReturnType<typeof buildAnalysis>) => response.rotations.map((result) => result.informationGaps.join(" "));

describe("buildAnalysis: temporada actual", () => {
  it("compara los últimos días con lo normal y lo incluye en una respuesta válida", () => {
    const response = buildAnalysis({ climate: series(YEARS), crops: CROPS, priorities, location: PEREIRA, recentClimate: recent(1) });
    expect(response.currentSeason).toMatchObject({ status: "much-drier", rainPercentOfNormal: 20, lastDate: "20261030" });
    expect(analysisResponseSchema.safeParse(response).success).toBe(true);
    expect(response.dataSources?.map(({ id }) => id)).toContain("power-recent");
  });

  it("sin clima reciente no hay temporada actual ni su fuente de datos", () => {
    const response = buildAnalysis({ climate: series(YEARS), crops: CROPS, priorities, location: PEREIRA });
    expect(response.currentSeason).toBeUndefined();
    expect(response.dataSources?.map(({ id }) => id)).not.toContain("power-recent");
  });

  it("con un escenario, la temporada actual se compara contra los datos originales de NASA", () => {
    const base = buildAnalysis({ climate: series(YEARS), crops: CROPS, priorities, location: PEREIRA, recentClimate: recent(1) });
    const scenario = buildAnalysis({ climate: series(YEARS), crops: CROPS, priorities, location: PEREIRA, recentClimate: recent(1), scenario: { rainFactor: 0.5 } });
    expect(scenario.currentSeason).toEqual(base.currentSeason);
  });
});

describe("buildAnalysis: avisos sobre la serie", () => {
  it("avisa cuando la serie trae menos años de los pedidos", () => {
    const response = buildAnalysis({ climate: series(YEARS), crops: CROPS, priorities, location: PEREIRA, requestedYears: 15 });
    for (const gaps of gapsOf(response)) expect(gaps).toContain("Se pidieron 15 años de clima y la serie trae 6");
  });

  it("no avisa si la serie cubre los años pedidos", () => {
    const response = buildAnalysis({ climate: series(YEARS), crops: CROPS, priorities, location: PEREIRA, requestedYears: YEARS.length });
    for (const gaps of gapsOf(response)) expect(gaps).not.toContain("Se pidieron");
  });

  it("avisa que los datos son una muestra guardada y hasta qué fecha llegan", () => {
    const response = buildAnalysis({ climate: series(YEARS, "sample"), crops: CROPS, priorities, location: PEREIRA });
    for (const gaps of gapsOf(response)) expect(gaps).toContain("muestra guardada de NASA POWER");
    for (const gaps of gapsOf(buildAnalysis({ climate: series(YEARS), crops: CROPS, priorities, location: PEREIRA }))) expect(gaps).not.toContain("muestra guardada");
  });
});
