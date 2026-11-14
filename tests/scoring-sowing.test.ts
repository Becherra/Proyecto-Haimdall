import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MonthSeason } from "../src/lib/seasonality";
import { scoreRotations } from "../src/lib/scoring";
import { cropSchema, type Indicators, type Rotation, type UserPriorities } from "../src/types";

const crops = (JSON.parse(readFileSync("tests/fixtures/crops-test.json", "utf8")) as unknown[]).map((crop) => cropSchema.parse(crop));
const NO_MISSING = { T2M: 0, T2M_MIN: 0, T2M_MAX: 0, PRECTOTCORR: 0, EVLAND: 0, GWETROOT: 0, ALLSKY_SFC_SW_DWN: 0 };
const WET: Indicators = { waterDeficitMm: 50, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 20, meanRootZoneWetness: 0.8, missingByParameter: NO_MISSING };
const INCOME_ONLY: UserPriorities = { waterSaving: 0, extraIncome: 5, soilImprovement: 0, erosionReduction: 0, lowRisk: 0 };
const rotation = (id: string, ...cropIds: string[]): Rotation => ({ id, name: `Rotación ${id}`, cropIds, description: "Rotación de prueba" });

// Los cultivos de prueba se siembran en marzo y septiembre.
function seasonality(dryMonths: number[], unknownMonths: number[] = []): MonthSeason[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const unknown = unknownMonths.includes(month);
    return { month, meanRainMm: unknown ? null : 100, meanBalanceMm: unknown ? null : 80, dry: dryMonths.includes(month) };
  });
}

const score = (rotations: Rotation[], season?: MonthSeason[]) => scoreRotations({ rotations, crops, indicators: WET, priorities: INCOME_ONLY, seasonality: season }).map((result) => result.score);
const resultOf = (id: string, season?: MonthSeason[]) => scoreRotations({ rotations: [rotation("r", id)], crops, indicators: WET, priorities: INCOME_ONLY, seasonality: season })[0];

describe("scoreRotations con calendario de siembra", () => {
  it("no cambia el puntaje si no se entrega la estacionalidad", () => {
    expect(score([rotation("a", "thirsty")])).toEqual([5]);
  });

  it("descuenta cuando todos los meses de siembra son secos y el cultivo tolera poco la sequía", () => {
    expect(score([rotation("a", "thirsty")], seasonality([3, 9]))[0]).toBeCloseTo(4.6, 5);
  });

  it("descuenta la mitad si solo la mitad de los meses de siembra es seca", () => {
    expect(score([rotation("a", "thirsty")], seasonality([3]))[0]).toBeCloseTo(4.8, 5);
  });

  it("no descuenta a un cultivo muy tolerante a la sequía, pero sí avisa del riesgo", () => {
    const result = resultOf("tolerant", seasonality([3, 9]));
    expect(result.score).toBe(3);
    expect(result.risks.join(" ")).toContain("época seca");
  });

  it("no descuenta si ningún mes de siembra es seco y lo dice en la evidencia", () => {
    const result = resultOf("thirsty", seasonality([1]));
    expect(result.score).toBe(5);
    expect(result.evidence.join(" ")).toContain("ningún mes cae en época seca");
    expect(result.risks.join(" ")).not.toContain("época seca");
  });

  it("explica en la evidencia qué meses de siembra caen en época seca y cómo se define", () => {
    const evidence = resultOf("thirsty", seasonality([9])).evidence.join(" ");
    expect(evidence).toContain("Siembra de Cultivo exigente (prueba) (mar, sep)");
    expect(evidence).toContain("en época seca del sitio: sep");
    expect(evidence).toContain("regla de diseño");
  });

  it("menciona la siembra en meses secos al explicar por qué baja el puntaje", () => {
    expect(resultOf("thirsty", seasonality([3, 9])).whySuggested).toContain("siembra en meses secos (mar, sep)");
  });

  it("cambia el vacío del calendario: ya se cruzó, pero con promedios mensuales", () => {
    const without = resultOf("thirsty").informationGaps.join(" ");
    const withSeason = resultOf("thirsty", seasonality([])).informationGaps.join(" ");
    expect(without).toContain("no se cruzó");
    expect(withSeason).not.toContain("no se cruzó");
    expect(withSeason).toContain("promedios mensuales");
  });

  it("reporta como vacío los meses de siembra sin dato de lluvia y no los castiga", () => {
    const result = resultOf("thirsty", seasonality([], [3]));
    expect(result.informationGaps.join(" ")).toContain("sin dato de lluvia");
    expect(result.informationGaps.join(" ")).toContain("mar");
    expect(result.score).toBe(5);
  });

  it("promedia el descuento entre los cultivos de la rotación", () => {
    // Ingresos: (5 + 3) / 2 = 4; descuento medio: (0.4 + 0) / 2 = 0.2.
    expect(score([rotation("mix", "thirsty", "tolerant")], seasonality([3, 9]))[0]).toBeCloseTo(3.8, 5);
  });
});
