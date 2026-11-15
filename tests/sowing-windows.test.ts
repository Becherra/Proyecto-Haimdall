import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAnalysis } from "../src/lib/analysis";
import { CROPS } from "../src/lib/catalog";
import { clearClimateCache, fetchDailyClimate } from "../src/lib/nasaPower";
import { sowingWindows } from "../src/lib/sowingWindows";
import type { Crop, MonthlyClimate, UserPriorities } from "../src/types";

const crop = (overrides: Partial<Crop> = {}): Crop => ({
  id: "c", name: "Cultivo (Cultivum)", waterUse: 2, nitrogenFixation: 0, erosionReduction: 2, organicMatter: 2, forageValue: 2, marketPotential: 3,
  heatTolerance: 3, droughtTolerance: 3, cycleDays: 90, sowingMonths: [3, 4], source: "prueba", ...overrides,
});
/** `count` años con 12 meses; evaporación potencial de 100 mm siempre; la lluvia y la temperatura salen de las funciones. */
function series(count: number, rain: (m: number) => number | null, temperature: (m: number) => number = () => 20): MonthlyClimate[] {
  return Array.from({ length: count * 12 }, (_, index) => {
    const m = (index % 12) + 1;
    return { year: 2011 + Math.floor(index / 12), month: m, meanTemperatureC: temperature(m), precipitationMm: rain(m), evaporationMm: 60, potentialEvaporationMm: 100, rootZoneWetness: 0.5, missingByParameter: {} };
  });
}
const dryJanFeb = (m: number) => (m === 1 || m === 2 ? 50 : 150); // enero y febrero con déficit (50 < 100), el resto sobra agua

describe("sowingWindows: meses de siembra calculados con el clima del sitio", () => {
  it("mide, para cada mes de siembra, cuántos meses del ciclo tuvieron déficit de agua, y elige los de menor exposición", () => {
    const result = sowingWindows(crop(), series(10, dryJanFeb))!;
    expect(result.cycleMonths).toBe(3);
    expect(result.exposureByMonth[10]).toBe(1); // sembrar en nov: nov, dic, ene → 1 mes con déficit
    expect(result.exposureByMonth[11]).toBe(2); // dic: dic, ene, feb
    expect(result.exposureByMonth[0]).toBe(2); // ene: ene, feb, mar
    expect(result.exposureByMonth[2]).toBe(0); // mar: sin déficit
    expect(result.months).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("un ciclo más largo abarca más meses del ciclo y puede dejar menos opciones", () => {
    const long = sowingWindows(crop({ cycleDays: 270 }), series(10, dryJanFeb))!; // 9 meses
    expect(long.cycleMonths).toBe(9);
    expect(long.months.length).toBeLessThan(8);
    expect(long.months).not.toContain(12);
  });

  it("descarta los meses de siembra cuyo ciclo pasa por meses demasiado fríos para el cultivo", () => {
    const cold = (m: number) => (m >= 6 && m <= 8 ? 8 : 20); // jun a ago por debajo del límite de 10 °C
    const result = sowingWindows(crop({ temperatureC: { goodMin: 15, limitMin: 10 } }), series(10, () => 150, cold))!;
    expect(result.exposureByMonth[3]).toBeNull(); // abr: abr, may, jun
    expect(result.exposureByMonth[5]).toBeNull(); // jun
    expect(result.exposureByMonth[8]).not.toBeNull(); // sep
    expect(result.months).toEqual([9, 10, 11, 12, 1, 2, 3].sort((a, b) => a - b));
  });

  it("sin límite en el catálogo usa el margen por defecto bajo el inicio del rango bueno", () => {
    const veryCold = (m: number) => (m === 7 ? 5 : 20);
    const result = sowingWindows(crop({ temperatureC: { goodMin: 15 } }), series(10, () => 150, veryCold))!;
    expect(result.exposureByMonth[6]).toBeNull(); // jul: 5 °C < 15 − 7
  });

  it("devuelve null con menos de 5 años de datos, para un cultivo permanente o con un ciclo de más de un año", () => {
    expect(sowingWindows(crop(), series(4, dryJanFeb))).toBeNull();
    expect(sowingWindows(crop({ perennial: true, sowingMonths: [] }), series(10, dryJanFeb))).toBeNull();
    expect(sowingWindows(crop({ cycleDays: 400 }), series(10, dryJanFeb))).toBeNull();
    expect(sowingWindows(crop(), [])).toBeNull();
  });

  it("no cuenta los años con meses sin dato de lluvia dentro del ciclo", () => {
    const rows = series(10, dryJanFeb).map((row) => (row.year === 2011 && row.month === 1 ? { ...row, precipitationMm: null } : row));
    const result = sowingWindows(crop(), rows)!;
    expect(result.exposureByMonth[10]).toBe(1); // los años con dato siguen dando 1
  });

  it("devuelve null si ningún mes de siembra es posible por el frío", () => {
    expect(sowingWindows(crop({ temperatureC: { goodMin: 30, limitMin: 25 } }), series(10, () => 150))).toBeNull();
  });
});

describe("meses de siembra del sitio en la evidencia del análisis", () => {
  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); });
  const EQUAL: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };

  it("cada cultivo anual trae sus mejores meses con el clima de Pereira, junto a los del catálogo, y se avisa que no es un calendario agronómico", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const climate = await fetchDailyClimate({ lat: 4.8133, lon: -75.6961, startYear: 2011, endYear: 2025 });
    const response = buildAnalysis({ climate, crops: CROPS, priorities: { ...EQUAL, currentCropId: "maiz" }, location: { lat: 4.8133, lon: -75.6961 } });
    const baseline = response.rotations[0]!;
    const line = baseline.evidence.find((text) => text.startsWith("Mejores meses para sembrar Maíz"))!;
    expect(line).toContain("según la lluvia, la evaporación y la temperatura de tu sitio");
    const months = line.split("tu sitio: ")[1]!.split(" (en promedio")[0];
    expect(months).toBe("feb, mar"); // los dos meses con menos déficit de agua en el ciclo de 5 meses del maíz
    expect(line).toContain("el catálogo propone mar, abr, sep, oct");
    expect(baseline.informationGaps.join(" ")).toContain("no consideran plagas, heladas locales, mercado ni el manejo real");
  });

  it("también calcula los meses fuera del Eje Cafetero, donde el calendario del catálogo no aplica", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const climate = await fetchDailyClimate({ lat: 4.8133, lon: -75.6961, startYear: 2011, endYear: 2025 });
    const response = buildAnalysis({ climate, crops: CROPS, priorities: { ...EQUAL, currentCropId: "maiz" }, location: { lat: 40, lon: -3 } });
    expect(response.rotations[0]!.evidence.some((text) => text.startsWith("Mejores meses para sembrar Maíz"))).toBe(true);
  });

  it("un cultivo permanente no trae meses de siembra", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const climate = await fetchDailyClimate({ lat: 4.8133, lon: -75.6961, startYear: 2011, endYear: 2025 });
    const response = buildAnalysis({ climate, crops: CROPS, priorities: { ...EQUAL, currentCropId: "cafe" }, location: { lat: 4.8133, lon: -75.6961 } });
    expect(response.rotations[0]!.evidence.some((text) => text.startsWith("Mejores meses para sembrar Café"))).toBe(false);
  });
});
