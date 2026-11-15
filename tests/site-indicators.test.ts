import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAnalysis } from "../src/lib/analysis";
import { CROPS } from "../src/lib/catalog";
import { clearnessLabel, computeIndicators, fournierClass, fournierIndex } from "../src/lib/indicators";
import { clearClimateCache, fetchDailyClimate } from "../src/lib/nasaPower";
import { dayOfYear, extraterrestrialRadiation } from "../src/lib/evapotranspiration";
import { slopeErosionExposure } from "../src/lib/terrain";
import type { ClimateRecord, Crop, MonthlyClimate, UserPriorities } from "../src/types";

const month = (year: number, m: number, rain: number | null, extra: Partial<MonthlyClimate> = {}): MonthlyClimate => ({
  year, month: m, meanTemperatureC: 20, precipitationMm: rain, evaporationMm: 60, potentialEvaporationMm: 100, rootZoneWetness: 0.5, missingByParameter: {}, ...extra,
});
const years = (count: number, rain: (year: number, m: number) => number | null, extra: (m: number) => Partial<MonthlyClimate> = () => ({})) =>
  Array.from({ length: count }, (_, y) => Array.from({ length: 12 }, (_, m) => month(2011 + y, m + 1, rain(y, m + 1), extra(m + 1)))).flat();

describe("fournierIndex: erosividad de la lluvia", () => {
  it("es la suma de la lluvia mensual al cuadrado entre la lluvia anual", () => {
    expect(fournierIndex(years(5, () => 100))).toBeCloseTo(100, 6); // 12 × 100² / 1200
    expect(fournierIndex(years(5, (_, m) => (m === 1 ? 1200 : 0)))).toBeCloseTo(1200, 6); // toda la lluvia en un mes
  });

  it("usa el promedio de cada mes calendario en todos los años", () => {
    const alternating = years(4, (y) => y % 2 === 0 ? 50 : 150);
    expect(fournierIndex(alternating)).toBeCloseTo(100, 6);
  });

  it("devuelve null si falta algún mes del calendario o no llovió nada", () => {
    expect(fournierIndex(years(5, () => 100).filter((row) => row.month !== 7))).toBeNull();
    expect(fournierIndex(years(5, () => 0))).toBeNull();
    expect(fournierIndex([])).toBeNull();
  });

  it("ignora los meses sin dato de lluvia pero exige que cada mes tenga alguno", () => {
    expect(fournierIndex(years(5, (y, m) => (m === 3 && y > 0 ? null : 100)))).toBeCloseTo(100, 6);
    expect(fournierIndex(years(5, (_, m) => (m === 3 ? null : 100)))).toBeNull();
  });

  it("clasifica con los cortes de Arnoldus: 60, 90, 120 y 160", () => {
    expect([59, 60, 89, 90, 119, 120, 159, 160, 400].map(fournierClass)).toEqual(["muy baja", "baja", "baja", "moderada", "moderada", "alta", "alta", "muy alta", "muy alta"]);
  });

  it("el índice de Pereira con los 15 años de NASA cae en la clase muy alta", async () => {
    clearClimateCache();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const climate = await fetchDailyClimate({ lat: 4.8133, lon: -75.6961, startYear: 2011, endYear: 2025 });
    const index = computeIndicators(climate.records, 4.8133).rainErosivityIndex!;
    expect(index).toBeGreaterThan(165);
    expect(index).toBeLessThan(200);
    expect(fournierClass(index)).toBe("muy alta");
  });
});

describe("slopeErosionExposure con la erosividad del sitio", () => {
  const bare: Crop[] = [{ id: "a", name: "A (Aa)", waterUse: 2, nitrogenFixation: 0, erosionReduction: 0, organicMatter: 2, forageValue: 2, marketPotential: 3, heatTolerance: 3, droughtTolerance: 3, cycleDays: 100, sowingMonths: [3], source: "x" }];

  it("sin índice de Fournier conserva el cálculo con la lluvia extrema", () => {
    expect(slopeErosionExposure(bare, 30, 25)).toBe(1);
    expect(slopeErosionExposure(bare, 30, 12.5)).toBeCloseTo(0.5, 6);
    expect(slopeErosionExposure(bare, 30, null)).toBe(0.5);
  });

  it("con el índice lo usa en lugar de un solo número de lluvia diaria: llega al máximo desde la clase muy alta", () => {
    expect(slopeErosionExposure(bare, 30, 5, 182)).toBe(1);
    expect(slopeErosionExposure(bare, 30, 25, 80)).toBeCloseTo(0.5, 6);
    expect(slopeErosionExposure(bare, 30, null, 40)).toBeCloseTo(0.25, 6);
  });

  it("una ladera suave no tiene exposición por más erosiva que sea la lluvia", () => {
    expect(slopeErosionExposure(bare, 10, 25, 182)).toBe(0);
  });
});

describe("radiación solar y nubosidad", () => {
  const day = (date: string, radiation: number | null): ClimateRecord => ({ date, T2M: 20, T2M_MIN: 15, T2M_MAX: 26, PRECTOTCORR: 4, EVLAND: 3, GWETROOT: 0.8, ALLSKY_SFC_SW_DWN: radiation });

  it("la radiación media y el índice de claridad salen de la radiación recibida y la del borde de la atmósfera", () => {
    const indicators = computeIndicators([day("20240621", 16)], 4.8);
    expect(indicators.meanSolarRadiationMJ).toBe(16);
    expect(indicators.clearnessIndex).toBeCloseTo(16 / extraterrestrialRadiation(4.8, dayOfYear("20240621")), 6);
  });

  it("promedia solo los días con dato y no inventa nada sin datos o sin latitud", () => {
    const withGap = computeIndicators([day("20240621", 16), day("20240622", null), day("20240623", 20)], 4.8);
    expect(withGap.meanSolarRadiationMJ).toBe(18);
    expect(computeIndicators([day("20240621", null)], 4.8).meanSolarRadiationMJ).toBeUndefined();
    expect(computeIndicators([day("20240621", null)], 4.8).clearnessIndex).toBeUndefined();
    expect(computeIndicators([day("20240621", 16)]).clearnessIndex).toBeUndefined();
  });

  it("describe el cielo con palabras: muy nublado, nublado, parcialmente nublado o despejado", () => {
    expect([0.3, 0.45, 0.55, 0.7].map(clearnessLabel)).toEqual(["muy nublado", "bastante nublado", "parcialmente nublado", "despejado"]);
  });
});

describe("evidencia de erosividad y de luz en el análisis", () => {
  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); });
  const EQUAL: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };

  it("dice la erosividad con su clase y la luz con el índice de claridad, y que la luz no cambia el puntaje", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const climate = await fetchDailyClimate({ lat: 4.8133, lon: -75.6961, startYear: 2011, endYear: 2025 });
    const response = buildAnalysis({ climate, crops: CROPS, priorities: EQUAL, location: { lat: 4.8133, lon: -75.6961 } });
    const evidence = response.rotations[0]!.evidence.join(" ");
    expect(evidence).toContain("Erosividad de la lluvia (índice de Fournier modificado");
    expect(evidence).toContain("clase muy alta");
    expect(evidence).toContain("Radiación solar media");
    expect(evidence).toContain("índice de claridad");
    expect(evidence).toMatch(/no cambia el puntaje/);
    expect(response.indicators.clearnessIndex).toBeGreaterThan(0.3);
    expect(response.indicators.clearnessIndex).toBeLessThan(0.7);
    const radiation = response.dataSources?.find((source) => source.id === "power-allsky_sfc_sw_dwn");
    expect(radiation?.use).not.toContain("todavía no interviene");
  });
});

