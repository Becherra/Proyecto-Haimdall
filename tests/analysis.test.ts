import { describe, expect, it } from "vitest";
import { AnalysisInputError, buildAnalysis, isInSowingCalendarRegion } from "../src/lib/analysis";
import { CROPS } from "../src/lib/catalog";
import { aggregateMonthly, computeIndicators } from "../src/lib/indicators";
import { DEFAULT_CURRENT_CROP_ID } from "../src/lib/config";
import { analysisResponseSchema, type ClimateRecord, type ClimateResult, type UserPriorities } from "../src/types";

const PEREIRA = { lat: 4.8133, lon: -75.6961 };
const MENDOZA = { lat: -32.89, lon: -68.84 };
const priorities: UserPriorities = { waterSaving: 4, extraIncome: 2, soilImprovement: 3, erosionReduction: 3, lowRisk: 2 };

function record(date: string, overrides: Partial<ClimateRecord> = {}): ClimateRecord {
  return { date, T2M: 20, T2M_MIN: 14, T2M_MAX: 27, PRECTOTCORR: 5, EVLAND: 3, GWETROOT: 0.8, ALLSKY_SFC_SW_DWN: 15, ...overrides };
}

function climateWith(overrides: Partial<ClimateRecord> = {}, monthCount = 2): ClimateResult {
  const records = Array.from({ length: monthCount }, (_, index) => index + 1).flatMap((month) => Array.from({ length: 28 }, (_, day) => record(`2021${String(month).padStart(2, "0")}${String(day + 1).padStart(2, "0")}`, overrides)));
  const missing = (name: keyof ClimateRecord) => (overrides[name] === null ? records.length : 0);
  return {
    records, source: "live",
    missingByParameter: { T2M: missing("T2M"), T2M_MIN: missing("T2M_MIN"), T2M_MAX: missing("T2M_MAX"), PRECTOTCORR: missing("PRECTOTCORR"), EVLAND: missing("EVLAND"), GWETROOT: missing("GWETROOT"), ALLSKY_SFC_SW_DWN: missing("ALLSKY_SFC_SW_DWN") },
  };
}

describe("buildAnalysis: rotaciones comparadas", () => {
  it("devuelve la línea base primero y dos alternativas, con el cultivo actual por defecto", () => {
    const response = buildAnalysis({ climate: climateWith(), crops: CROPS, priorities, location: PEREIRA });
    expect(response.rotations.map((result) => result.rotation.id)).toEqual(["baseline", "legume", "cover-drought"]);
    expect(response.rotations[0].rotation.cropIds).toEqual([DEFAULT_CURRENT_CROP_ID]);
  });

  it("usa el cultivo actual declarado por el agricultor como línea base y dentro de cada alternativa", () => {
    const response = buildAnalysis({ climate: climateWith(), crops: CROPS, priorities: { ...priorities, currentCropId: "yuca" }, location: PEREIRA });
    expect(response.rotations[0].rotation.cropIds).toEqual(["yuca"]);
    for (const result of response.rotations) expect(result.rotation.cropIds).toContain("yuca");
  });

  it("no deja que el monocultivo le gane a la rotación que lo combina con otra familia", () => {
    // Antes, con fríjol como cultivo actual, el fríjol solo superaba a "maíz → fríjol".
    const response = buildAnalysis({ climate: climateWith(), crops: CROPS, priorities: { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3, currentCropId: "frijol" }, location: PEREIRA });
    const [baseline, legume] = response.rotations;
    expect(legume.score).toBeGreaterThan(baseline.score);
    expect(baseline.risks.join(" ")).toContain("monocultivo");
  });

  it("elige alternativas distintas según las prioridades del agricultor", () => {
    const only = (key: "extraIncome" | "soilImprovement"): UserPriorities => ({ waterSaving: 0, extraIncome: 0, soilImprovement: 0, erosionReduction: 0, lowRisk: 0, [key]: 5 });
    const analyze = (chosen: UserPriorities) => buildAnalysis({ climate: climateWith(), crops: CROPS, priorities: chosen, location: PEREIRA }).rotations[1].rotation.cropIds;
    expect(analyze(only("extraIncome"))).not.toEqual(analyze(only("soilImprovement")));
  });
});

describe("buildAnalysis", () => {
  it("une clima, indicadores y puntuación en una respuesta válida con 3 rotaciones", () => {
    const climate = climateWith();
    const response = buildAnalysis({ climate, crops: CROPS, priorities, location: PEREIRA });
    expect(analysisResponseSchema.safeParse(response).success).toBe(true);
    expect(response.rotations).toHaveLength(3);
    // La respuesta lleva el resumen de la serie; los registros diarios solo van si se piden (includeDailyRecords).
    expect(response.climate).toMatchObject({ source: climate.source, missingByParameter: climate.missingByParameter, daysAnalyzed: climate.records.length });
    expect(response.climate.records).toBeUndefined();
  });

  it("calcula indicadores y resumen mensual a partir de los registros diarios", () => {
    const climate = climateWith();
    const response = buildAnalysis({ climate, crops: CROPS, priorities, location: PEREIRA });
    expect(response.indicators).toEqual(computeIndicators(climate.records, PEREIRA.lat));
    expect(response.monthlyClimate).toEqual(aggregateMonthly(climate.records, PEREIRA.lat));
    expect(response.monthlyClimate).toHaveLength(2);
  });

  it("cruza el calendario de siembra con la lluvia mensual en cada rotación cuando hay un año completo", () => {
    const response = buildAnalysis({ climate: climateWith({}, 12), crops: CROPS, priorities, location: PEREIRA });
    for (const result of response.rotations) {
      expect(result.evidence.join(" ")).toContain("Siembra de");
      expect(result.informationGaps.join(" ")).not.toContain("no se cruzó");
    }
  });

  it("reporta como vacío los meses de siembra sin dato de lluvia cuando la serie no los cubre", () => {
    const response = buildAnalysis({ climate: climateWith(), crops: CROPS, priorities, location: PEREIRA });
    for (const result of response.rotations) expect(result.informationGaps.join(" ")).toContain("sin dato de lluvia");
  });

  it("calcula el balance hídrico con evaporación potencial estimada a la latitud del sitio", () => {
    const response = buildAnalysis({ climate: climateWith(), crops: CROPS, priorities, location: PEREIRA });
    expect(response.indicators.waterBalanceMethod).toBe("potential");
    expect(response.monthlyClimate.every((month) => typeof month.potentialEvaporationMm === "number")).toBe(true);
    for (const result of response.rotations) expect(result.evidence.join(" ")).toContain("Hargreaves");
  });

  it("pasa los conteos de días a días por año según los años que cubre la serie", () => {
    const response = buildAnalysis({ climate: climateWith({ T2M_MAX: 36 }), crops: CROPS, priorities, location: PEREIRA });
    expect(response.rotations[0].evidence.join(" ")).toContain("en 1 año");
  });

  it("no cruza el calendario del catálogo fuera de la zona piloto y lo declara como vacío", () => {
    const response = buildAnalysis({ climate: climateWith({}, 12), crops: CROPS, priorities, location: MENDOZA });
    for (const result of response.rotations) {
      expect(result.evidence.join(" ")).not.toContain("Siembra de");
      expect(result.informationGaps.join(" ")).toContain("Eje Cafetero");
    }
  });

  it("puntúa la línea base con el cultivo actual declarado", () => {
    const response = buildAnalysis({ climate: climateWith(), crops: CROPS, priorities: { ...priorities, currentCropId: "frijol" }, location: PEREIRA });
    expect(response.rotations[0].rotation.cropIds).toEqual(["frijol"]);
    for (const result of response.rotations) expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("propaga los datos faltantes a los indicadores y a los vacíos de información", () => {
    const response = buildAnalysis({ climate: climateWith({ GWETROOT: null }), crops: CROPS, priorities, location: PEREIRA });
    expect(response.indicators.meanRootZoneWetness).toBeNull();
    expect(response.indicators.missingByParameter.GWETROOT).toBe(56);
    for (const result of response.rotations) expect(result.informationGaps.some((gap) => gap.includes("GWETROOT"))).toBe(true);
  });

  it("lanza AnalysisInputError si no hay registros climáticos", () => {
    const climate: ClimateResult = { records: [], source: "live", missingByParameter: {} };
    expect(() => buildAnalysis({ climate, crops: CROPS, priorities, location: PEREIRA })).toThrow(AnalysisInputError);
  });

  it("lanza AnalysisInputError si el cultivo actual no existe", () => {
    expect(() => buildAnalysis({ climate: climateWith(), crops: CROPS, priorities: { ...priorities, currentCropId: "cafe" }, location: PEREIRA })).toThrow(AnalysisInputError);
  });
});

describe("isInSowingCalendarRegion", () => {
  it("incluye el Eje Cafetero (Pereira, Manizales, Armenia)", () => {
    expect(isInSowingCalendarRegion(4.8133, -75.6961)).toBe(true);
    expect(isInSowingCalendarRegion(5.07, -75.52)).toBe(true);
    expect(isInSowingCalendarRegion(4.53, -75.68)).toBe(true);
  });

  it("excluye otras regiones de Colombia y del mundo", () => {
    expect(isInSowingCalendarRegion(4.71, -74.07)).toBe(false);
    expect(isInSowingCalendarRegion(6.25, -75.56)).toBe(false);
    expect(isInSowingCalendarRegion(-32.89, -68.84)).toBe(false);
    expect(isInSowingCalendarRegion(13.51, 2.11)).toBe(false);
  });
});
