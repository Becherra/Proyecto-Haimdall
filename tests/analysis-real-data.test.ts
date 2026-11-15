import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAnalysis, defaultCurrentCrop } from "../src/lib/analysis";
import { CROPS } from "../src/lib/catalog";
import { clearClimateCache, fetchDailyClimate } from "../src/lib/nasaPower";
import { analysisResponseSchema, climateScenarioSchema, type UserPriorities } from "../src/types";

const fixture = readFileSync("tests/fixtures/power-pereira.json", "utf8");
const EQUAL: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };
const PEREIRA = { lat: 4.8133, lon: -75.6961 };

describe("años reales extremos en la respuesta del análisis", () => {
  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); });

  it("con los 15 años de la muestra de Pereira devuelve el año más seco, el más lluvioso y el más cálido, con escenarios válidos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline"))); // cae a la muestra guardada de 2011–2025
    const climate = await fetchDailyClimate({ ...PEREIRA, startYear: 2011, endYear: 2025 });
    const response = buildAnalysis({ climate, crops: CROPS, priorities: EQUAL, location: PEREIRA });
    expect(analysisResponseSchema.safeParse(response).success).toBe(true);
    const extreme = response.extremeYears!;
    expect(extreme.yearsCompared).toBe(15);
    expect(extreme.driest.year).toBe(2021);
    expect(extreme.driest.rainChangePercent).toBeLessThan(-35);
    expect(extreme.wettest.rainChangePercent).toBeGreaterThan(25);
    for (const year of [extreme.driest, extreme.wettest, extreme.warmest]) expect(climateScenarioSchema.safeParse({ tempDeltaC: year.tempDeltaC, rainFactor: year.rainFactor }).success).toBe(true);
  });

  it("no inventa años extremos con una serie de 3 años", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(fixture, { status: 200 })));
    const climate = await fetchDailyClimate({ ...PEREIRA, startYear: 2020, endYear: 2022 });
    expect(buildAnalysis({ climate, crops: CROPS, priorities: EQUAL, location: PEREIRA }).extremeYears).toBeUndefined();
  });

  it("los años extremos salen de los datos originales de NASA, no de la serie con escenario", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const climate = await fetchDailyClimate({ ...PEREIRA, startYear: 2011, endYear: 2025 });
    const plain = buildAnalysis({ climate, crops: CROPS, priorities: EQUAL, location: PEREIRA });
    const dry = buildAnalysis({ climate, crops: CROPS, priorities: EQUAL, location: PEREIRA, scenario: { tempDeltaC: 2, rainFactor: 0.5 } });
    expect(dry.extremeYears).toEqual(plain.extremeYears);
  });
});

describe("cultivo con el que se compara cuando el agricultor no declara uno", () => {
  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); });
  const analyse = async (priorities: UserPriorities) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(fixture, { status: 200 })));
    const climate = await fetchDailyClimate({ ...PEREIRA, startYear: 2020, endYear: 2022 });
    return buildAnalysis({ climate, crops: CROPS, priorities, location: PEREIRA });
  };
  const gapsOf = (response: Awaited<ReturnType<typeof analyse>>) => response.rotations[0]!.informationGaps.join(" ");

  it("el maíz sigue siendo el punto de partida donde le va bien, pero se dice que es un supuesto", async () => {
    const response = await analyse(EQUAL);
    expect(response.rotations[0]!.rotation.cropIds).toEqual(["maiz"]);
    expect(gapsOf(response)).toContain("No indicaste qué cultivo tienes hoy");
    expect(gapsOf(response)).toContain("Maíz como punto de partida");
  });

  it("donde el maíz no crece bien por el frío elige el cultivo anual más apto para esa temperatura y lo explica", async () => {
    const response = await analyse({ ...EQUAL, elevationMeters: 2900 }); // la celda está a 2138 m: a 2900 m la temperatura baja ~4,6 °C
    expect(response.rotations[0]!.rotation.cropIds).not.toEqual(["maiz"]);
    expect(gapsOf(response)).toContain("el maíz no crece bien a la temperatura media de este sitio");
  });

  it("si el agricultor declara su cultivo o dice que no tiene, no hay supuesto que avisar", async () => {
    expect(gapsOf(await analyse({ ...EQUAL, currentCropId: "frijol" }))).not.toContain("No indicaste qué cultivo");
    expect(gapsOf(await analyse({ ...EQUAL, noCurrentCrop: true }))).not.toContain("No indicaste qué cultivo");
  });

  it("defaultCurrentCrop: maíz si encaja; si no, el más apto entre los anuales; nunca un permanente", () => {
    expect(defaultCurrentCrop(CROPS, 20).crop.id).toBe("maiz");
    expect(defaultCurrentCrop(CROPS, 20).reason).toBeNull();
    const cold = defaultCurrentCrop(CROPS, 12);
    expect(cold.crop.id).not.toBe("maiz");
    expect(cold.crop.perennial).not.toBe(true);
    expect(cold.reason).toContain("no crece bien");
    expect(defaultCurrentCrop(CROPS, null).crop.id).toBe("maiz");
    expect(defaultCurrentCrop(CROPS, null).reason).toBeNull();
  });
});
