import { describe, expect, it } from "vitest";
import { GLOBE_RELIEF } from "../src/lib/config";
import { calculateGlobeView, globeCurvatureResolution, referenceLayerScale } from "../src/lib/ui/globeView";

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

describe("malla del globo con relieve", () => {
  it("usa una malla más liviana en celular", () => {
    expect(globeCurvatureResolution(true)).toBeGreaterThan(globeCurvatureResolution(false));
    expect(360 / globeCurvatureResolution(true)).toBe(360);
    expect(360 / globeCurvatureResolution(false)).toBe(720);
  });
});

describe("capa de nombres y límites", () => {
  it("queda por encima de la montaña más alta del relieve", () => {
    expect(referenceLayerScale()).toBeGreaterThan(1 + GLOBE_RELIEF.maxHeightRatio);
    expect(referenceLayerScale()).toBeLessThan(1.05);
  });
});
