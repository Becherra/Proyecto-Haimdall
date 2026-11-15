import { describe, expect, it } from "vitest";
import { squareFromArea } from "../src/lib/geo";
import { EARTH_METERS_PER_DEGREE } from "../src/lib/srtm";
import { planTerrainGrid, pointInRing, summarizeTerrainGrid } from "../src/lib/terrainGrid";
import { planeElevations } from "./helpers/terrainFields";

const PEREIRA = { lat: 4.8133, lon: -75.6961 };

describe("planTerrainGrid", () => {
  it("para un punto arma una malla de 9×9 puntos cada 30 m centrada en él, con el norte en la primera fila", () => {
    const plan = planTerrainGrid(PEREIRA);
    expect(plan.size).toBe(9);
    expect(plan.spacingMeters).toBe(30);
    expect(plan.locations).toHaveLength(81);
    expect(plan.locations[40]).toEqual(PEREIRA);
    expect(plan.locations[0]!.lat).toBeGreaterThan(PEREIRA.lat);
    expect(plan.locations[8]!.lon).toBeGreaterThan(PEREIRA.lon);
    expect((plan.locations[0]!.lat - plan.locations[9]!.lat) * EARTH_METERS_PER_DEGREE).toBeCloseTo(30, 3);
  });

  it("para un punto usa las 7×7 celdas interiores, las que tienen los ocho vecinos", () => {
    const { included, size } = planTerrainGrid(PEREIRA);
    expect(included.filter(Boolean)).toHaveLength(49);
    expect(included[0]).toBe(false);
    expect(included[size + 1]).toBe(true);
    expect(included[size * size - 1]).toBe(false);
  });

  it("para un lote chico mantiene 30 m y solo cuenta las celdas dentro del polígono", () => {
    const ring = squareFromArea(PEREIRA, 1);
    const plan = planTerrainGrid({ ...PEREIRA, ring });
    expect(plan.size).toBe(10);
    expect(plan.locations).toHaveLength(100);
    expect(plan.spacingMeters).toBe(30);
    const counted = plan.locations.filter((_, index) => plan.included[index]);
    expect(counted.length).toBeGreaterThanOrEqual(3);
    expect(counted.length).toBeLessThan(64);
    for (const { lat, lon } of counted) expect(pointInRing(lat, lon, ring)).toBe(true);
  });

  it("para un lote grande agranda la celda para que la malla lo cubra", () => {
    const plan = planTerrainGrid({ ...PEREIRA, ring: squareFromArea(PEREIRA, 100) });
    expect(plan.spacingMeters).toBeGreaterThan(130);
    expect(plan.spacingMeters).toBeLessThan(160);
    expect(plan.included.filter(Boolean).length).toBeGreaterThan(20);
  });

  it("si el lote es tan chico que no cabe ninguna celda, mide alrededor del centro en vez de quedarse sin dato", () => {
    const plan = planTerrainGrid({ ...PEREIRA, ring: squareFromArea(PEREIRA, 0.001) });
    expect(plan.included.filter(Boolean)).toHaveLength(64);
  });
});

describe("pointInRing", () => {
  // Anillo GeoJSON [lon, lat]: un cuadrado de 4 × 4 con una muesca en forma de "V" que entra por el norte hasta (lon 2, lat 2).
  const ring = [[0, 0], [4, 0], [4, 4], [2, 2], [0, 4], [0, 0]] as const;
  it("distingue dentro y fuera, también en un polígono cóncavo", () => {
    expect(pointInRing(1, 1, ring)).toBe(true); // lat 1, lon 1: cuerpo del polígono
    expect(pointInRing(3, 3.5, ring)).toBe(true); // lat 3, lon 3.5: brazo este
    expect(pointInRing(3.5, 2, ring)).toBe(false); // lat 3.5, lon 2: dentro de la muesca
    expect(pointInRing(1, 6, ring)).toBe(false); // lat 1, lon 6: fuera de la caja
  });
});

describe("summarizeTerrainGrid", () => {
  const plan = planTerrainGrid(PEREIRA);

  it("recupera la pendiente y la altitud de un plano inclinado", () => {
    const result = summarizeTerrainGrid(planeElevations(plan, { eastSlope: 0.1 }), plan);
    expect(result?.slopePercent).toBeCloseTo(10, 1);
    expect(result?.slopeRangePercent[0]).toBeCloseTo(10, 1);
    expect(result?.slopeRangePercent[1]).toBeCloseTo(10, 1);
    expect(result?.elevationMeters).toBe(1500);
    expect(result?.cellMeters).toBe(30);
  });

  it("combina las dos direcciones: 6 % al este y 8 % al norte dan 10 %", () => {
    expect(summarizeTerrainGrid(planeElevations(plan, { eastSlope: 0.06, northSlope: 0.08 }), plan)?.slopePercent).toBeCloseTo(10, 1);
  });

  it("un terreno plano da 0 %", () => {
    expect(summarizeTerrainGrid(planeElevations(plan), plan)?.slopePercent).toBe(0);
  });

  it("promedia y muestra el rango cuando la pendiente cambia dentro del lote", () => {
    const { size } = plan;
    // Ladera que se empina hacia el este: la pendiente crece con la distancia al centro.
    const center = plan.locations[40]!;
    const metersEast = (lon: number) => (lon - center.lon) * EARTH_METERS_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180);
    const curved = plan.locations.map(({ lon }) => 1500 + 0.001 * metersEast(lon) ** 2);
    const all = summarizeTerrainGrid(curved, plan)!;
    expect(all.slopeRangePercent[1]).toBeGreaterThan(all.slopePercent);
    expect(all.slopeRangePercent[0]).toBeLessThan(all.slopePercent);
    const eastOnly = summarizeTerrainGrid(curved, { ...plan, included: plan.included.map((value, index) => value && index % size >= 5) })!;
    expect(eastOnly.slopePercent).toBeGreaterThan(all.slopePercent);
  });

  it("no pasa de 100 % aunque la pared sea más empinada", () => {
    const result = summarizeTerrainGrid(planeElevations(plan, { eastSlope: 1.5 }), plan);
    expect(result?.slopePercent).toBe(100);
    expect(result?.slopeRangePercent[1]).toBe(100);
  });

  it("devuelve null sin datos o con muy pocas celdas utilizables", () => {
    expect(summarizeTerrainGrid(plan.locations.map(() => null), plan)).toBeNull();
    const field = planeElevations(plan, { eastSlope: 0.1 }) as Array<number | null>;
    const keep = new Set([40, 31, 32, 33, 39, 41, 49, 50, 51]); // solo queda una celda con sus ocho vecinos
    expect(summarizeTerrainGrid(field.map((value, index) => (keep.has(index) ? value : null)), plan)).toBeNull();
  });

  it("ignora las celdas con huecos y promedia las demás", () => {
    const field = planeElevations(plan, { eastSlope: 0.1 }) as Array<number | null>;
    field[10] = null;
    const result = summarizeTerrainGrid(field, plan);
    expect(result?.slopePercent).toBeCloseTo(10, 1);
  });

  it("rechaza una lista de altitudes que no calza con la malla", () => {
    expect(() => summarizeTerrainGrid([1, 2, 3], plan)).toThrow("malla");
  });
});
