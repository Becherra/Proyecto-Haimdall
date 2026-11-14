import { describe, expect, it } from "vitest";
import { analysisResponseSchema } from "../src/types";
import { mockAnalysisResponse } from "../src/mocks";

describe("mock de análisis", () => {
  it("está validado y contiene tres rotaciones explicables", () => {
    expect(analysisResponseSchema.safeParse(mockAnalysisResponse).success).toBe(true);
    expect(mockAnalysisResponse.rotations).toHaveLength(3);
    for (const rotation of mockAnalysisResponse.rotations) {
      expect(rotation.evidence.length).toBeGreaterThan(0);
      expect(rotation.informationGaps.length).toBeGreaterThan(0);
      expect(rotation.validateWithLocalExpert.length).toBeGreaterThan(0);
    }
  });
});
