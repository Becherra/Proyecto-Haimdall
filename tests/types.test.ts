import { describe, expect, it } from "vitest";
import { analysisResponseSchema, climateRecordSchema, cropSchema, rotationResultSchema, userPrioritiesSchema } from "../src/types";

const rotation = { id: "base", name: "Actual", cropIds: ["maiz"], description: "Línea base" };

describe("contratos de datos", () => {
  it("acepta un registro climático válido y rechaza una fecha inválida", () => {
    const record = { date: "20200101", T2M: 16, T2M_MIN: 10, T2M_MAX: 22, PRECTOTCORR: 5, EVLAND: 3, GWETROOT: 0.6, ALLSKY_SFC_SW_DWN: 12 };
    expect(climateRecordSchema.safeParse(record).success).toBe(true);
    expect(climateRecordSchema.safeParse({ ...record, date: "2020-01-01" }).success).toBe(false);
  });

  it("valida prioridades dentro de la escala definida", () => {
    const priorities = { waterSaving: 5, extraIncome: 3, soilImprovement: 4, erosionReduction: 2, lowRisk: 1 };
    expect(userPrioritiesSchema.parse(priorities).waterSaving).toBe(5);
    expect(userPrioritiesSchema.safeParse({ ...priorities, lowRisk: 6 }).success).toBe(false);
  });

  it("exige rotaciones completas y al menos tres en el análisis", () => {
    const result = { rotation, score: 4, whySuggested: "Conserva suelo", evidence: ["NASA POWER"], benefits: ["Menor erosión"], informationGaps: ["Suelo local"], risks: ["Mercado"], validateWithLocalExpert: ["Validar fechas"] };
    expect(rotationResultSchema.safeParse(result).success).toBe(true);
    const response = { climate: { records: [], missingByParameter: {}, source: "sample" }, monthlyClimate: [], indicators: { waterDeficitMm: 1, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 2, meanRootZoneWetness: 0.5, missingByParameter: {} }, rotations: [result, result] };
    expect(analysisResponseSchema.safeParse(response).success).toBe(false);
  });
});

describe("userPrioritiesSchema · noCurrentCrop", () => {
  const base = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };
  it("acepta la declaración de que no hay cultivo actual", () => {
    expect(userPrioritiesSchema.safeParse({ ...base, noCurrentCrop: true }).success).toBe(true);
  });
  it("rechaza un valor que no sea booleano", () => {
    expect(userPrioritiesSchema.safeParse({ ...base, noCurrentCrop: "si" }).success).toBe(false);
  });
});

describe("cropSchema: cultivos permanentes", () => {
  const base = { id: "cafe", name: "Café (Coffea arabica)", waterUse: 3, nitrogenFixation: 0, erosionReduction: 3, organicMatter: 3, forageValue: 0, marketPotential: 4, heatTolerance: 2, droughtTolerance: 2, cycleDays: 365, sowingMonths: [], source: "prueba" };

  it("acepta un cultivo permanente sin meses de siembra y la lista de permanentes con los que se asocia un anual", () => {
    expect(cropSchema.safeParse({ ...base, perennial: true }).success).toBe(true);
    expect(cropSchema.safeParse({ ...base, id: "frijol", sowingMonths: [3, 9], intercropsWith: ["cafe"] }).success).toBe(true);
  });

  it("los dos campos son opcionales para no romper catálogos anteriores y rechaza ids vacíos", () => {
    expect(cropSchema.safeParse(base).success).toBe(true);
    expect(cropSchema.safeParse({ ...base, intercropsWith: [""] }).success).toBe(false);
    expect(cropSchema.safeParse({ ...base, perennial: "si" }).success).toBe(false);
  });
});
