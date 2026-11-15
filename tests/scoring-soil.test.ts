import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listDataSources } from "../src/lib/dataSources";
import { scoreRotations } from "../src/lib/scoring";
import type { MonthSeason } from "../src/lib/seasonality";
import { cropSchema, type Indicators, type Rotation, type UserPriorities } from "../src/types";

const crops = (JSON.parse(readFileSync("tests/fixtures/crops-test.json", "utf8")) as unknown[]).map((crop) => cropSchema.parse(crop));
const NO_MISSING = { T2M: 0, T2M_MIN: 0, T2M_MAX: 0, PRECTOTCORR: 0, EVLAND: 0, GWETROOT: 0, ALLSKY_SFC_SW_DWN: 0 };
const WET: Indicators = { waterDeficitMm: 50, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 20, meanRootZoneWetness: 0.8, missingByParameter: NO_MISSING };
const EQUAL: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };
const rotation: Rotation = { id: "r", name: "r", cropIds: ["legume"], description: "d" }; // meses de siembra 3 y 9

function seasons(wetnessOf: (month: number) => number | null, soilDry: (month: number) => boolean): MonthSeason[] {
  return Array.from({ length: 12 }, (_, index) => ({ month: index + 1, meanRainMm: 100, meanBalanceMm: 20, dry: false, meanWetness: wetnessOf(index + 1), soilDry: soilDry(index + 1) }));
}
const score = (seasonality: MonthSeason[] | undefined, indicators: Indicators = WET) => scoreRotations({ rotations: [rotation], crops, indicators, priorities: EQUAL, seasonality, yearsAnalyzed: 10 })[0];

describe("humedad del suelo en los meses de siembra", () => {
  it("la lista de fuentes dice que la humedad se usa en los meses de siembra sin cambiar el puntaje", () => {
    const wetness = listDataSources(WET).find(({ id }) => id === "power-gwetroot");
    expect(wetness?.use).toContain("meses de siembra");
    expect(wetness?.use).toContain("no cambia el puntaje");
  });

  const withSoil = seasons((month) => (month === 9 ? 0.7 : 0.85), (month) => month === 9);

  it("cita el rango de humedad de los meses de siembra y dice que es un proxy de NASA", () => {
    const evidence = score(withSoil).evidence.join(" ");
    expect(evidence).toContain("Humedad del suelo en los meses de siembra");
    expect(evidence).toContain("0.70–0.85");
    expect(evidence).toContain("proxy");
  });

  it("avisa como riesgo los meses de siembra con el suelo más seco de lo normal", () => {
    const risks = score(withSoil).risks.join(" ");
    expect(risks).toContain("sep");
    expect(risks).toContain("humedad del suelo");
    expect(risks).toContain("por debajo de lo normal");
  });

  it("no avisa nada si ningún mes de siembra tiene el suelo seco", () => {
    expect(score(seasons(() => 0.85, () => false)).risks.join(" ")).not.toContain("humedad del suelo");
  });

  it("sin dato de humedad no inventa evidencia ni riesgo", () => {
    const result = score(seasons(() => null, () => false));
    expect(result.evidence.join(" ")).not.toContain("Humedad del suelo en los meses de siembra");
    expect(result.risks.join(" ")).not.toContain("humedad del suelo");
  });

  it("no cambia el puntaje: es evidencia y aviso, no un criterio", () => {
    const without = seasons(() => null, () => false);
    expect(score(withSoil).score).toBeCloseTo(score(without).score, 10);
    expect(score(seasons(() => 0.2, () => true)).score).toBeCloseTo(score(without).score, 10);
  });
});
