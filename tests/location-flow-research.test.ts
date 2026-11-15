import { describe, expect, it } from "vitest";
import { initialLocationFlow, locationFlowReducer } from "../src/lib/ui/locationFlow";

const first = { lat: 4.81, lon: -75.7, label: "Pereira" };
const second = { lat: 5.07, lon: -75.52, label: "Santa Rosa de Cabal" };

describe("búsqueda durante el vuelo", () => {
  it("cancela la ubicación previa y vuela hacia el último resultado", () => {
    const flying = locationFlowReducer(initialLocationFlow, { type: "buscar", location: first });
    const replaced = locationFlowReducer(flying, { type: "buscar", location: second });
    expect(replaced).toEqual({ status: "flying", location: second });
  });

  it("permite reemplazar el destino durante el fundido", () => {
    const flying = locationFlowReducer(initialLocationFlow, { type: "buscar", location: first });
    const transitioning = locationFlowReducer(flying, { type: "vueloTerminado" });
    expect(locationFlowReducer(transitioning, { type: "buscar", location: second })).toEqual({ status: "flying", location: second });
  });
});
