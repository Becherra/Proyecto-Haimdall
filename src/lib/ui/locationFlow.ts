import type { LocationResult } from "../../types";

export type LocationFlowState =
  | { status: "idle"; location: null; accuracyMeters?: undefined }
  | { status: "locating"; location: null; accuracyMeters?: undefined }
  | { status: "flying" | "transitioning" | "map" | "confirmed"; location: LocationResult; accuracyMeters?: number }
  | { status: "error"; location: null; message: string; accuracyMeters?: undefined };

export type LocationFlowEvent =
  | { type: "buscar"; location: LocationResult }
  | { type: "locating" }
  | { type: "gpsOk"; location: LocationResult; accuracyMeters: number }
  | { type: "gpsError"; message: string }
  | { type: "vueloTerminado"; instantaneo?: boolean }
  | { type: "volver" }
  | { type: "confirmar" };

export const initialLocationFlow: LocationFlowState = { status: "idle", location: null };

/** Mantiene el flujo de ubicación explícito para que los temporizadores de UI sean cancelables. */
export function locationFlowReducer(state: LocationFlowState, event: LocationFlowEvent): LocationFlowState {
  switch (event.type) {
    case "locating":
      return state.status === "idle" || state.status === "error" ? { status: "locating", location: null } : state;
    case "buscar":
      if (!["idle", "error"].includes(state.status)) return state;
      return { status: "flying", location: event.location };
    case "gpsOk":
      if (!["idle", "locating", "error"].includes(state.status)) return state;
      return { status: "flying", location: event.location, accuracyMeters: event.accuracyMeters };
    case "gpsError":
      if (!["idle", "locating", "error"].includes(state.status)) return state;
      return { status: "error", location: null, message: event.message };
    case "vueloTerminado":
      if (state.status === "flying") return event.instantaneo ? { ...state, status: "map" } : { ...state, status: "transitioning" };
      if (state.status === "transitioning") return { ...state, status: "map" };
      return state;
    case "volver":
      if (state.status === "map" || state.status === "confirmed") return initialLocationFlow;
      return state;
    case "confirmar":
      return state.status === "map" ? { ...state, status: "confirmed" } : state;
    default:
      return state;
  }
}
