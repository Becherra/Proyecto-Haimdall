import { describe, expect, it } from "vitest";
import { formatCoordinates, validateMapLocation } from "../src/lib/ui/coordinates";

describe("coordenadas del mapa", () => {
  it("valida y formatea un pin", () => {
    const location = validateMapLocation(4.813345, -75.696123);
    expect(formatCoordinates(location)).toBe("Lat 4.8133 · Lon -75.6961");
  });

  it("rechaza coordenadas fuera del mundo", () => {
    expect(() => validateMapLocation(91, 0)).toThrow();
    expect(() => validateMapLocation(0, -181)).toThrow();
  });
});
