import { describe, expect, it } from "vitest";
import { calculateGlobeView } from "../src/lib/globeView";

describe("calculateGlobeView", () => {
  it("mantiene una vista amplia antes de seleccionar ubicación", () => {
    expect(calculateGlobeView(false, 1440)).toEqual({ altitude: 1.5, transitionMs: 0 });
  });

  it("se acerca suavemente en escritorio", () => {
    expect(calculateGlobeView(true, 1440)).toEqual({ altitude: 0.5, transitionMs: 2000 });
  });

  it("deja un poco más de contexto en móvil", () => {
    expect(calculateGlobeView(true, 375)).toEqual({ altitude: 0.6, transitionMs: 2000 });
  });
});
