import { describe, expect, it } from "vitest";
import { resolveAnalysisSite } from "../src/lib/analysisSite";
import type { Farm } from "../src/types";

const centroid = { lat: 4.8133, lon: -75.6961 };
// Cuadrado de ~1 ha alrededor del centroide (mismo ejemplo de docs/farm-contract.md).
const ring: [number, number][] = [
  [-75.6965507452, 4.8128508444], [-75.6956492548, 4.8128508444], [-75.6956492548, 4.8137491556],
  [-75.6965507452, 4.8137491556], [-75.6965507452, 4.8128508444],
];
const polygonFarm: Farm = { centroid, locationSource: "map", terrain: { kind: "polygon", areaHa: 1, ring } };

function gapsOf(farm: Farm): string {
  const site = resolveAnalysisSite({ lat: 0, lon: 0, farm });
  if (!site.valid) throw new Error(site.errors.join(" "));
  return site.informationGaps.join(" ");
}

describe("resolveAnalysisSite", () => {
  it("sin Farm usa lat/lon de la solicitud y no agrega vacíos", () => {
    expect(resolveAnalysisSite({ lat: 4.5, lon: -75.6 })).toEqual({ valid: true, location: { lat: 4.5, lon: -75.6 }, informationGaps: [] });
  });

  it("con Farm usa farm.centroid aunque lat/lon digan otra cosa", () => {
    const site = resolveAnalysisSite({ lat: 0, lon: 0, farm: { centroid, locationSource: "search", terrain: { kind: "point" } } });
    expect(site.valid && site.location).toEqual(centroid);
  });

  it("declara como vacío que un punto no dice nada de los límites ni del tamaño del lote", () => {
    const gaps = gapsOf({ centroid, locationSource: "search", terrain: { kind: "point" } });
    expect(gaps).toContain("punto");
    expect(gaps).toContain("límites");
  });

  it("declara que el tamaño aproximado es una estimación y no una medición", () => {
    const gaps = gapsOf({ centroid, locationSource: "map", terrain: { kind: "approx_size", areaHa: 2.5 } });
    expect(gaps).toContain("2.5 ha");
    expect(gaps).toContain("estimación");
    expect(gaps).toContain("límites");
  });

  it("con polígono informa el área recalculada y aclara que no mejora la resolución del clima", () => {
    const site = resolveAnalysisSite({ lat: 0, lon: 0, farm: polygonFarm });
    expect(site.valid && site.areaHa).toBeCloseTo(1, 2);
    const gaps = gapsOf(polygonFarm);
    expect(gaps).toContain("1.00 ha");
    expect(gaps).toContain("regional");
    expect(gaps).not.toContain("límites reales");
  });

  it("recalcula el área del polígono y rechaza la declarada si difiere más de 1 %", () => {
    const site = resolveAnalysisSite({ lat: 0, lon: 0, farm: { ...polygonFarm, terrain: { kind: "polygon", areaHa: 5, ring } } });
    expect(site.valid).toBe(false);
    expect(!site.valid && site.errors.join(" ")).toContain("1 %");
  });

  it("rechaza un polígono que se cruza consigo mismo", () => {
    const bowtie: [number, number][] = [[-75.70, 4.81], [-75.69, 4.82], [-75.69, 4.81], [-75.70, 4.82], [-75.70, 4.81]];
    const site = resolveAnalysisSite({ lat: 0, lon: 0, farm: { ...polygonFarm, terrain: { kind: "polygon", areaHa: 1, ring: bowtie } } });
    expect(site.valid).toBe(false);
  });

  it("rechaza un área aproximada fuera de los límites del contrato", () => {
    const site = resolveAnalysisSite({ lat: 0, lon: 0, farm: { centroid, locationSource: "map", terrain: { kind: "approx_size", areaHa: 20_000 } } });
    expect(site.valid).toBe(false);
  });

  it("menciona la precisión del GPS cuando viene en el Farm", () => {
    const gaps = gapsOf({ centroid, locationSource: "gps", accuracyM: 42, terrain: { kind: "point" } });
    expect(gaps).toContain("±42 m");
  });

  it("pasa como vacío la advertencia de un lote de más de 1.000 ha", () => {
    const gaps = gapsOf({ centroid, locationSource: "map", terrain: { kind: "approx_size", areaHa: 1500 } });
    expect(gaps).toContain("1.000 ha");
  });
});
