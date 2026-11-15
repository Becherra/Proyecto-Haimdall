import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAnalysis } from "../src/lib/analysis";
import { CROPS } from "../src/lib/catalog";
import { clearClimateCache, fetchDailyClimate } from "../src/lib/nasaPower";
import { scoreRotations } from "../src/lib/scoring";
import { adjustTemperatureForElevation, findTerrainSample, resolveTerrain, slopeErosionExposure, TERRAIN_SAMPLES } from "../src/lib/terrain";
import { terrainSampleSchema, type Crop, type Indicators, type Rotation, type UserPriorities } from "../src/types";

const powerFixture = readFileSync("tests/fixtures/power-pereira.json", "utf8");
const EQUAL: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };

function testCrop(id: string, erosionReduction: number): Crop {
  return {
    id, name: `${id} (Especie ${id})`, waterUse: 2, nitrogenFixation: 0, erosionReduction, organicMatter: 2, forageValue: 2,
    marketPotential: 3, heatTolerance: 3, droughtTolerance: 3, cycleDays: 100, sowingMonths: [3, 9], source: "Cultivo de prueba",
  };
}

describe("TERRAIN_SAMPLES y findTerrainSample", () => {
  it("valida todas las muestras precargadas de NASA SRTM en el Eje Cafetero", () => {
    expect(TERRAIN_SAMPLES.length).toBeGreaterThanOrEqual(5);
    for (const sample of TERRAIN_SAMPLES) expect(terrainSampleSchema.safeParse(sample).success).toBe(true);
  });

  it("encuentra la muestra SRTM de Pereira, Cerritos y Manizales y devuelve null fuera de la zona", () => {
    expect(findTerrainSample(4.8133, -75.6961)?.id).toBe("pereira-cafetera");
    expect(findTerrainSample(4.805, -75.84)?.id).toBe("cerritos-valle");
    expect(findTerrainSample(5.0689, -75.5174)?.id).toBe("manizales-ladera");
    expect(findTerrainSample(-32.89, -68.84)).toBeNull();
  });
});

describe("resolveTerrain", () => {
  it("prioriza la altitud y pendiente declaradas por el usuario sobre la muestra SRTM", () => {
    const resolved = resolveTerrain({ lat: 4.8133, lon: -75.6961 }, { elevationMeters: 1650, slopePercent: 25 }, true);
    expect(resolved).toEqual({ elevationMeters: 1650, slopePercent: 25, source: "user" });
  });

  it("usa la muestra SRTM cuando hay elevación de celda o de muestra y el usuario no declaró terreno", () => {
    const resolved = resolveTerrain({ lat: 4.8133, lon: -75.6961 }, undefined, true);
    expect(resolved).toMatchObject({ elevationMeters: 1411, slopePercent: 18, source: "srtm-sample" });
  });

  it("devuelve null cuando no se pide muestra por defecto ni el usuario declaró terreno", () => {
    expect(resolveTerrain({ lat: 4.8133, lon: -75.6961 }, undefined, false)).toBeNull();
  });
});

describe("adjustTemperatureForElevation", () => {
  it("sube la temperatura estimada cuando la finca está más baja que la celda de NASA POWER", () => {
    const adjusted = adjustTemperatureForElevation(16.3, 2138.33, 1411);
    expect(adjusted).toBeCloseTo(20.66, 2);
  });

  it("baja la temperatura estimada cuando la finca está más alta que la celda", () => {
    const adjusted = adjustTemperatureForElevation(16.3, 2138, 2638);
    expect(adjusted).toBeCloseTo(13.3, 2);
  });

  it("mantiene la temperatura si la finca y la celda están a la misma altitud", () => {
    expect(adjustTemperatureForElevation(18, 1500, 1500)).toBe(18);
  });
});

describe("slopeErosionExposure y penalización en ladera", () => {
  const bare = testCrop("bare", 0);
  const cover = testCrop("cover", 5);
  const rot = (id: string, cropId: string): Rotation => ({ id, name: id, cropIds: [cropId], description: "Prueba" });
  const baseIndicators: Indicators = {
    waterDeficitMm: 40, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 25, meanRootZoneWetness: 0.8, missingByParameter: {}, meanTemperatureC: 20,
  };

  it("no penaliza en terreno plano o con pendiente menor al umbral de precaución", () => {
    expect(slopeErosionExposure([bare], 10, 25)).toBe(0);
    expect(slopeErosionExposure([bare], undefined, 25)).toBe(0);
  });

  it("castiga al cultivo sin cobertura en ladera empinada con lluvias fuertes y no al de máxima cobertura", () => {
    expect(slopeErosionExposure([bare], 30, 25)).toBe(1);
    expect(slopeErosionExposure([cover], 30, 25)).toBe(0);
    const flatScore = scoreRotations({ rotations: [rot("r", "bare")], crops: [bare, cover], indicators: baseIndicators, priorities: EQUAL })[0].score;
    const steepResult = scoreRotations({
      rotations: [rot("r", "bare")], crops: [bare, cover], indicators: { ...baseIndicators, slopePercent: 30, terrainSource: "srtm-sample" }, priorities: EQUAL,
    })[0];
    expect(flatScore - steepResult.score).toBeCloseTo(0.75, 2);
    expect(steepResult.risks.join(" ")).toContain("ladera");
    expect(steepResult.evidence.join(" ")).toContain("Pendiente del terreno: 30 %");
  });
});

describe("integración NASA POWER + SRTM en Pereira", () => {
  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); });

  it("extrae cellElevationMeters (2138.33 m) de NASA POWER y ajusta la temperatura de Pereira a su piso térmico cafetero (~20.6 °C)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(powerFixture, { status: 200 })));
    const climate = await fetchDailyClimate({ lat: 4.8133, lon: -75.6961, startYear: 2020, endYear: 2022 });
    expect(climate.cellElevationMeters).toBeCloseTo(2138.33, 2);

    const analysis = buildAnalysis({ climate, crops: CROPS, priorities: EQUAL, location: { lat: 4.8133, lon: -75.6961 } });
    expect(analysis.indicators.cellElevationMeters).toBeCloseTo(2138.33, 2);
    expect(analysis.indicators.siteElevationMeters).toBe(1411);
    expect(analysis.indicators.slopePercent).toBe(18);
    expect(analysis.indicators.cellMeanTemperatureC).toBeCloseTo(16.27, 2);
    expect(analysis.indicators.meanTemperatureC).toBeCloseTo(20.64, 2);
    expect(analysis.rotations[0].evidence.join(" ")).toContain("SRTM");
    expect(analysis.rotations[0].evidence.join(" ")).toContain("1411 m");
  });
});
