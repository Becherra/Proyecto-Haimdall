import { describe, expect, it } from "vitest";
import { createTerrainEditor, getTerrainEditorStatus, terrainEditorReducer } from "../src/lib/ui/terrainEditor";
import type { LocationResult } from "../src/types";

const location: LocationResult = { lat: 4.81, lon: -75.7, label: "Finca de prueba" };

function addSquare(state = createTerrainEditor(location)) {
  let next = terrainEditorReducer(state, { type: "set-mode", mode: "polygon" });
  for (const [lat, lon] of [[4.8091, -75.7011], [4.8091, -75.6989], [4.8109, -75.6989], [4.8109, -75.7011]] as const) {
    next = terrainEditorReducer(next, { type: "add-vertex", lat, lon });
  }
  return next;
}

describe("terrainEditorReducer", () => {
  it("cambia modos y conserva la ubicación elegida", () => {
    const initial = createTerrainEditor(location);
    const changed = terrainEditorReducer(initial, { type: "set-mode", mode: "approx_size" });
    expect(changed.mode).toBe("approx_size");
    expect(changed.location).toEqual(location);
  });

  it("guarda rangos aproximados y convierte el valor manual desde m² a ha", () => {
    let state = terrainEditorReducer(createTerrainEditor(location), { type: "set-mode", mode: "approx_size" });
    state = terrainEditorReducer(state, { type: "set-area-range", range: [1, 5] });
    expect(getTerrainEditorStatus(state)).toMatchObject({ canConfirm: true, areaHa: 3 });
    state = terrainEditorReducer(state, { type: "set-exact-area", value: 23_500, unit: "m2" });
    expect(state).toMatchObject({ exactAreaHa: 2.35, areaRangeHa: null, areaUnit: "m2" });
    state = terrainEditorReducer(state, { type: "set-area-unit", unit: "ha" });
    expect(state.exactAreaHa).toBe(2.35);
    expect(getTerrainEditorStatus(state)).toMatchObject({ canConfirm: true, areaHa: 2.35 });
  });

  it("bloquea el tamaño aproximado si el cuadrado sale de los límites del mapa", () => {
    const edgeLocation: LocationResult = { lat: 0, lon: 179.9999, label: "Borde del mapa" };
    let state = terrainEditorReducer(createTerrainEditor(edgeLocation), { type: "set-mode", mode: "approx_size" });
    state = terrainEditorReducer(state, { type: "set-area-range", range: [1, 5] });
    expect(getTerrainEditorStatus(state)).toMatchObject({ canConfirm: false });
  });

  it("añade y arrastra vértices, deshace el último y borra el dibujo", () => {
    let state = addSquare();
    expect(state.vertices).toHaveLength(4);
    state = terrainEditorReducer(state, { type: "move-vertex", index: 0, lat: 4.8092, lon: -75.7012 });
    expect(state.vertices[0]).toEqual([-75.7012, 4.8092]);
    state = terrainEditorReducer(state, { type: "undo" });
    expect(state.vertices).toHaveLength(3);
    state = terrainEditorReducer(state, { type: "clear" });
    expect(state.vertices).toHaveLength(0);
  });

  it("termina un polígono válido y coloca el pin en su centroide", () => {
    const finished = terrainEditorReducer(addSquare(), { type: "finish" });
    expect(finished.polygonFinished).toBe(true);
    expect(finished.location.lat).toBeCloseTo(4.81, 5);
    expect(finished.location.lon).toBeCloseTo(-75.7, 5);
    expect(getTerrainEditorStatus(finished).canConfirm).toBe(true);
  });

  it("bloquea la confirmación ante un lazo y conserva el error hasta corregirlo", () => {
    let state = terrainEditorReducer(createTerrainEditor(location), { type: "set-mode", mode: "polygon" });
    for (const [lat, lon] of [[4.81, -75.7], [4.82, -75.69], [4.82, -75.7], [4.81, -75.69]] as const) {
      state = terrainEditorReducer(state, { type: "add-vertex", lat, lon });
    }
    expect(getTerrainEditorStatus(state).canConfirm).toBe(false);
    state = terrainEditorReducer(state, { type: "finish" });
    expect(state.error).toMatch(/cruza consigo mismo/);
    expect(getTerrainEditorStatus(state).canConfirm).toBe(false);
  });

  it("no termina sin al menos tres vértices", () => {
    const state = terrainEditorReducer(createTerrainEditor(location), { type: "set-mode", mode: "polygon" });
    expect(terrainEditorReducer(state, { type: "finish" }).error).toMatch(/tres vértices/);
  });
});

describe("terrainEditorReducer · lazo a mano", () => {
  const lasso = [[4.8091, -75.7011], [4.8091, -75.6989], [4.8109, -75.6989], [4.8109, -75.7011]] as const;

  it("set-polygon deja el terreno cerrado y listo para confirmar", () => {
    const state = terrainEditorReducer(createTerrainEditor(location), { type: "set-polygon", points: lasso });
    expect(state).toMatchObject({ mode: "polygon", polygonFinished: true, error: null });
    expect(getTerrainEditorStatus(state).canConfirm).toBe(true);
  });

  it("set-polygon con un lazo mínimo no confirma y explica el error", () => {
    const state = terrainEditorReducer(createTerrainEditor(location), { type: "set-polygon", points: [[4.8, -75.7], [4.8, -75.7001]] });
    expect(state.polygonFinished).toBe(false);
    expect(state.error).not.toBeNull();
    expect(getTerrainEditorStatus(state).canConfirm).toBe(false);
  });

  it("reset vuelve al punto original", () => {
    const initial = createTerrainEditor(location);
    const drawn = terrainEditorReducer(initial, { type: "set-polygon", points: lasso });
    expect(terrainEditorReducer(drawn, { type: "reset", initial })).toEqual(initial);
  });
});
