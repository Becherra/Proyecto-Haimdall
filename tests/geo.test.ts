import { describe, expect, it } from "vitest";
import { bboxOfRing, isSelfIntersecting, polygonAreaHa, polygonCentroid, squareFromArea, validateTerrain } from "../src/lib/geo";
import type { FarmTerrain } from "../src/types";

const center = { lat: 4.81, lon: -75.7 };
const metersPerDegree = 111_320;
const square100m = (): readonly (readonly [number, number])[] => {
  const halfLat = 50 / metersPerDegree;
  const halfLon = 50 / (metersPerDegree * Math.cos(center.lat * Math.PI / 180));
  return [
    [center.lon - halfLon, center.lat - halfLat], [center.lon + halfLon, center.lat - halfLat],
    [center.lon + halfLon, center.lat + halfLat], [center.lon - halfLon, center.lat + halfLat],
    [center.lon - halfLon, center.lat - halfLat],
  ];
};
const polygon = (areaHa: number, ring: readonly (readonly [number, number])[]): FarmTerrain => ({
  kind: "polygon", areaHa, ring: ring.map(([longitude, latitude]) => [longitude, latitude] as [number, number]),
});

describe("geometría del terreno", () => {
  it("calcula cerca de 1 ha para un cuadrado de 100 m a latitud 4.81", () => {
    expect(polygonAreaHa(square100m())).toBeCloseTo(1, 2);
  });

  it("construye un cuadrado cuya área coincide con la solicitada", () => {
    const ring = squareFromArea(center, 2.4);
    expect(polygonAreaHa(ring)).toBeCloseTo(2.4, 2);
    expect(polygonCentroid(ring).lat).toBeCloseTo(center.lat, 6);
    expect(polygonCentroid(ring).lon).toBeCloseTo(center.lon, 6);
  });

  it("detecta lazos y rechaza un polígono que se cruza", () => {
    const ring = [[-75.7, 4.81], [-75.69, 4.82], [-75.7, 4.82], [-75.69, 4.81], [-75.7, 4.81]] as const;
    expect(isSelfIntersecting(ring)).toBe(true);
    expect(validateTerrain(polygon(1, ring)).valid).toBe(false);
  });

  it("rechaza menos de tres vértices", () => {
    const terrain = { kind: "polygon", areaHa: 1, ring: [[-75.7, 4.81], [-75.69, 4.81], [-75.7, 4.81]] } as FarmTerrain;
    expect(validateTerrain(terrain).valid).toBe(false);
  });

  it("rechaza polígonos abiertos, cruzando el antimeridiano o sobre 85°", () => {
    const openRing = [[-75.7, 4.81], [-75.69, 4.81], [-75.69, 4.82], [-75.7, 4.82]] as const;
    const datelineRing = [[179.8, 4], [-179.8, 4], [-179.8, 4.1], [179.8, 4.1], [179.8, 4]] as const;
    const polarRing = [[0, 85.1], [0.01, 85.1], [0.01, 85.2], [0, 85.1]] as const;
    expect(validateTerrain(polygon(1, openRing)).valid).toBe(false);
    expect(validateTerrain(polygon(1, datelineRing)).errors[0]).toMatch(/antimeridiano/);
    expect(validateTerrain(polygon(1, polarRing)).errors[0]).toMatch(/85°/);
  });

  it("calcula centroide y bbox en el orden geográfico", () => {
    const ring = [[-75.71, 4.8], [-75.69, 4.8], [-75.69, 4.82], [-75.71, 4.82], [-75.71, 4.8]] as const;
    expect(polygonCentroid(ring).lat).toBeCloseTo(4.81, 8);
    expect(polygonCentroid(ring).lon).toBeCloseTo(-75.7, 8);
    expect(bboxOfRing(ring)).toEqual([4.8, 4.82, -75.71, -75.69]);
  });

  it("acepta terreno por punto y rango aproximado con valor medio", () => {
    expect(validateTerrain({ kind: "point" }).valid).toBe(true);
    expect(validateTerrain({ kind: "approx_size", areaRangeHa: [1, 5], areaHa: 3 }).valid).toBe(true);
    expect(validateTerrain({ kind: "approx_size", areaRangeHa: [1, 5], areaHa: 2 }).valid).toBe(false);
  });

  it("rechaza áreas inferiores a 0.01 ha, superiores a 10,000 ha y discrepancias mayores al 1 %", () => {
    const tinyRing = squareFromArea(center, 0.005);
    const largeRing = squareFromArea(center, 10_001);
    expect(validateTerrain(polygon(0.005, tinyRing)).valid).toBe(false);
    expect(validateTerrain(polygon(10_001, largeRing)).valid).toBe(false);
    expect(validateTerrain(polygon(1.02, square100m())).errors[0]).toMatch(/1 %/);
  });

  it("advierte si el polígono supera 1,000 ha", () => {
    const ring = squareFromArea(center, 1_100);
    const validation = validateTerrain(polygon(polygonAreaHa(ring), ring));
    expect(validation.valid).toBe(true);
    expect(validation.warnings[0]).toMatch(/1.000 ha/);
  });
});
