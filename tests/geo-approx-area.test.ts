import { describe, expect, it } from "vitest";
import { validateTerrain } from "../src/lib/geo";
import type { FarmTerrain } from "../src/types";

describe("validación de área manual", () => {
  it("acepta el área exacta sin un rango estimado", () => {
    const exactArea = { kind: "approx_size", areaHa: 2.35 } as unknown as FarmTerrain;
    expect(validateTerrain(exactArea).valid).toBe(true);
  });
});
