import { describe, expect, it } from "vitest";
import { analysisRequestSchema, farmSchema } from "../src/types";

const centroid = { lat: 4.8133, lon: -75.6961 };

describe("contrato Farm", () => {
  it("acepta terreno por punto y área aproximada", () => {
    expect(farmSchema.safeParse({ centroid, locationSource: "search", terrain: { kind: "point" } }).success).toBe(true);
    expect(farmSchema.safeParse({
      centroid, locationSource: "map", terrain: { kind: "approx_size", areaHa: 3, areaRangeHa: [1, 5] },
    }).success).toBe(true);
  });

  it("acepta polígonos con anillo cerrado en orden GeoJSON [lon, lat]", () => {
    const farm = {
      centroid, locationSource: "map",
      terrain: { kind: "polygon", areaHa: 1, ring: [[-75.7, 4.81], [-75.69, 4.81], [-75.69, 4.82], [-75.7, 4.81]] },
    };
    expect(farmSchema.safeParse(farm).success).toBe(true);
  });

  it("rechaza anillo abierto, área negativa, polígono sin ring y coordenadas inválidas", () => {
    const valid = { centroid, locationSource: "map", terrain: { kind: "point" } };
    expect(farmSchema.safeParse({ ...valid, terrain: { kind: "polygon", areaHa: 1, ring: [[-75, 4], [-74, 4], [-74, 5], [-75, 5]] } }).success).toBe(false);
    expect(farmSchema.safeParse({ ...valid, terrain: { kind: "approx_size", areaHa: -1, areaRangeHa: [1, 5] } }).success).toBe(false);
    expect(farmSchema.safeParse({ ...valid, terrain: { kind: "polygon", areaHa: 1 } }).success).toBe(false);
    expect(farmSchema.safeParse({ ...valid, centroid: { lat: 91, lon: 0 } }).success).toBe(false);
    expect(farmSchema.safeParse({ ...valid, centroid: { lat: 0, lon: 181 } }).success).toBe(false);
  });

  it("solo admite precisión GPS cuando la ubicación viene del GPS", () => {
    expect(farmSchema.safeParse({ centroid, locationSource: "gps", accuracyM: 42, terrain: { kind: "point" } }).success).toBe(true);
    expect(farmSchema.safeParse({ centroid, locationSource: "search", accuracyM: 42, terrain: { kind: "point" } }).success).toBe(false);
  });

  it("acepta AnalysisRequest antiguo y el mismo contrato con Farm", () => {
    const request = { lat: centroid.lat, lon: centroid.lon, startYear: 2020, endYear: 2022, priorities: { waterSaving: 2, extraIncome: 2, soilImprovement: 2, erosionReduction: 2, lowRisk: 2 } };
    expect(analysisRequestSchema.safeParse(request).success).toBe(true);
    expect(analysisRequestSchema.safeParse({ ...request, farm: { centroid, locationSource: "map", terrain: { kind: "point" } } }).success).toBe(true);
  });
});
