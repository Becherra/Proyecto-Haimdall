import { describe, expect, it } from "vitest";
import { locationResultSchema } from "../src/types";

describe("contrato de ubicación", () => {
  it("acepta coordenadas y etiqueta válidas", () => {
    expect(locationResultSchema.safeParse({ lat: 4.8133, lon: -75.6961, label: "Pereira, Colombia" }).success).toBe(true);
    expect(locationResultSchema.safeParse({ lat: 4.8133, lon: -75.6961, label: "Pereira, Colombia", boundingBox: [4.6, 4.9, -75.9, -75.3] }).success).toBe(true);
  });

  it("rechaza coordenadas fuera del planeta", () => {
    expect(locationResultSchema.safeParse({ lat: 91, lon: -75, label: "Lugar" }).success).toBe(false);
  });
});
