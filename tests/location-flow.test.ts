import { describe, expect, it } from "vitest";
import { initialLocationFlow, locationFlowReducer } from "../src/lib/ui/locationFlow";
import type { LocationResult } from "../src/types";

const location: LocationResult = { lat: 4.81, lon: -75.69, label: "Pereira" };

describe("locationFlowReducer", () => {
  it("recorre búsqueda, vuelo, transición, mapa y confirmación", () => {
    let state = locationFlowReducer(initialLocationFlow, { type: "buscar", location });
    expect(state.status).toBe("flying");
    state = locationFlowReducer(state, { type: "vueloTerminado" });
    expect(state.status).toBe("transitioning");
    state = locationFlowReducer(state, { type: "vueloTerminado" });
    expect(state.status).toBe("map");
    expect(locationFlowReducer(state, { type: "confirmar" }).status).toBe("confirmed");
  });

  it("conserva la precisión GPS y permite el camino de ubicación", () => {
    let state = locationFlowReducer(initialLocationFlow, { type: "locating" });
    expect(state.status).toBe("locating");
    state = locationFlowReducer(state, { type: "gpsOk", location, accuracyMeters: 42 });
    expect(state).toMatchObject({ status: "flying", accuracyMeters: 42 });
    state = locationFlowReducer(state, { type: "vueloTerminado", instantaneo: true });
    expect(state.status).toBe("map");
  });

  it("expone errores y vuelve al estado inicial desde el mapa", () => {
    let state = locationFlowReducer(initialLocationFlow, { type: "gpsError", message: "Permiso denegado" });
    expect(state).toMatchObject({ status: "error", message: "Permiso denegado" });
    state = locationFlowReducer(state, { type: "buscar", location });
    state = locationFlowReducer(state, { type: "vueloTerminado", instantaneo: true });
    expect(locationFlowReducer(state, { type: "volver" })).toEqual(initialLocationFlow);
  });

  it("ignora eventos inválidos sin mutar el estado", () => {
    expect(locationFlowReducer(initialLocationFlow, { type: "confirmar" })).toEqual(initialLocationFlow);
    const flying = locationFlowReducer(initialLocationFlow, { type: "buscar", location });
    expect(locationFlowReducer(flying, { type: "volver" })).toEqual(flying);
    expect(locationFlowReducer(flying, { type: "vueloTerminado" }).status).toBe("transitioning");
  });
});

describe("elegir la zona en el globo", () => {
  it("pasa directo al mapa sin volver a volar", () => {
    expect(locationFlowReducer(initialLocationFlow, { type: "elegirEnGlobo", location })).toEqual({ status: "map", location });
  });

  it("no interrumpe un vuelo ni un mapa ya abierto", () => {
    const flying = locationFlowReducer(initialLocationFlow, { type: "buscar", location });
    expect(locationFlowReducer(flying, { type: "elegirEnGlobo", location: { ...location, lat: 1 } })).toBe(flying);
  });
});
