import { describe, expect, it } from "vitest";
import { createTerrainEditor, getTerrainEditorStatus, requiresGpsPinAdjustment, terrainEditorReducer } from "../src/lib/ui/terrainEditor";

const gps = { lat: 4.8133, lon: -75.6961, label: "Pereira" };

describe("terrain editor GPS provenance", () => {
  it("requires a pin adjustment before drawing when accuracy exceeds 500 m", () => {
    const initial = createTerrainEditor(gps, "gps", 620);
    const polygon = terrainEditorReducer(initial, { type: "set-mode", mode: "polygon" });
    expect(requiresGpsPinAdjustment(polygon)).toBe(true);
    expect(getTerrainEditorStatus(polygon).canConfirm).toBe(false);
    expect(terrainEditorReducer(polygon, { type: "add-vertex", lat: 4.81, lon: -75.7 }).vertices).toHaveLength(0);
  });

  it("clears GPS accuracy after the pin is moved", () => {
    const initial = createTerrainEditor(gps, "gps", 620);
    const moved = terrainEditorReducer(initial, { type: "set-location", location: { ...gps, lat: 4.82 }, locationSource: "map" });
    expect(requiresGpsPinAdjustment(moved)).toBe(false);
    expect(moved.accuracyM).toBeUndefined();
    expect(moved.pinAdjusted).toBe(true);
  });
});
