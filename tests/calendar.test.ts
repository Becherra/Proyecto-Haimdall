import { describe, expect, it } from "vitest";
import { buildRotationCalendar, calendarEvidence, calendarGap, calendarRisks } from "../src/lib/calendar";
import { scoreRotations } from "../src/lib/scoring";
import type { MonthSeason } from "../src/lib/seasonality";
import { rotationResultSchema, type Crop, type Indicators, type Rotation, type UserPriorities } from "../src/types";

function crop(id: string, overrides: Partial<Crop> = {}): Crop {
  return {
    id, name: `${id} (Especie ${id})`, waterUse: 2, nitrogenFixation: 0, erosionReduction: 2, organicMatter: 2, forageValue: 2, marketPotential: 3,
    heatTolerance: 3, droughtTolerance: 2, cycleDays: 120, sowingMonths: [3, 9], source: "Cultivo de prueba", ...overrides,
  };
}

/** Estacionalidad de prueba: secos los meses dados, sin dato los de `unknown`, lluviosos los demás. */
function seasons(dry: number[], unknown: number[] = []): MonthSeason[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    if (unknown.includes(month)) return { month, meanRainMm: null, meanBalanceMm: null, dry: false };
    return { month, meanRainMm: dry.includes(month) ? 40 : 200, meanBalanceMm: dry.includes(month) ? -30 : 90, dry: dry.includes(month) };
  });
}

const BIMODAL = seasons([1, 2, 7, 8]);
const layout = (crops: Crop[], seasonality = BIMODAL) => buildRotationCalendar(crops, seasonality)?.months.map(({ month, cropId }) => `${month}:${cropId ?? "-"}`).join(" ");

describe("buildRotationCalendar", () => {
  it("en monocultivo muestra el cultivo y la ventana de campo vacío hasta la siguiente siembra", () => {
    expect(layout([crop("a")])).toBe("3:a 4:a 5:a 6:a 7:- 8:-");
    expect(buildRotationCalendar([crop("a")], BIMODAL)?.fallowMonths).toBe(2);
  });

  it("encadena los cultivos de la rotación y cierra el ciclo cuando el primero se puede volver a sembrar", () => {
    expect(layout([crop("a"), crop("b", { cycleDays: 90 })])).toBe("3:a 4:a 5:a 6:a 7:- 8:- 9:b 10:b 11:b 12:- 1:- 2:-");
  });

  it("numera los meses desde la primera siembra aunque el ciclo cruce de año", () => {
    const months = buildRotationCalendar([crop("a"), crop("b", { cycleDays: 90 })], BIMODAL)?.months ?? [];
    expect(months.map(({ offset }) => offset)).toEqual(Array.from({ length: 12 }, (_, index) => index));
  });

  it("no deja campo vacío si el siguiente cultivo se puede sembrar justo al cosechar", () => {
    const calendar = buildRotationCalendar([crop("a", { cycleDays: 180 }), crop("b", { cycleDays: 180 })], BIMODAL);
    expect(calendar?.fallowMonths).toBe(0);
    expect(calendar?.months).toHaveLength(12);
  });

  it("redondea hacia arriba los ciclos que no completan un mes y ocupa el lote con cultivos largos", () => {
    expect(layout([crop("largo", { cycleDays: 270 })])).toBe("3:largo 4:largo 5:largo 6:largo 7:largo 8:largo 9:largo 10:largo 11:largo 12:- 1:- 2:-");
    expect(buildRotationCalendar([crop("a", { cycleDays: 95 })], BIMODAL)?.months.filter(({ cropId }) => cropId === "a")).toHaveLength(4);
  });

  it("marca como vulnerable el campo vacío en mes lluvioso (suelo descubierto)", () => {
    const calendar = buildRotationCalendar([crop("a"), crop("b", { cycleDays: 90 })], BIMODAL);
    const december = calendar?.months.find(({ month }) => month === 12);
    expect(december).toMatchObject({ cropId: null, dry: false, risk: "bare-soil-rain" });
    // Enero y febrero también están vacíos, pero son secos: son ventana para una cobertura, no riesgo de erosión por lluvia.
    expect(calendar?.months.find(({ month }) => month === 1)?.risk).toBeNull();
  });

  it("marca como vulnerable un cultivo poco tolerante a sequía en mes seco, y no a uno tolerante", () => {
    const dryJune = seasons([6]);
    expect(buildRotationCalendar([crop("sensible")], dryJune)?.months.find(({ month }) => month === 6)?.risk).toBe("water-stress");
    expect(buildRotationCalendar([crop("rustico", { droughtTolerance: 5 })], dryJune)?.months.find(({ month }) => month === 6)?.risk).toBeNull();
  });

  it("cuenta los meses vulnerables", () => {
    // a en mar–jun (ninguno seco), vacío jul–ago (secos, sin riesgo), b en sep–nov, vacío dic (lluvioso, riesgo), ene–feb (secos).
    expect(buildRotationCalendar([crop("a"), crop("b", { cycleDays: 90 })], BIMODAL)?.vulnerableMonths).toBe(1);
  });

  it("deja dry y risk en null en los meses sin dato de lluvia", () => {
    const calendar = buildRotationCalendar([crop("a")], seasons([], [7]));
    expect(calendar?.months.find(({ month }) => month === 7)).toMatchObject({ dry: null, risk: null });
  });

  it("devuelve null si no hay cultivos o alguno no tiene meses de siembra", () => {
    expect(buildRotationCalendar([], BIMODAL)).toBeNull();
    expect(buildRotationCalendar([crop("a", { sowingMonths: [] })], BIMODAL)).toBeNull();
  });
});

describe("textos del calendario", () => {
  const crops = [crop("a"), crop("b", { cycleDays: 90 })];
  const calendar = buildRotationCalendar(crops, BIMODAL);

  it("resume como evidencia cuántos meses queda vacío el campo y cuáles", () => {
    if (!calendar) throw new Error("sin calendario");
    const [line] = calendarEvidence(calendar);
    expect(line).toContain("5 de 12 meses");
    expect(line).toContain("ene, feb, jul, ago, dic");
  });

  it("explica como riesgo el suelo descubierto en lluvia y el cultivo en época seca", () => {
    if (!calendar) throw new Error("sin calendario");
    expect(calendarRisks(calendar, crops).join(" ")).toContain("dic");
    const stressed = buildRotationCalendar([crop("sensible")], seasons([6]));
    if (!stressed) throw new Error("sin calendario");
    const risk = calendarRisks(stressed, [crop("sensible")]).join(" ");
    expect(risk).toContain("sensible");
    expect(risk).toContain("jun");
  });

  it("no inventa riesgos cuando no hay meses vulnerables", () => {
    const covered = buildRotationCalendar([crop("a", { cycleDays: 180 }), crop("b", { cycleDays: 180 })], seasons([]));
    if (!covered) throw new Error("sin calendario");
    expect(calendarRisks(covered, crops)).toEqual([]);
  });

  it("declara que el calendario es ilustrativo y no las fechas reales del agricultor", () => {
    expect(calendarGap()).toContain("ilustrativo");
  });
});

describe("scoreRotations: calendario", () => {
  const EQUAL: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };
  const indicators: Indicators = { waterDeficitMm: 40, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 15, meanRootZoneWetness: 0.8, missingByParameter: {} };
  const rotation: Rotation = { id: "r", name: "r", cropIds: ["a", "b"], description: "Rotación de prueba" };
  const catalog = [crop("a"), crop("b", { cycleDays: 90 })];

  it("incluye el calendario, su evidencia, sus riesgos y su vacío cuando hay estacionalidad", () => {
    const [result] = scoreRotations({ rotations: [rotation], crops: catalog, indicators, priorities: EQUAL, seasonality: BIMODAL });
    expect(rotationResultSchema.safeParse(result).success).toBe(true);
    expect(result.calendar?.months).toHaveLength(12);
    expect(result.evidence.join(" ")).toContain("5 de 12 meses");
    expect(result.risks.join(" ")).toContain("sin cobertura");
    expect(result.informationGaps.join(" ")).toContain("ilustrativo");
  });

  it("no incluye calendario si no se cruzó la estacionalidad (fuera de la zona del calendario de siembra)", () => {
    const [result] = scoreRotations({ rotations: [rotation], crops: catalog, indicators, priorities: EQUAL });
    expect(result.calendar).toBeUndefined();
    expect(result.informationGaps.join(" ")).not.toContain("ilustrativo");
  });

  it("no cambia el puntaje: el calendario solo informa", () => {
    const withSeasons = scoreRotations({ rotations: [rotation], crops: catalog, indicators, priorities: EQUAL, seasonality: seasons([]) })[0];
    const without = scoreRotations({ rotations: [rotation], crops: catalog, indicators, priorities: EQUAL })[0];
    expect(withSeasons.score).toBe(without.score);
  });
});
