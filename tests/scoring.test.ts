import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { computeIndicators } from "../src/lib/indicators";
import { clearClimateCache, fetchDailyClimate } from "../src/lib/nasaPower";
import { HEAT_DAYS_REFERENCE } from "../src/lib/config";
import { drynessFactor, scoreRotations } from "../src/lib/scoring";
import { cropSchema, rotationResultSchema, type Crop, type Indicators, type Rotation, type UserPriorities } from "../src/types";

const crops = (JSON.parse(readFileSync("tests/fixtures/crops-test.json", "utf8")) as unknown[]).map((crop) => cropSchema.parse(crop));
const powerFixture = JSON.parse(readFileSync("tests/fixtures/power-pereira.json", "utf8")) as unknown;

const NO_MISSING = { T2M: 0, T2M_MIN: 0, T2M_MAX: 0, PRECTOTCORR: 0, EVLAND: 0, GWETROOT: 0, ALLSKY_SFC_SW_DWN: 0 };
const WET: Indicators = { waterDeficitMm: 50, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 20, meanRootZoneWetness: 0.8, missingByParameter: NO_MISSING };
const DRY: Indicators = { ...WET, waterDeficitMm: -100 };
const NO_PRIORITIES: UserPriorities = { waterSaving: 0, extraIncome: 0, soilImprovement: 0, erosionReduction: 0, lowRisk: 0 };

const rotation = (id: string, ...cropIds: string[]): Rotation => ({ id, name: `Rotación ${id}`, cropIds, description: "Rotación de prueba" });
const only = (key: keyof UserPriorities): UserPriorities => ({ ...NO_PRIORITIES, [key]: 5 });
const scoreOf = (rotations: Rotation[], indicators: Indicators, priorities: UserPriorities, catalog: Crop[] = crops) =>
  scoreRotations({ rotations, crops: catalog, indicators, priorities }).map((result) => result.score);

describe("drynessFactor", () => {
  it("escala el déficit entre 0 y 1 y trata un balance positivo o nulo como sin sequía", () => {
    expect(drynessFactor(DRY)).toBe(1);
    expect(drynessFactor({ ...WET, waterDeficitMm: -50 })).toBe(0.5);
    expect(drynessFactor({ ...WET, waterDeficitMm: -500 })).toBe(1);
    expect(drynessFactor(WET)).toBe(0);
    expect(drynessFactor({ ...WET, waterDeficitMm: null })).toBe(0);
  });
});

describe("scoreRotations: puntaje", () => {
  it("premia al cultivo tolerante y castiga al exigente cuando hay sequía y la prioridad es ahorrar agua", () => {
    const [thirsty, tolerant] = scoreOf([rotation("a", "thirsty"), rotation("b", "tolerant")], DRY, only("waterSaving"));
    expect(tolerant).toBeCloseTo(4.5, 5);
    expect(thirsty).toBeCloseTo(0.1, 5);
  });

  it("sin déficit, el agua solo depende del uso de agua del cultivo", () => {
    const [thirsty, tolerant] = scoreOf([rotation("a", "thirsty"), rotation("b", "tolerant")], WET, only("waterSaving"));
    expect(thirsty).toBe(0);
    expect(tolerant).toBe(4);
  });

  it("promedia los cultivos de la rotación", () => {
    expect(scoreOf([rotation("mix", "thirsty", "tolerant")], DRY, only("waterSaving"))[0]).toBeCloseTo(2.3, 5);
  });

  it("usa pesos iguales cuando todas las prioridades son cero", () => {
    expect(scoreOf([rotation("b", "tolerant")], WET, NO_PRIORITIES)[0]).toBeCloseTo(3.2, 5);
  });

  it("normaliza los pesos: escalar todas las prioridades no cambia el resultado", () => {
    const low = { waterSaving: 1, extraIncome: 2, soilImprovement: 1, erosionReduction: 0, lowRisk: 1 };
    const high = { waterSaving: 2, extraIncome: 4, soilImprovement: 2, erosionReduction: 0, lowRisk: 2 };
    const rotations = [rotation("c", "legume")];
    expect(scoreOf(rotations, WET, high)[0]).toBeCloseTo(scoreOf(rotations, WET, low)[0], 10);
  });

  it("descuenta la penalización por calor según la tolerancia del cultivo", () => {
    const hot = { ...WET, heatStressDays: HEAT_DAYS_REFERENCE };
    expect(scoreOf([rotation("a", "thirsty")], hot, only("extraIncome"))[0]).toBeCloseTo(4.6, 5);
    expect(scoreOf([rotation("a", "thirsty")], WET, only("extraIncome"))[0]).toBe(5);
  });

  it("nunca baja de 0 aunque las penalizaciones superen el puntaje", () => {
    expect(scoreOf([rotation("a", "thirsty")], { ...DRY, heatStressDays: HEAT_DAYS_REFERENCE }, only("waterSaving"))[0]).toBe(0);
  });

  it("conserva el orden de entrada y devuelve vacío sin rotaciones", () => {
    const results = scoreRotations({ rotations: [rotation("z", "legume"), rotation("a", "cover")], crops, indicators: WET, priorities: NO_PRIORITIES });
    expect(results.map((result) => result.rotation.id)).toEqual(["z", "a"]);
    expect(scoreRotations({ rotations: [], crops, indicators: WET, priorities: NO_PRIORITIES })).toEqual([]);
  });
});

describe("scoreRotations: explicación honesta", () => {
  const rotations = [rotation("a", "thirsty"), rotation("b", "legume", "cover")];

  it("devuelve RotationResult válidos con evidencia NASA, fuente del cultivo, vacíos y riesgos", () => {
    const results = scoreRotations({ rotations, crops, indicators: { ...DRY, frostRiskDays: 3 }, priorities: only("soilImprovement") });
    for (const result of results) expect(rotationResultSchema.safeParse(result).success).toBe(true);
    const evidence = results[1].evidence.join(" ");
    expect(evidence).toContain("-100.0 mm/mes");
    expect(evidence).toContain("20.0 mm/día");
    expect(evidence).toContain("Datos sintéticos de prueba");
    expect(results[1].benefits.join(" ")).toContain("nitrógeno");
    expect(results[0].risks.join(" ")).toContain("helada");
    expect(results[0].risks.join(" ")).toContain("sequía");
    expect(results[1].informationGaps.join(" ")).toContain("suelo");
    expect(results[1].validateWithLocalExpert.length).toBeGreaterThan(0);
  });

  it("explica el puntaje con las prioridades que más pesan", () => {
    const [result] = scoreRotations({ rotations: [rotation("b", "legume", "cover")], crops, indicators: WET, priorities: only("soilImprovement") });
    expect(result.whySuggested).toContain("Mejora del suelo");
    expect(result.whySuggested).toContain("apoyo a la decisión");
  });

  it("reporta como vacío un balance hídrico ausente y los días faltantes de NASA", () => {
    const gaps = scoreRotations({
      rotations, crops, priorities: NO_PRIORITIES, indicators: { ...WET, waterDeficitMm: null, missingByParameter: { ...NO_MISSING, GWETROOT: 12 } },
    })[0].informationGaps.join(" ");
    expect(gaps).toContain("balance hídrico");
    expect(gaps).toContain("12 días");
    expect(gaps).toContain("GWETROOT");
  });

  it("siempre incluye un riesgo y un vacío aunque todo salga bien", () => {
    const [result] = scoreRotations({ rotations: [rotation("c", "cover")], crops, indicators: WET, priorities: NO_PRIORITIES });
    expect(result.risks.length).toBeGreaterThan(0);
    expect(result.informationGaps.length).toBeGreaterThan(0);
  });
});

describe("scoreRotations: errores", () => {
  it("falla con un mensaje claro si la rotación usa un cultivo fuera del catálogo", () => {
    expect(() => scoreOf([rotation("x", "maiz")], WET, NO_PRIORITIES)).toThrow('El cultivo "maiz" no existe en el catálogo');
  });

  it("falla si la rotación no tiene cultivos", () => {
    expect(() => scoreOf([rotation("vacia")], WET, NO_PRIORITIES)).toThrow("no tiene cultivos");
  });
});

describe("scoreRotations con indicadores reales de Pereira", () => {
  let pereira: Indicators;

  beforeAll(async () => {
    clearClimateCache();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(powerFixture), { status: 200 })));
    pereira = computeIndicators((await fetchDailyClimate({ lat: 4.8133, lon: -75.6961, startYear: 2020, endYear: 2022 })).records);
    vi.unstubAllGlobals();
  });

  it("no inventa sequía: el balance medio es positivo y los puntajes caen en 0–5", () => {
    expect(drynessFactor(pereira)).toBe(0);
    const results = scoreRotations({ rotations: [rotation("a", "thirsty"), rotation("b", "legume", "cover")], crops, indicators: pereira, priorities: only("erosionReduction") });
    for (const { score } of results) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(5);
    }
    expect(results[1].score).toBeGreaterThan(results[0].score);
    expect(results[1].evidence.join(" ")).toContain("17.4 mm/día");
  });
});
