import { afterEach, describe, expect, it, vi } from "vitest";
import { getDroughtForecast } from "../src/services/droughtForecast";
import { mockDroughtForecast } from "../src/mocks/droughtForecast";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getDroughtForecast", () => {
  it("uses an explicit sample in mock mode without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await getDroughtForecast({ lat: 4.8133, lon: -75.6961 }, 3, true);
    expect(result).toEqual({ forecast: mockDroughtForecast, isSample: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests the backend with coordinates and aggregation and validates its response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(mockDroughtForecast));
    vi.stubGlobal("fetch", fetchMock);
    const result = await getDroughtForecast({ lat: 4.8133, lon: -75.6961 }, 6, false);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/drought?lat=4.8133&lon=-75.6961&aggregation=6");
    expect(result).toEqual({ forecast: mockDroughtForecast, isSample: false });
  });

  it("reports when the backend route is not connected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(getDroughtForecast({ lat: 4.8133, lon: -75.6961 }, 3, false)).rejects.toThrow("aún no está conectado");
  });

  it("rejects malformed responses rather than showing unvalidated data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ source: "NASA" })));
    await expect(getDroughtForecast({ lat: 4.8133, lon: -75.6961 }, 3, false)).rejects.toThrow("formato esperado");
  });
});
