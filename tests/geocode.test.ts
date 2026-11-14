import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearGeocodeCache, geocodeLocation, parseGeocodeResponse } from "../src/lib/geocode";

const validPayload = [{ lat: "4.8133", lon: "-75.6961", display_name: "Pereira, Risaralda, Colombia" }];

describe("geocode", () => {
  beforeEach(() => clearGeocodeCache());

  it("parsea una respuesta válida de Nominatim", () => {
    expect(parseGeocodeResponse(validPayload)).toEqual({ lat: 4.8133, lon: -75.6961, label: "Pereira, Risaralda, Colombia" });
  });

  it("devuelve null para una respuesta vacía y falla si está malformada", () => {
    expect(parseGeocodeResponse([])).toBeNull();
    expect(() => parseGeocodeResponse([{ lat: "sin-coordenadas" }])).toThrow("malformada");
  });

  it("reutiliza caché para consultas normalizadas", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(validPayload), { status: 200 })));
    const dependencies = { fetcher, sleep: vi.fn().mockResolvedValue(undefined) };
    const first = await geocodeLocation(" Pereira, Colombia ", dependencies);
    const second = await geocodeLocation("pereira, colombia", dependencies);
    expect(first).toEqual(second);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("espera un segundo entre consultas distintas", async () => {
    let now = 0;
    const sleep = vi.fn(async (milliseconds: number) => { now += milliseconds; });
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(validPayload), { status: 200 })));
    const dependencies = { fetcher, sleep, now: () => now };
    await geocodeLocation("Pereira", dependencies);
    await geocodeLocation("Armenia", dependencies);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
