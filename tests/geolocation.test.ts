import { describe, expect, it, vi } from "vitest";
import { geolocationErrorMessage, getGeolocationAttempts, requestCurrentLocation, type GeolocationProvider } from "../src/services/geolocation";

function fakeCoords(): GeolocationCoordinates {
  return { latitude: 4.8, longitude: -75.7, accuracy: 1200, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) };
}

function fakeProvider(behaviors: Array<(success: PositionCallback, error: PositionErrorCallback) => void>): GeolocationProvider {
  let call = 0;
  return { getCurrentPosition: vi.fn((success, error) => behaviors[call++](success, error)) };
}

describe("geolocation desktop-friendly attempts", () => {
  it("starts with fast cached options and retries precisely after timeout", async () => {
    const provider = fakeProvider([
      (_success, error) => error({ code: 3, message: "timeout", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
      (success) => success({ coords: fakeCoords(), timestamp: 0, toJSON: () => ({}) }),
    ]);
    await expect(requestCurrentLocation(provider)).resolves.toMatchObject({ accuracy: 1200 });
    expect(provider.getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(provider.getCurrentPosition).toHaveBeenNthCalledWith(1, expect.any(Function), expect.any(Function), { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
    expect(provider.getCurrentPosition).toHaveBeenNthCalledWith(2, expect.any(Function), expect.any(Function), { enableHighAccuracy: true, timeout: 20000, maximumAge: 300000 });
  });

  it("does not retry a denied permission and reports the browser code", async () => {
    const provider = fakeProvider([(_success, error) => error({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })]);
    await expect(requestCurrentLocation(provider)).rejects.toMatchObject({ reason: "permission-denied", code: 1 });
    expect(provider.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("retries unavailable position and exposes a specific final message", async () => {
    const provider = fakeProvider([
      (_success, error) => error({ code: 2, message: "unavailable", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
      (_success, error) => error({ code: 2, message: "unavailable", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
    ]);
    await expect(requestCurrentLocation(provider)).rejects.toMatchObject({ reason: "unavailable", code: 2 });
    expect(geolocationErrorMessage("unavailable")).toContain("revisa la señal");
  });

  it("cancels an active request without starting the retry", async () => {
    const controller = new AbortController();
    const provider = fakeProvider([() => undefined]);
    const request = requestCurrentLocation(provider, controller.signal);
    controller.abort();
    await expect(request).rejects.toMatchObject({ reason: "cancelled" });
    expect(provider.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("flags accuracy over one kilometer and documents both settings", () => {
    expect(fakeCoords().accuracy).toBeGreaterThan(1000);
    expect(getGeolocationAttempts()).toHaveLength(2);
    expect(geolocationErrorMessage("permission-denied")).toContain("buscar por nombre");
  });
});
