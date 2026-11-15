import { describe, expect, it } from "vitest";
import { convertCoordinateOrder } from "../src/lib/geo";

describe("conversión de orden de coordenadas", () => {
  it("convierte Leaflet [lat, lon] a GeoJSON [lon, lat] y de vuelta", () => {
    const geoJson = convertCoordinateOrder([4.8133, -75.6961], "leaflet");
    expect(geoJson).toEqual([-75.6961, 4.8133]);
    expect(convertCoordinateOrder(geoJson, "geojson")).toEqual([4.8133, -75.6961]);
  });
});
