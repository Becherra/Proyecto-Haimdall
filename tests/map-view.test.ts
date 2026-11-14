import { describe, expect, it } from "vitest";
import { calculateMapView } from "../src/lib/ui/mapView";

const base = { lat: 4.8133, lon: -75.6961, label: "Pereira" };

describe("vista inicial del mapa", () => {
  it("limita un bbox pequeño a zoom 16", () => {
    expect(calculateMapView({ ...base, boundingBox: [4.812, 4.814, -75.697, -75.695] })).toMatchObject({ targetZoom: 16, showPinHint: false });
  });

  it("mantiene un bbox de ciudad entre 12 y 16", () => {
    const view = calculateMapView({ ...base, boundingBox: [4.66, 4.91, -75.94, -75.37] });
    expect(view.targetZoom).toBeGreaterThanOrEqual(12);
    expect(view.targetZoom).toBeLessThanOrEqual(16);
    expect(view.bounds).toEqual([[4.66, -75.94], [4.91, -75.37]]);
  });

  it("usa zoom 15 sin bbox", () => {
    expect(calculateMapView(base)).toEqual({ targetZoom: 15, showPinHint: false });
  });

  it("usa zoom 17 con GPS preciso", () => {
    expect(calculateMapView(base, 30)).toEqual({ targetZoom: 17, showPinHint: false });
  });

  it("reduce zoom y muestra aviso con GPS impreciso", () => {
    expect(calculateMapView(base, 1200)).toEqual({ targetZoom: 13, showPinHint: true });
    expect(calculateMapView(base, 600).targetZoom).toBe(14);
  });
});
