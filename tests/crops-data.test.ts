import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mockAnalysisResponse } from "../src/mocks";
import { scoreRotations } from "../src/lib/scoring";
import { cropSchema } from "../src/types";

const raw = JSON.parse(readFileSync("data/crops.json", "utf8")) as unknown[];

describe("data/crops.json", () => {
  it("cumple el esquema Crop en todos los cultivos", () => {
    expect(raw.length).toBeGreaterThan(0);
    for (const crop of raw) expect(cropSchema.safeParse(crop).success).toBe(true);
  });

  it("tiene ids únicos y meses de siembra válidos, sin repetir", () => {
    const crops = raw.map((crop) => cropSchema.parse(crop));
    expect(new Set(crops.map((crop) => crop.id)).size).toBe(crops.length);
    for (const { sowingMonths } of crops) {
      expect(sowingMonths.length).toBeGreaterThan(0);
      expect(new Set(sowingMonths).size).toBe(sowingMonths.length);
    }
  });

  it("declara en cada fuente que los puntajes son preliminares y apunta a la rúbrica", () => {
    for (const { source } of raw.map((crop) => cropSchema.parse(crop))) {
      expect(source).toContain("preliminares");
      expect(source).toContain("docs/crops-rubric.md");
    }
  });

  it("contiene todos los cultivos que usan las rotaciones del mock", () => {
    const ids = new Set(raw.map((crop) => cropSchema.parse(crop).id));
    for (const { rotation } of mockAnalysisResponse.rotations) {
      for (const cropId of rotation.cropIds) expect(ids.has(cropId)).toBe(true);
    }
  });

  it("permite puntuar las rotaciones del mock con el catálogo real", () => {
    const crops = raw.map((crop) => cropSchema.parse(crop));
    const results = scoreRotations({
      rotations: mockAnalysisResponse.rotations.map((entry) => entry.rotation),
      crops,
      indicators: mockAnalysisResponse.indicators,
      priorities: { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 },
    });
    expect(results).toHaveLength(3);
    for (const { score } of results) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(5);
    }
  });
});
