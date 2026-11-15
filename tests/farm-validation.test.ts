import { describe, expect, it } from "vitest";
import { validateFarmDraft } from "../src/lib/geo/farmValidation";
import { buildFarmFromEditor, createTerrainEditor, terrainEditorReducer } from "../src/lib/ui/terrainEditor";

describe("validateFarmDraft", () => {
  it("accepts point farms and exact approximate areas", () => {
    expect(validateFarmDraft({ centroid: { lat: 4.81, lon: -75.7 }, locationSource: "search", terrain: { kind: "point" } }).valid).toBe(true);
    expect(validateFarmDraft({ centroid: { lat: 4.81, lon: -75.7 }, locationSource: "map", terrain: { kind: "approx_size", areaHa: 2.5 } }).valid).toBe(true);
  });

  it("accepts the closed one-hectare GeoJSON ring documented for Santi", () => {
    const result = validateFarmDraft({
      centroid: { lat: 4.8133, lon: -75.6961 }, locationSource: "gps", accuracyM: 42,
      placeLabel: "Finca cerca de Pereira",
      terrain: { kind: "polygon", areaHa: 1, ring: [
        [-75.6965507452, 4.8128508444], [-75.6956492548, 4.8128508444],
        [-75.6956492548, 4.8137491556], [-75.6965507452, 4.8137491556],
        [-75.6965507452, 4.8128508444],
      ] },
    });
    expect(result).toMatchObject({ valid: true });
  });

  it("rejects invalid coordinates and invalid polygon geometry", () => {
    expect(validateFarmDraft({ centroid: { lat: 95, lon: -75.7 }, locationSource: "search", terrain: { kind: "point" } })).toMatchObject({ valid: false });
    expect(validateFarmDraft({ centroid: { lat: 4.81, lon: -75.7 }, locationSource: "map", terrain: { kind: "polygon", areaHa: 1, ring: [[-75.7, 4.81], [-75.7, 4.82], [-75.69, 4.81], [-75.7, 4.81]] } })).toMatchObject({ valid: false });
  });

  it("builds a valid Farm for each terrain mode", () => {
    const location = { lat: 4.8133, lon: -75.6961, label: "Pereira" };
    const point = buildFarmFromEditor(createTerrainEditor(location));
    expect(point?.terrain).toEqual({ kind: "point" });

    let approximate = terrainEditorReducer(createTerrainEditor(location), { type: "set-mode", mode: "approx_size" });
    approximate = terrainEditorReducer(approximate, { type: "set-exact-area", value: 2.5, unit: "ha" });
    expect(buildFarmFromEditor(approximate)?.terrain).toEqual({ kind: "approx_size", areaHa: 2.5 });

    let polygon = terrainEditorReducer(createTerrainEditor(location), { type: "set-mode", mode: "polygon" });
    for (const [lat, lon] of [[4.81285, -75.69655], [4.81285, -75.69565], [4.81375, -75.69565], [4.81375, -75.69655]] as const) {
      polygon = terrainEditorReducer(polygon, { type: "add-vertex", lat, lon });
    }
    polygon = terrainEditorReducer(polygon, { type: "finish" });
    expect(buildFarmFromEditor(polygon)?.terrain.kind).toBe("polygon");
  });
});
