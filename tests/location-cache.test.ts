import { describe, expect, it } from "vitest";
import { readLocationCache, writeLocationCache, type LocationStorage } from "../src/lib/locationCache";

function fakeStorage(initial?: string): LocationStorage {
  let value = initial ?? null;
  return { getItem: () => value, setItem: (_key, next) => { value = next; } };
}

describe("caché local de ubicaciones", () => {
  it("guarda y lee consultas normalizadas", () => {
    const storage = fakeStorage();
    const location = { lat: 4.8133, lon: -75.6961, label: "Pereira, Colombia" };
    writeLocationCache(" Pereira, Colombia ", location, storage);
    expect(readLocationCache("pereira, colombia", storage)).toEqual(location);
  });

  it("ignora JSON corrupto sin lanzar errores", () => {
    const storage = fakeStorage("{no es json");
    expect(readLocationCache("Pereira", storage)).toBeNull();
    expect(() => writeLocationCache("Pereira", { lat: 4, lon: -75, label: "Pereira" }, storage)).not.toThrow();
  });
});
