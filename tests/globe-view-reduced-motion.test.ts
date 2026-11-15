import { describe, expect, it } from "vitest";
import { calculateGlobeView } from "../src/lib/ui/globeView";

describe("vuelo de globo con movimiento reducido", () => {
  it("mantiene el destino y elimina la transición cuando el usuario reduce movimiento", () => {
    expect(calculateGlobeView(true, 390, true)).toEqual({ altitude: 0.6, transitionMs: 0 });
  });
});
