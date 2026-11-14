import { describe, expect, it } from "vitest";
import { buildGibsTileUrl, isGibsDateAvailable } from "../src/lib/ui/mapLayers";

describe("GIBS tile URLs", () => {
  it("construye la URL de color real verificada", () => {
    expect(buildGibsTileUrl("trueColor", "2026-11-14")).toContain("MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-11-14/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg");
  });

  it("construye la URL NDVI verificada", () => {
    expect(buildGibsTileUrl("ndvi", "2026-10-16")).toContain("MODIS_Terra_L3_NDVI_16Day/default/2026-10-16");
  });

  it("rechaza fechas sin cobertura", () => {
    expect(isGibsDateAvailable("ndvi", "2026-11-14")).toBe(false);
    expect(() => buildGibsTileUrl("ndvi", "2026-11-14")).toThrow("no tiene datos");
  });

  it("rechaza fechas de calendario malformadas", () => {
    expect(() => buildGibsTileUrl("trueColor", "2026-02-31")).toThrow("no tiene datos");
  });
});
