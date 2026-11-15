import type { FarmTerrain, LocationResult } from "../../types";
import { convertCoordinateOrder, polygonAreaHa, polygonCentroid, representativeAreaHa, validateTerrain } from "../geo";
import type { GeoJsonPosition, GeoJsonRing, TerrainValidation } from "../geo";

export type TerrainEditorMode = "point" | "approx_size" | "polygon";
export type AreaRangeHa = readonly [number, number];
export type TerrainEditorState = {
  location: LocationResult;
  mode: TerrainEditorMode;
  areaRangeHa: AreaRangeHa | null;
  exactAreaHa: number | null;
  areaUnit: "ha" | "m2";
  vertices: readonly GeoJsonPosition[];
  polygonFinished: boolean;
  error: string | null;
};
export type TerrainEditorEvent =
  | { type: "set-mode"; mode: TerrainEditorMode }
  | { type: "set-location"; location: LocationResult }
  | { type: "set-area-range"; range: AreaRangeHa | null }
  | { type: "set-exact-area"; value: number | null; unit: "ha" | "m2" }
  | { type: "add-vertex"; lat: number; lon: number }
  | { type: "move-vertex"; index: number; lat: number; lon: number }
  | { type: "undo" }
  | { type: "clear" }
  | { type: "finish" };
export type TerrainEditorStatus = {
  canConfirm: boolean;
  areaHa: number | null;
  error: string | null;
  warnings: string[];
  validation: TerrainValidation | null;
};

export function createTerrainEditor(location: LocationResult): TerrainEditorState {
  return { location, mode: "point", areaRangeHa: null, exactAreaHa: null, areaUnit: "ha", vertices: [], polygonFinished: false, error: null };
}

function closedRing(vertices: readonly GeoJsonPosition[]): GeoJsonRing {
  const first = vertices[0];
  return first ? [...vertices, first] : [];
}

function polygonValidation(state: TerrainEditorState): { ring: GeoJsonRing; areaHa: number; validation: TerrainValidation } | null {
  if (state.vertices.length < 3) return null;
  const ring = closedRing(state.vertices);
  try {
    const areaHa = polygonAreaHa(ring);
    const validation = validateTerrain({ kind: "polygon", areaHa, ring: ring.map(([lon, lat]) => [lon, lat]) });
    return { ring, areaHa, validation };
  } catch (error) {
    return { ring, areaHa: 0, validation: { valid: false, errors: [error instanceof Error ? error.message : "No se pudo validar el terreno."], warnings: [] } };
  }
}

/** Derives live area and confirmation eligibility without mutating editor state. */
export function getTerrainEditorStatus(state: TerrainEditorState): TerrainEditorStatus {
  if (state.mode === "point") return { canConfirm: true, areaHa: null, error: null, warnings: [], validation: null };
  if (state.mode === "approx_size") {
    const areaHa = state.exactAreaHa ?? (state.areaRangeHa ? representativeAreaHa(state.areaRangeHa) : null);
    if (areaHa === null) return { canConfirm: false, areaHa: null, error: "Elige un rango o escribe el área aproximada.", warnings: [], validation: null };
    const terrain: FarmTerrain = {
      kind: "approx_size", areaHa,
      ...(state.exactAreaHa === null && state.areaRangeHa ? { areaRangeHa: [state.areaRangeHa[0], state.areaRangeHa[1]] as [number, number] } : {}),
    };
    const validation = validateTerrain(terrain);
    return { canConfirm: validation.valid, areaHa, error: validation.errors[0] ?? null, warnings: validation.warnings, validation };
  }
  const result = polygonValidation(state);
  if (!result) return { canConfirm: false, areaHa: null, error: "Añade al menos tres vértices y pulsa Terminar.", warnings: [], validation: null };
  const error = result.validation.errors[0] ?? (state.polygonFinished ? null : "Pulsa Terminar para cerrar y validar el terreno.");
  return { canConfirm: state.polygonFinished && result.validation.valid, areaHa: result.areaHa, error, warnings: result.validation.warnings, validation: result.validation };
}

function updateLocation(state: TerrainEditorState, lat: number, lon: number): LocationResult {
  return { lat, lon, label: state.location.label };
}

/** Pure reducer for terrain mode, approximate size, draft vertices, undo, clearing and completion. */
export function terrainEditorReducer(state: TerrainEditorState, event: TerrainEditorEvent): TerrainEditorState {
  switch (event.type) {
    case "set-mode":
      return { ...state, mode: event.mode, error: null };
    case "set-location":
      return { ...state, location: event.location, error: null };
    case "set-area-range":
      return { ...state, areaRangeHa: event.range, exactAreaHa: null, error: null };
    case "set-exact-area":
      return { ...state, exactAreaHa: event.value === null ? null : event.unit === "m2" ? event.value / 10_000 : event.value, areaRangeHa: null, areaUnit: event.unit, error: null };
    case "add-vertex":
      if (state.mode !== "polygon") return state;
      return { ...state, vertices: [...state.vertices, convertCoordinateOrder([event.lat, event.lon], "leaflet")], polygonFinished: false, error: null };
    case "move-vertex": {
      if (state.mode !== "polygon" || !state.vertices[event.index]) return state;
      const vertices = state.vertices.map((point, index) => index === event.index ? convertCoordinateOrder([event.lat, event.lon], "leaflet") : point);
      return { ...state, vertices, polygonFinished: false, error: null };
    }
    case "undo":
      return { ...state, vertices: state.vertices.slice(0, -1), polygonFinished: false, error: null };
    case "clear":
      return { ...state, vertices: [], polygonFinished: false, error: null };
    case "finish": {
      if (state.mode !== "polygon") return state;
      const result = polygonValidation(state);
      if (!result || !result.validation.valid) return { ...state, error: result?.validation.errors[0] ?? "Dibuja al menos tres vértices antes de terminar." };
      const centroid = polygonCentroid(result.ring);
      return { ...state, location: updateLocation(state, centroid.lat, centroid.lon), polygonFinished: true, error: null };
    }
    default:
      return state;
  }
}
