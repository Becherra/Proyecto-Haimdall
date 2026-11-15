import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSuggestCache, parseSuggestResponse, suggestLocations } from "../src/lib/suggest";

const feature = (properties: Record<string, unknown>, coordinates: [number, number] = [-75.6792, 4.7172]) => ({ type: "Feature", geometry: { type: "Point", coordinates }, properties });
const farm = feature({ name: "Finca La Esperanza", city: "Yarumal", state: "Risaralda", country: "Colombia", osm_value: "farm" });
const okResponse = (features: unknown[]) => new Response(JSON.stringify({ type: "FeatureCollection", features }), { status: 200 });

describe("suggest", () => {
  beforeEach(() => clearSuggestCache());

  it("convierte una finca de Photon en una ubicación con etiqueta legible", () => {
    expect(parseSuggestResponse({ features: [farm] })).toEqual([{ lat: 4.7172, lon: -75.6792, label: "Finca La Esperanza, Yarumal, Risaralda, Colombia" }]);
  });

  it("reordena el extent de Photon a [sur, norte, oeste, este]", () => {
    const town = feature({ name: "Santa Rosa de Cabal", state: "Risaralda", country: "Colombia", extent: [-75.7185, 4.9752, -75.3755, 4.6979] });
    expect(parseSuggestResponse({ features: [town] })[0]?.boundingBox).toEqual([4.6979, 4.9752, -75.7185, -75.3755]);
  });

  it("no repite el nombre cuando coincide con el municipio y omite duplicados", () => {
    const city = feature({ name: "Pereira", city: "Pereira", state: "Risaralda", country: "Colombia" });
    const results = parseSuggestResponse({ features: [city, city] });
    expect(results).toHaveLength(1);
    expect(results[0]?.label).toBe("Pereira, Risaralda, Colombia");
  });

  it("ignora resultados sin nombre o con coordenadas fuera de rango", () => {
    const unnamed = feature({ country: "Colombia" });
    const outOfRange = feature({ name: "Lugar raro" }, [-75, 999]);
    expect(parseSuggestResponse({ features: [unnamed, outOfRange, farm] })).toHaveLength(1);
  });

  it("devuelve lista vacía sin resultados y falla si la respuesta es malformada", () => {
    expect(parseSuggestResponse({ features: [] })).toEqual([]);
    expect(() => parseSuggestResponse({ nada: true })).toThrow("malformada");
  });

  it("consulta Photon con límite de 5 y sesgo hacia Colombia, y cachea consultas iguales", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(okResponse([farm])));
    const first = await suggestLocations(" Finca La  Esperanza ", { fetcher });
    const second = await suggestLocations("finca la esperanza", { fetcher });
    expect(first).toEqual(second);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = String(fetcher.mock.calls[0]?.[0]);
    expect(url).toContain("limit=5");
    expect(url).toContain("lat=4.57");
    expect(fetcher.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ headers: expect.objectContaining({ "User-Agent": expect.any(String) }) }));
  });

  it("rechaza consultas de menos de 3 caracteres", () => {
    expect(() => suggestLocations("ab")).toThrow("3 caracteres");
  });

  it("falla con mensaje claro si el servicio no responde y no cachea el error", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(okResponse([farm]));
    await expect(suggestLocations("Pereira", { fetcher })).rejects.toThrow("conectar");
    await expect(suggestLocations("Pereira", { fetcher })).resolves.toHaveLength(1);
  });

  it("falla si el servicio responde con un error HTTP", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    await expect(suggestLocations("Pereira", { fetcher })).rejects.toThrow("HTTP 429");
  });
});
