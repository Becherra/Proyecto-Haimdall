import { describe, expect, it } from "vitest";
import { calculateGlobeView, cameraNearPlane, canMarkFarmAt, GLOBE_ZOOM_LIMITS, globeCurvatureResolution, globeRotateSpeed, globeZoomSpeed, nextGlobeSurface, tapZoomAltitude, visibleHalfSpanDegrees } from "../src/lib/ui/globeView";

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

describe("el globo como mapa", () => {
  it("cambia a satélite al acercarse y vuelve al relieve al alejarse, sin parpadear en el borde", () => {
    expect(nextGlobeSurface("relief", 1.5)).toBe("relief");
    expect(nextGlobeSurface("relief", 0.29)).toBe("satellite");
    expect(nextGlobeSurface("satellite", 0.35)).toBe("satellite");
    expect(nextGlobeSurface("relief", 0.35)).toBe("relief");
    expect(nextGlobeSurface("satellite", 0.41)).toBe("relief");
  });

  it("deja bajar hasta ~250 m y alejarse más que la vista inicial", () => {
    expect(GLOBE_ZOOM_LIMITS.minAltitude * 6371000).toBeLessThan(300);
    expect(GLOBE_ZOOM_LIMITS.maxAltitude).toBeGreaterThanOrEqual(2.5);
    expect(GLOBE_ZOOM_LIMITS.markBelow).toBeLessThan(GLOBE_ZOOM_LIMITS.satelliteBelow);
  });

  it("solo ofrece marcar la finca cuando ya se ve el terreno", () => {
    expect(canMarkFarmAt(0.5)).toBe(false);
    expect(canMarkFarmAt(0.01)).toBe(false);
    expect(canMarkFarmAt(0.0025)).toBe(true);
    expect(canMarkFarmAt(GLOBE_ZOOM_LIMITS.minAltitude)).toBe(true);
  });

  it("cada paso de rueda cambia la altitud ~15 % o menos, también cerca del suelo", () => {
    for (const altitude of [2.5, 0.5, 0.05, 0.001, GLOBE_ZOOM_LIMITS.minAltitude]) {
      const radius = 100;
      const distance = radius * (1 + altitude);
      const step = distance * (1 - 0.95 ** globeZoomSpeed(altitude));
      expect(step / (radius * altitude)).toBeLessThanOrEqual(0.16);
      expect(globeZoomSpeed(altitude)).toBeGreaterThan(0);
    }
    expect(globeZoomSpeed(2.5)).toBeCloseTo(Math.sqrt(2.5) * 0.5);
  });

  it("cerca del suelo, arrastrar mueve el terreno al ritmo del dedo", () => {
    // Arrastrar todo el alto de la pantalla gira 2π·velocidad; en pantalla caben 2·tan(25°)·altitud radios de terreno.
    for (const altitude of [0.2, 0.01, GLOBE_ZOOM_LIMITS.minAltitude]) {
      const ratio = (2 * Math.PI * globeRotateSpeed(altitude)) / (2 * Math.tan((25 * Math.PI) / 180) * altitude);
      expect(ratio).toBeCloseTo(1, 1);
    }
    expect(globeRotateSpeed(2.5)).toBeCloseTo(0.705);
    expect(globeRotateSpeed(0.3)).toBeCloseTo(0.045);
  });

  it("acerca el plano cercano de la cámara con la altitud, sin pasar los límites", () => {
    expect(cameraNearPlane(2.5, 100)).toBe(0.05);
    expect(cameraNearPlane(0.001, 100)).toBeCloseTo(0.02);
    expect(cameraNearPlane(0, 100)).toBe(0.0001);
    expect(cameraNearPlane(GLOBE_ZOOM_LIMITS.minAltitude, 100)).toBeLessThan(GLOBE_ZOOM_LIMITS.minAltitude * 100);
  });

  it("tocar acerca a un cuarto de la altura, hasta el mínimo", () => {
    expect(tapZoomAltitude(1)).toBeCloseTo(0.25);
    expect(tapZoomAltitude(GLOBE_ZOOM_LIMITS.minAltitude)).toBe(GLOBE_ZOOM_LIMITS.minAltitude);
  });

  it("calcula cuánto terreno se ve para abrir el editor con la misma vista", () => {
    expect(visibleHalfSpanDegrees(0)).toBe(0);
    // A 1 radio de altura se ven ±26,7° de latitud (tan 25° × 57,3°).
    expect(visibleHalfSpanDegrees(1)).toBeCloseTo(26.72, 1);
    expect(visibleHalfSpanDegrees(-1)).toBe(0);
  });
});
