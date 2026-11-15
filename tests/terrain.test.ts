import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAnalysis } from "../src/lib/analysis";
import { CROPS } from "../src/lib/catalog";
import { computeIndicators } from "../src/lib/indicators";
import { clearClimateCache, fetchDailyClimate } from "../src/lib/nasaPower";
import { scoreRotations } from "../src/lib/scoring";
import { adjustRecordsForElevation, adjustTemperatureForElevation, findTerrainSample, resolveTerrain, slopeErosionExposure, TERRAIN_SAMPLES } from "../src/lib/terrain";
import { terrainSampleSchema, type ClimateRecord, type Crop, type Indicators, type Rotation, type UserPriorities } from "../src/types";

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

  it("declara en cada muestra que sus cifras son estimaciones sin verificar contra el ráster de NASA SRTM", () => {
    for (const sample of TERRAIN_SAMPLES) {
      expect(sample.source, sample.id).toContain("Estimación de referencia");
      expect(sample.source, sample.id).toContain("sin verificar");
    }
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

function dayRecord(overrides: Partial<ClimateRecord> = {}): ClimateRecord {
  return { date: "20210115", T2M: 16, T2M_MIN: 10, T2M_MAX: 22, PRECTOTCORR: 5, EVLAND: 3, GWETROOT: 0.8, ALLSKY_SFC_SW_DWN: 15, ...overrides };
}

describe("adjustRecordsForElevation", () => {
  const CELL_M = 2000;
  const SITE_M = 1000;
  const shift = adjustTemperatureForElevation(0, CELL_M, SITE_M);

  it("desplaza T2M, T2M_MIN y T2M_MAX con el mismo gradiente y deja intactos los demás parámetros", () => {
    const [adjusted] = adjustRecordsForElevation([dayRecord()], CELL_M, SITE_M);
    expect(shift).toBeCloseTo(6, 5);
    expect(adjusted.T2M).toBeCloseTo(22, 5);
    expect(adjusted.T2M_MIN).toBeCloseTo(16, 5);
    expect(adjusted.T2M_MAX).toBeCloseTo(28, 5);
    expect(adjusted).toMatchObject({ date: "20210115", PRECTOTCORR: 5, EVLAND: 3, GWETROOT: 0.8, ALLSKY_SFC_SW_DWN: 15 });
  });

  it("conserva como dato faltante (null) la temperatura que no existe", () => {
    const [adjusted] = adjustRecordsForElevation([dayRecord({ T2M_MIN: null, T2M_MAX: null })], CELL_M, SITE_M);
    expect(adjusted.T2M_MIN).toBeNull();
    expect(adjusted.T2M_MAX).toBeNull();
    expect(adjusted.T2M).toBeCloseTo(22, 5);
  });

  it("no cambia nada si falta la altitud de la celda o la del lote", () => {
    const records = [dayRecord()];
    expect(adjustRecordsForElevation(records, undefined, SITE_M)).toEqual(records);
    expect(adjustRecordsForElevation(records, CELL_M, undefined)).toEqual(records);
  });

  it("no modifica los registros originales", () => {
    const records = [dayRecord()];
    adjustRecordsForElevation(records, CELL_M, SITE_M);
    expect(records[0].T2M_MAX).toBe(22);
  });

  it("devuelve lista vacía con una serie vacía", () => {
    expect(adjustRecordsForElevation([], CELL_M, SITE_M)).toEqual([]);
  });
});

describe("indicadores con la temperatura corregida por altitud", () => {
  const cold = [dayRecord({ T2M: 2, T2M_MIN: -2, T2M_MAX: 9 })];
  const hot = [dayRecord({ T2M: 24, T2M_MIN: 18, T2M_MAX: 30 })];

  it("no cuenta como helada un día que en la celda helaba pero en el lote, 1000 m más abajo, no", () => {
    expect(computeIndicators(cold, 4.8).frostRiskDays).toBe(1);
    expect(computeIndicators(cold, 4.8, { cellElevationMeters: 2000, siteElevationMeters: 1000 }).frostRiskDays).toBe(0);
  });

  it("sí cuenta estrés por calor cuando el lote queda más bajo que la celda y la máxima corregida pasa el umbral", () => {
    expect(computeIndicators(hot, 4.8).heatStressDays).toBe(0);
    expect(computeIndicators(hot, 4.8, { cellElevationMeters: 2000, siteElevationMeters: 500 }).heatStressDays).toBe(1);
  });

  it("calcula la evaporación potencial con la temperatura del lote: más calor, más déficit de agua", () => {
    const dry = Array.from({ length: 28 }, (_, day) => dayRecord({ date: `202101${String(day + 1).padStart(2, "0")}`, PRECTOTCORR: 0 }));
    const cell = computeIndicators(dry, 4.8).waterDeficitMm as number;
    const site = computeIndicators(dry, 4.8, { cellElevationMeters: 2000, siteElevationMeters: 1000 }).waterDeficitMm as number;
    expect(site).toBeLessThan(cell);
  });

  it("mantiene la media de la celda aparte de la media del lote", () => {
    const result = computeIndicators(hot, 4.8, { cellElevationMeters: 2000, siteElevationMeters: 1000 });
    expect(result.cellMeanTemperatureC).toBeCloseTo(24, 5);
    expect(result.meanTemperatureC).toBeCloseTo(30, 5);
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
    expect(analysis.rotations[0].evidence.join(" ")).toContain("1411 m");
    // La altitud y la pendiente de la muestra no se leyeron del ráster: se muestran como estimación y como vacío de información.
    for (const result of analysis.rotations) {
      expect(result.evidence.join(" ")).toContain("estimación de referencia");
      expect(result.evidence.join(" ")).not.toContain("con NASA SRTM)");
      expect(result.informationGaps.join(" ")).toContain("no son mediciones del lote");
    }
  });

  it("dice que heladas y calor usan temperaturas ajustadas a la altitud y avisa que el gradiente es un supuesto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(powerFixture, { status: 200 })));
    const climate = await fetchDailyClimate({ lat: 4.8133, lon: -75.6961, startYear: 2020, endYear: 2022 });
    const analysis = buildAnalysis({ climate, crops: CROPS, priorities: EQUAL, location: { lat: 4.8133, lon: -75.6961 } });
    for (const result of analysis.rotations) {
      expect(result.evidence.join(" ")).toContain("temperaturas ajustadas a la altitud del lote");
      expect(result.informationGaps.join(" ")).toContain("mismo gradiente");
    }
  });

  it("no promete ajuste por altitud cuando no hay altitud del lote", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(powerFixture, { status: 200 })));
    const climate = await fetchDailyClimate({ lat: 4.8133, lon: -75.6961, startYear: 2020, endYear: 2022 });
    const analysis = buildAnalysis({ climate: { ...climate, cellElevationMeters: undefined }, crops: CROPS, priorities: EQUAL, location: { lat: 40, lon: -3 } });
    for (const result of analysis.rotations) {
      expect(result.evidence.join(" ")).not.toContain("temperaturas ajustadas a la altitud del lote");
      expect(result.informationGaps.join(" ")).not.toContain("mismo gradiente");
    }
  });

  it("no agrega el vacío de terreno estimado cuando el agricultor declara altitud y pendiente", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(powerFixture, { status: 200 })));
    const climate = await fetchDailyClimate({ lat: 4.8133, lon: -75.6961, startYear: 2020, endYear: 2022 });
    const analysis = buildAnalysis({ climate, crops: CROPS, priorities: { ...EQUAL, elevationMeters: 1500, slopePercent: 10 }, location: { lat: 4.8133, lon: -75.6961 } });
    for (const result of analysis.rotations) expect(result.informationGaps.join(" ")).not.toContain("no son mediciones del lote");
  });
});
