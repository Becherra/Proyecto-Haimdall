import { describe, expect, it } from "vitest";
import { AnalysisInputError, buildAnalysis, buildRotations } from "../src/lib/analysis";
import { CROPS } from "../src/lib/catalog";
import { aggregateMonthly, computeIndicators } from "../src/lib/indicators";
import { DEFAULT_CURRENT_CROP_ID } from "../src/lib/config";
import { analysisResponseSchema, type ClimateRecord, type ClimateResult, type UserPriorities } from "../src/types";

const priorities: UserPriorities = { waterSaving: 4, extraIncome: 2, soilImprovement: 3, erosionReduction: 3, lowRisk: 2 };

function record(date: string, overrides: Partial<ClimateRecord> = {}): ClimateRecord {
  return { date, T2M: 20, T2M_MIN: 14, T2M_MAX: 27, PRECTOTCORR: 5, EVLAND: 3, GWETROOT: 0.8, ALLSKY_SFC_SW_DWN: 15, ...overrides };
}

function climateWith(overrides: Partial<ClimateRecord> = {}): ClimateResult {
  const records = [1, 2].flatMap((month) => Array.from({ length: 28 }, (_, day) => record(`2021${String(month).padStart(2, "0")}${String(day + 1).padStart(2, "0")}`, overrides)));
  const missing = (name: keyof ClimateRecord) => (overrides[name] === null ? records.length : 0);
  return {
    records, source: "live",
    missingByParameter: { T2M: missing("T2M"), T2M_MIN: missing("T2M_MIN"), T2M_MAX: missing("T2M_MAX"), PRECTOTCORR: missing("PRECTOTCORR"), EVLAND: missing("EVLAND"), GWETROOT: missing("GWETROOT"), ALLSKY_SFC_SW_DWN: missing("ALLSKY_SFC_SW_DWN") },
  };
}

describe("buildRotations", () => {
  it("devuelve la línea base primero y dos alternativas, con el cultivo actual por defecto", () => {
    const rotations = buildRotations(CROPS, undefined);
    expect(rotations.map((rotation) => rotation.id)).toEqual(["baseline", "legume", "cover-drought"]);
    expect(rotations[0].cropIds).toEqual([DEFAULT_CURRENT_CROP_ID]);
  });

  it("usa el cultivo actual declarado por el agricultor como línea base", () => {
    expect(buildRotations(CROPS, "yuca")[0].cropIds).toEqual(["yuca"]);
  });

  it("lanza AnalysisInputError si el cultivo actual no está en el catálogo", () => {
    expect(() => buildRotations(CROPS, "cafe")).toThrow(AnalysisInputError);
  });
});

describe("buildAnalysis", () => {
  it("une clima, indicadores y puntuación en una respuesta válida con 3 rotaciones", () => {
    const climate = climateWith();
    const response = buildAnalysis({ climate, crops: CROPS, priorities });
    expect(analysisResponseSchema.safeParse(response).success).toBe(true);
    expect(response.rotations).toHaveLength(3);
    expect(response.climate).toBe(climate);
  });

  it("calcula indicadores y resumen mensual a partir de los registros diarios", () => {
    const climate = climateWith();
    const response = buildAnalysis({ climate, crops: CROPS, priorities });
    expect(response.indicators).toEqual(computeIndicators(climate.records));
    expect(response.monthlyClimate).toEqual(aggregateMonthly(climate.records));
    expect(response.monthlyClimate).toHaveLength(2);
  });

  it("puntúa la línea base con el cultivo actual declarado", () => {
    const response = buildAnalysis({ climate: climateWith(), crops: CROPS, priorities: { ...priorities, currentCropId: "frijol" } });
    expect(response.rotations[0].rotation.cropIds).toEqual(["frijol"]);
    for (const result of response.rotations) expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("propaga los datos faltantes a los indicadores y a los vacíos de información", () => {
    const response = buildAnalysis({ climate: climateWith({ GWETROOT: null }), crops: CROPS, priorities });
    expect(response.indicators.meanRootZoneWetness).toBeNull();
    expect(response.indicators.missingByParameter.GWETROOT).toBe(56);
    for (const result of response.rotations) expect(result.informationGaps.some((gap) => gap.includes("GWETROOT"))).toBe(true);
  });

  it("lanza AnalysisInputError si no hay registros climáticos", () => {
    const climate: ClimateResult = { records: [], source: "live", missingByParameter: {} };
    expect(() => buildAnalysis({ climate, crops: CROPS, priorities })).toThrow(AnalysisInputError);
  });

  it("lanza AnalysisInputError si el cultivo actual no existe", () => {
    expect(() => buildAnalysis({ climate: climateWith(), crops: CROPS, priorities: { ...priorities, currentCropId: "cafe" } })).toThrow(AnalysisInputError);
  });
});
