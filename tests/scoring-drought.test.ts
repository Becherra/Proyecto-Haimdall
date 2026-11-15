import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DRYNESS_REFERENCE_MM, DRY_SPELL_ALERT_DAYS, MAX_RISK_PENALTY, MIN_YEARS_FOR_WORST_YEAR, WORST_YEAR_DROUGHT_WEIGHT } from "../src/lib/config";
import { scoreRotations } from "../src/lib/scoring";
import { cropSchema, type Indicators, type Rotation, type UserPriorities } from "../src/types";

const crops = (JSON.parse(readFileSync("tests/fixtures/crops-test.json", "utf8")) as unknown[]).map((crop) => cropSchema.parse(crop));
const NO_MISSING = { T2M: 0, T2M_MIN: 0, T2M_MAX: 0, PRECTOTCORR: 0, EVLAND: 0, GWETROOT: 0, ALLSKY_SFC_SW_DWN: 0 };
const WET: Indicators = { waterDeficitMm: 50, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 20, meanRootZoneWetness: 0.8, missingByParameter: NO_MISSING };
const INCOME_ONLY: UserPriorities = { waterSaving: 0, extraIncome: 5, soilImprovement: 0, erosionReduction: 0, lowRisk: 0 };
const rotationOf = (cropId: string): Rotation => ({ id: cropId, name: cropId, cropIds: [cropId], description: "d" });

// "thirsty": ingresos 5 y tolerancia a sequía 1 (hueco 0.8); "tolerant": tolerancia a sequía 5 (hueco 0).
const scoreOf = (cropId: string, indicators: Indicators, yearsAnalyzed = 10) => scoreRotations({ rotations: [rotationOf(cropId)], crops, indicators, priorities: INCOME_ONLY, yearsAnalyzed })[0];
const withWorst = (worstBalance: number, meanBalance = 50): Indicators => ({ ...WET, waterDeficitMm: meanBalance, worstYear: { year: 2016, waterBalanceMm: worstBalance } });
const droughtGap = 0.8;

describe("sequía de años malos en el puntaje", () => {
  it("resta un descuento aunque el promedio sea húmedo, cuando el peor año fue seco", () => {
    const dryness = 60 / DRYNESS_REFERENCE_MM;
    const expected = 5 - dryness * droughtGap * MAX_RISK_PENALTY * WORST_YEAR_DROUGHT_WEIGHT;
    expect(scoreOf("thirsty", withWorst(-60)).score).toBeCloseTo(expected, 5);
  });

  it("solo cuenta lo que el peor año agrega a la sequía del promedio, sin duplicarla", () => {
    const meanPenalty = (40 / DRYNESS_REFERENCE_MM) * droughtGap * MAX_RISK_PENALTY;
    const extra = ((60 - 40) / DRYNESS_REFERENCE_MM) * droughtGap * MAX_RISK_PENALTY * WORST_YEAR_DROUGHT_WEIGHT;
    expect(scoreOf("thirsty", withWorst(-60, -40)).score).toBeCloseTo(5 - meanPenalty - extra, 5);
  });

  it("no agrega nada si el peor año no es más seco que el promedio", () => {
    const meanOnly = scoreOf("thirsty", { ...WET, waterDeficitMm: -40 }).score;
    expect(scoreOf("thirsty", withWorst(-10, -40)).score).toBeCloseTo(meanOnly, 5);
  });

  it("no castiga a un cultivo que tolera la sequía al máximo", () => {
    expect(scoreOf("tolerant", withWorst(-80)).score).toBeCloseTo(scoreOf("tolerant", WET).score, 5);
  });

  it("sin dato de peor año el puntaje es el de siempre", () => {
    expect(scoreOf("thirsty", WET).score).toBeCloseTo(5, 5);
  });
});

describe("rachas secas y peor año en el texto", () => {
  const spell: Indicators = { ...WET, longestDrySpellDays: DRY_SPELL_ALERT_DAYS + 5, meanAnnualDrySpellDays: 12.4, worstYear: { year: 2016, waterBalanceMm: -30.2 } };

  it("cita la racha seca más larga y el año más seco con su dato de NASA", () => {
    const evidence = scoreOf("thirsty", spell).evidence.join(" ");
    expect(evidence).toContain(`${DRY_SPELL_ALERT_DAYS + 5} días seguidos`);
    expect(evidence).toContain("12.4 días");
    expect(evidence).toContain("Año más seco de la serie: 2016");
    expect(evidence).toContain("-30.2 mm/mes");
  });

  it("avisa del riesgo a un cultivo de baja tolerancia y no a uno tolerante", () => {
    expect(scoreOf("thirsty", spell).risks.join(" ")).toContain("Racha seca");
    expect(scoreOf("tolerant", spell).risks.join(" ")).not.toContain("Racha seca");
  });

  it("no avisa si la racha es corta", () => {
    expect(scoreOf("thirsty", { ...spell, longestDrySpellDays: DRY_SPELL_ALERT_DAYS - 1 }).risks.join(" ")).not.toContain("Racha seca");
  });

  it("explica en los vacíos que una serie corta no permite ver cómo cambia la lluvia de un año a otro", () => {
    const short = scoreOf("thirsty", WET, MIN_YEARS_FOR_WORST_YEAR - 1).informationGaps.join(" ");
    expect(short).toContain(`La serie climática cubre solo ${MIN_YEARS_FOR_WORST_YEAR - 1} años`);
    expect(short).toContain("de un año a otro");
    expect(scoreOf("thirsty", WET, MIN_YEARS_FOR_WORST_YEAR).informationGaps.join(" ")).not.toContain("La serie climática cubre solo");
  });

  it("habla de un año en singular", () => {
    expect(scoreOf("thirsty", WET, 1).informationGaps.join(" ")).toContain("La serie climática cubre solo 1 año:");
  });
});
