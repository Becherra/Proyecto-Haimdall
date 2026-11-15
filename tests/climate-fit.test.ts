import { describe, expect, it } from "vitest";
import { buildAnalysis } from "../src/lib/analysis";
import { CROPS } from "../src/lib/catalog";
import { temperatureSuitability } from "../src/lib/climateFit";
import { DEFAULT_TEMPERATURE_MARGIN_C, FROST_DAYS_REFERENCE, MAX_FROST_PENALTY, MAX_TEMPERATURE_PENALTY, MAX_WATER_SCARCITY_PENALTY } from "../src/lib/config";
import { computeIndicators } from "../src/lib/indicators";
import { scoreRotations } from "../src/lib/scoring";
import type { ClimateRecord, ClimateResult, Crop, Indicators, Rotation, UserPriorities } from "../src/types";

function crop(id: string, overrides: Partial<Crop> = {}): Crop {
  return {
    id, name: `${id} (Especie ${id})`, waterUse: 2, nitrogenFixation: 0, erosionReduction: 2, organicMatter: 2, forageValue: 2, marketPotential: 3,
    heatTolerance: 3, droughtTolerance: 3, cycleDays: 100, sowingMonths: [3, 9], source: "Cultivo de prueba", ...overrides,
  };
}

const EQUAL: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };
const site = (overrides: Partial<Indicators> = {}): Indicators => ({ waterDeficitMm: 40, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 15, meanRootZoneWetness: 0.8, missingByParameter: {}, meanTemperatureC: 20, ...overrides });
const rotation = (id: string, ...cropIds: string[]): Rotation => ({ id, name: id, cropIds, description: "Rotación de prueba" });

describe("temperatureSuitability", () => {
  const range = { limitMin: 10, goodMin: 18, goodMax: 30, limitMax: 35 };

  it("vale 1 dentro del rango en que el cultivo crece bien, incluidos los bordes", () => {
    for (const temperature of [18, 24, 30]) expect(temperatureSuitability(range, temperature)).toBe(1);
  });

  it("baja en línea recta entre el rango bueno y el límite, por el lado frío y por el caliente", () => {
    expect(temperatureSuitability(range, 14)).toBeCloseTo(0.5);
    expect(temperatureSuitability(range, 32.5)).toBeCloseTo(0.5);
  });

  it("vale 0 en el límite y más allá", () => {
    for (const temperature of [10, 4, 35, 41]) expect(temperatureSuitability(range, temperature)).toBe(0);
  });

  it("no evalúa el lado caliente si la fuente no da un máximo", () => {
    expect(temperatureSuitability({ limitMin: 10, goodMin: 15 }, 38)).toBe(1);
  });

  it("usa el margen por defecto cuando la fuente da el rango bueno pero no el límite", () => {
    const half = DEFAULT_TEMPERATURE_MARGIN_C / 2;
    expect(temperatureSuitability({ goodMin: 19, goodMax: 27 }, 19 - half)).toBeCloseTo(0.5);
    expect(temperatureSuitability({ goodMin: 19, goodMax: 27 }, 27 + half)).toBeCloseTo(0.5);
    expect(temperatureSuitability({ goodMin: 19, goodMax: 27 }, 19 - DEFAULT_TEMPERATURE_MARGIN_C)).toBe(0);
  });
});

describe("computeIndicators: temperatura media", () => {
  const record = (date: string, T2M: number | null): ClimateRecord => ({ date, T2M, T2M_MIN: 10, T2M_MAX: 25, PRECTOTCORR: 5, EVLAND: 3, GWETROOT: 0.8, ALLSKY_SFC_SW_DWN: 15 });

  it("promedia T2M sobre los días con dato", () => {
    expect(computeIndicators([record("20210101", 16), record("20210102", 18), record("20210103", null)]).meanTemperatureC).toBeCloseTo(17);
  });

  it("queda en null si ningún día tiene T2M", () => {
    expect(computeIndicators([record("20210101", null)]).meanTemperatureC).toBeNull();
  });
});

describe("scoreRotations: aptitud térmica", () => {
  const ranged = crop("ranged", { temperatureC: { limitMin: 10, goodMin: 18, goodMax: 30, limitMax: 35 } });
  const catalog = [ranged, crop("norange")];
  const score = (indicators: Indicators, ...cropIds: string[]) => scoreRotations({ rotations: [rotation("r", ...cropIds)], crops: catalog, indicators, priorities: EQUAL })[0];

  it("descuenta en proporción a qué tan lejos está el sitio del rango del cultivo", () => {
    const fit = score(site({ meanTemperatureC: 20 }), "ranged");
    const halfway = score(site({ meanTemperatureC: 14 }), "ranged");
    const outside = score(site({ meanTemperatureC: 8 }), "ranged");
    expect(fit.score - halfway.score).toBeCloseTo(MAX_TEMPERATURE_PENALTY / 2, 2);
    expect(fit.score - outside.score).toBeCloseTo(MAX_TEMPERATURE_PENALTY, 2);
  });

  it("explica el desajuste como riesgo y muestra la temperatura del sitio y el rango como evidencia", () => {
    const cold = score(site({ meanTemperatureC: 14 }), "ranged");
    expect(cold.risks.join(" ")).toContain("por debajo");
    expect(cold.evidence.join(" ")).toContain("Temperatura media del sitio: 14.0 °C");
    expect(cold.evidence.join(" ")).toContain("18–30 °C");
    expect(cold.whySuggested).toContain("temperatura");
    expect(score(site({ meanTemperatureC: 33 }), "ranged").risks.join(" ")).toContain("por encima");
  });

  it("advierte siempre que la temperatura es de la celda de NASA POWER y no del lote", () => {
    expect(score(site(), "ranged").informationGaps.join(" ")).toContain("celda");
  });

  it("no penaliza a un cultivo sin rango en el catálogo y lo declara como vacío", () => {
    const warm = score(site({ meanTemperatureC: 20 }), "norange");
    const cold = score(site({ meanTemperatureC: 2 }), "norange");
    expect(cold.score).toBe(warm.score);
    expect(cold.informationGaps.join(" ")).toContain("rango de temperatura");
  });

  it("no penaliza si no hay temperatura media del sitio y lo declara como vacío", () => {
    const unknown = score(site({ meanTemperatureC: null }), "ranged");
    expect(unknown.score).toBe(score(site({ meanTemperatureC: 20 }), "ranged").score);
    expect(unknown.informationGaps.join(" ")).toContain("temperatura media");
  });
});

describe("scoreRotations: heladas", () => {
  const catalog = [crop("tender"), crop("hardy", { frostToleranceC: -6 })];
  const frosty = site({ frostRiskDays: FROST_DAYS_REFERENCE * 2 });
  const score = (indicators: Indicators, ...cropIds: string[]) => scoreRotations({ rotations: [rotation("r", ...cropIds)], crops: catalog, indicators, priorities: EQUAL, yearsAnalyzed: 2 })[0];

  it("descuenta la penalización completa a un cultivo sin tolerancia documentada cuando hiela con frecuencia", () => {
    expect(score(site(), "tender").score - score(frosty, "tender").score).toBeCloseTo(MAX_FROST_PENALTY, 2);
  });

  it("no descuenta a un cultivo con tolerancia a heladas documentada", () => {
    expect(score(frosty, "hardy").score).toBe(score(site(), "hardy").score);
  });

  it("descuenta la mitad si solo la mitad de la rotación está desprotegida, y nombra a ese cultivo en el riesgo", () => {
    const mixed = score(frosty, "tender", "hardy");
    expect(score(site(), "tender", "hardy").score - mixed.score).toBeCloseTo(MAX_FROST_PENALTY / 2, 2);
    const frostRisk = mixed.risks.find((risk) => risk.includes("helada")) ?? "";
    expect(frostRisk).toContain("tender");
    expect(frostRisk).not.toContain("hardy");
  });
});

describe("scoreRotations: disponibilidad de agua declarada", () => {
  const catalog = [crop("thirsty", { waterUse: 5, droughtTolerance: 0 }), crop("frugal", { waterUse: 0, droughtTolerance: 0 })];
  const score = (indicators: Indicators, waterAvailability: UserPriorities["waterAvailability"], cropId: string) =>
    scoreRotations({ rotations: [rotation("r", cropId)], crops: catalog, indicators, priorities: { ...EQUAL, waterAvailability } })[0];

  it("con poca agua descuenta a los cultivos de alto consumo aunque el sitio sea húmedo", () => {
    expect(score(site(), "medium", "thirsty").score - score(site(), "low", "thirsty").score).toBeCloseTo(MAX_WATER_SCARCITY_PENALTY, 2);
    expect(score(site(), "low", "frugal").score).toBe(score(site(), "medium", "frugal").score);
  });

  it("no cambia nada si el agricultor no declara disponibilidad o declara media", () => {
    expect(score(site(), undefined, "thirsty").score).toBe(score(site(), "medium", "thirsty").score);
  });

  it("con agua abundante reduce la penalización por sequía en un sitio seco, y con poca la aumenta", () => {
    const dry = site({ waterDeficitMm: -100 });
    const [low, medium, high] = (["low", "medium", "high"] as const).map((level) => score(dry, level, "frugal").score);
    expect(high).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(low);
  });

  it("muestra como evidencia la disponibilidad declarada", () => {
    expect(score(site(), "low", "thirsty").evidence.join(" ")).toContain("Disponibilidad de agua declarada");
    expect(score(site(), undefined, "thirsty").evidence.join(" ")).not.toContain("Disponibilidad de agua declarada");
  });
});

describe("buildAnalysis: el clima del sitio cambia los cultivos sugeridos", () => {
  function climateAt(T2M: number, T2M_MIN: number, T2M_MAX: number): ClimateResult {
    const records = Array.from({ length: 12 }, (_, month) => Array.from({ length: 28 }, (_, day): ClimateRecord => ({
      date: `2021${String(month + 1).padStart(2, "0")}${String(day + 1).padStart(2, "0")}`, T2M, T2M_MIN, T2M_MAX, PRECTOTCORR: 5, EVLAND: 3, GWETROOT: 0.8, ALLSKY_SFC_SW_DWN: 15,
    }))).flat();
    return { records, source: "live", missingByParameter: {} };
  }
  const PEREIRA = { lat: 4.8133, lon: -75.6961 };
  const analyze = (climate: ClimateResult, currentCropId: string) => buildAnalysis({ climate, crops: CROPS, priorities: { ...EQUAL, currentCropId }, location: PEREIRA }).rotations;

  it("en un sitio frío no acompaña la papa con soya, que necesita calor", () => {
    const [, legume] = analyze(climateAt(12, 6, 18), "papa");
    expect(legume.rotation.cropIds).not.toContain("soya");
    expect(["arveja", "frijol"]).toContain(legume.rotation.cropIds[1]);
  });

  it("en un sitio cálido no acompaña el maíz con arveja, que es de clima frío", () => {
    const [, legume] = analyze(climateAt(26, 20, 32), "maiz");
    expect(legume.rotation.cropIds[1]).toBe("soya");
  });

  it("le avisa al agricultor cuando su cultivo actual queda fuera de su rango de temperatura", () => {
    const [baseline] = analyze(climateAt(26, 20, 32), "papa");
    expect(baseline.risks.join(" ")).toContain("por encima");
  });
});
