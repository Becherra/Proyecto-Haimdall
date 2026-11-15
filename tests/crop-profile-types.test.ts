import { describe, expect, it } from "vitest";
import { claimSchema, cropProfileSelectionSchema, managementMeasureSchema, threatResponseSchema } from "../src/types";

describe("contrato de perfiles de cultivo", () => {
  it("rechaza una afirmación sin fuente", () => {
    expect(claimSchema.safeParse({ statement: "Porte bajo", sources: [] }).success).toBe(false);
    expect(claimSchema.safeParse({ statement: "Porte bajo", sources: [{ sourceId: "cenicafe-at476" }] }).success).toBe(true);
  });

  it("guarda lo no documentado como ausencia explícita, sin valor", () => {
    const undocumented = threatResponseSchema.parse({ threatId: "roya", response: { status: "undocumented", reason: "La fuente no lo evalúa" } });
    expect(undocumented.response).not.toHaveProperty("value");
    expect(threatResponseSchema.safeParse({ threatId: "roya", response: { status: "documented", value: "resistente", sources: [] } }).success).toBe(false);
  });

  it("no admite una categoría de medida química", () => {
    const measure = { id: "fumigar", kind: "quimico", action: "x", stageIds: [], condition: "x", reason: "x", verification: "x", sources: [{ sourceId: "s" }] };
    expect(managementMeasureSchema.safeParse(measure).success).toBe(false);
  });

  it("limita la descripción libre de síntomas y no exige problema observado", () => {
    const base = { cropId: "cafe", cultivarId: "unknown", stageId: "unknown" };
    expect(cropProfileSelectionSchema.safeParse(base).success).toBe(true);
    expect(cropProfileSelectionSchema.safeParse({ ...base, symptomsNote: "x".repeat(281) }).success).toBe(false);
  });
});
