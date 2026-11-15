import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HEAT_DAYS_REFERENCE } from "../src/lib/config";
import { scoreRotations } from "../src/lib/scoring";
import { cropSchema, type Indicators, type Rotation, type UserPriorities } from "../src/types";

const crops = (JSON.parse(readFileSync("tests/fixtures/crops-test.json", "utf8")) as unknown[]).map((crop) => cropSchema.parse(crop));
const NO_MISSING = { T2M: 0, T2M_MIN: 0, T2M_MAX: 0, PRECTOTCORR: 0, EVLAND: 0, GWETROOT: 0, ALLSKY_SFC_SW_DWN: 0 };
const WET: Indicators = { waterDeficitMm: 50, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 20, meanRootZoneWetness: 0.8, missingByParameter: NO_MISSING };
const INCOME_ONLY: UserPriorities = { waterSaving: 0, extraIncome: 5, soilImprovement: 0, erosionReduction: 0, lowRisk: 0 };
const thirsty: Rotation = { id: "a", name: "Rotación a", cropIds: ["thirsty"], description: "Cultivo exigente" };

// El cultivo exigente tiene ingresos 5 y tolerancia al calor 1: sin descuentos saca 5 y el descuento máximo por calor es 0.4.
const scoreWith = (indicators: Indicators, yearsAnalyzed?: number) => scoreRotations({ rotations: [thirsty], crops, indicators, priorities: INCOME_ONLY, yearsAnalyzed })[0];
const hot = (days: number): Indicators => ({ ...WET, heatStressDays: days });

describe("calor: se mide en días por año, no en el total de la serie", () => {
  it("el descuento máximo llega cuando los días al año alcanzan la referencia", () => {
    expect(scoreWith(hot(HEAT_DAYS_REFERENCE), 1).score).toBeCloseTo(4.6, 5);
  });

  it("la misma cantidad de días repartida en más años pesa menos", () => {
    expect(scoreWith(hot(HEAT_DAYS_REFERENCE * 10), 10).score).toBeCloseTo(4.6, 5);
    expect(scoreWith(hot(HEAT_DAYS_REFERENCE), 10).score).toBeCloseTo(4.96, 5);
  });

  it("no se satura con pocos días: un clima más caluroso saca menos puntaje que uno menos caluroso", () => {
    const perYear = (days: number) => scoreWith(hot(days * 10), 10).score;
    expect(perYear(10)).toBeGreaterThan(perYear(30));
    expect(perYear(30)).toBeGreaterThan(perYear(60));
  });

  it("sin years analizados se asume un año (compatibilidad) y nunca divide entre cero", () => {
    expect(scoreWith(hot(HEAT_DAYS_REFERENCE)).score).toBeCloseTo(4.6, 5);
    expect(scoreWith(hot(HEAT_DAYS_REFERENCE), 0).score).toBeCloseTo(4.6, 5);
  });

  it("explica en la evidencia el total, los años y el promedio al año", () => {
    const result = scoreWith({ ...hot(1907), frostRiskDays: 112 }, 10);
    const evidence = result.evidence.join(" ");
    expect(evidence).toContain("1907 en 10 años (≈191 al año)");
    expect(evidence).toContain("112 en 10 años (≈11 al año)");
    expect(result.whySuggested).toContain("≈191 días al año");
  });
});

describe("balance hídrico: la evidencia dice con qué se calculó", () => {
  const evidenceOf = (indicators: Indicators) => scoreWith(indicators).evidence.join(" ");

  it("con evaporación potencial estimada lo declara como estimación y cita la fórmula", () => {
    const evidence = evidenceOf({ ...WET, waterDeficitMm: -100, waterBalanceMethod: "potential" });
    expect(evidence).toContain("-100.0 mm/mes");
    expect(evidence).toContain("Hargreaves");
    expect(evidence).toContain("estimad");
    expect(evidence).not.toContain("EVLAND");
  });

  it("con EVLAND o sin método (datos previos) conserva la descripción original", () => {
    expect(evidenceOf({ ...WET, waterBalanceMethod: "evland" })).toContain("EVLAND");
    expect(evidenceOf(WET)).toContain("EVLAND");
  });
});

describe("calendario de siembra no aplicado", () => {
  it("sin estacionalidad el vacío explica que el catálogo solo es válido en la zona piloto", () => {
    const gaps = scoreWith(WET).informationGaps.join(" ");
    expect(gaps).toContain("no se cruzó");
    expect(gaps).toContain("Eje Cafetero");
  });
});
