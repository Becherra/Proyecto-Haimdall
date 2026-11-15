import { describe, expect, it } from "vitest";
import { farmSchema } from "../src/types";

describe("área aproximada en Farm", () => {
  const base = { centroid: { lat: 4.81, lon: -75.7 }, locationSource: "map" as const };

  it("permite un área manual exacta sin rango", () => {
    expect(farmSchema.safeParse({ ...base, terrain: { kind: "approx_size", areaHa: 2.35 } }).success).toBe(true);
  });

  it("sigue aceptando un área estimada con su rango", () => {
    expect(farmSchema.safeParse({ ...base, terrain: { kind: "approx_size", areaHa: 3, areaRangeHa: [1, 5] } }).success).toBe(true);
  });
});
