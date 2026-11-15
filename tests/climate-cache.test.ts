import { describe, expect, it } from "vitest";
import { createPromiseCache } from "../src/lib/climateCache";

/** Reloj controlable: el vencimiento se prueba sin esperar de verdad. */
function clock(start = 1_000) {
  let current = start;
  return { now: () => current, advance: (milliseconds: number) => { current += milliseconds; } };
}

describe("createPromiseCache", () => {
  it("devuelve la promesa guardada mientras no venza", async () => {
    const time = clock();
    const cache = createPromiseCache<string>({ maxEntries: 5, now: time.now });
    cache.set("a", Promise.resolve("uno"), 1_000);
    time.advance(999);
    await expect(cache.get("a")).resolves.toBe("uno");
  });

  it("olvida la entrada cuando vence su tiempo de vida", () => {
    const time = clock();
    const cache = createPromiseCache<string>({ maxEntries: 5, now: time.now });
    cache.set("a", Promise.resolve("uno"), 1_000);
    time.advance(1_000);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("al pasar del máximo descarta la entrada menos usada, no la más antigua", async () => {
    const cache = createPromiseCache<string>({ maxEntries: 2 });
    cache.set("a", Promise.resolve("A"), 60_000);
    cache.set("b", Promise.resolve("B"), 60_000);
    await cache.get("a");
    cache.set("c", Promise.resolve("C"), 60_000);
    expect(cache.get("b")).toBeUndefined();
    await expect(cache.get("a")).resolves.toBe("A");
    await expect(cache.get("c")).resolves.toBe("C");
    expect(cache.size).toBe(2);
  });

  it("reemplazar una llave no duplica entradas", () => {
    const cache = createPromiseCache<string>({ maxEntries: 2 });
    cache.set("a", Promise.resolve("1"), 60_000);
    cache.set("a", Promise.resolve("2"), 60_000);
    expect(cache.size).toBe(1);
  });

  it("expireIn acorta la vida de la entrada indicada", () => {
    const time = clock();
    const cache = createPromiseCache<string>({ maxEntries: 5, now: time.now });
    const value = Promise.resolve("respaldo");
    cache.set("a", value, 60_000);
    cache.expireIn("a", value, 100);
    time.advance(100);
    expect(cache.get("a")).toBeUndefined();
  });

  it("expireIn ignora una entrada que ya fue reemplazada por otra promesa", async () => {
    const time = clock();
    const cache = createPromiseCache<string>({ maxEntries: 5, now: time.now });
    const old = Promise.resolve("viejo");
    cache.set("a", old, 60_000);
    cache.set("a", Promise.resolve("nuevo"), 60_000);
    cache.expireIn("a", old, 1);
    time.advance(10);
    await expect(cache.get("a")).resolves.toBe("nuevo");
  });

  it("delete y clear vacían la caché", () => {
    const cache = createPromiseCache<string>({ maxEntries: 5 });
    cache.set("a", Promise.resolve("1"), 60_000);
    cache.set("b", Promise.resolve("2"), 60_000);
    cache.delete("a");
    expect(cache.get("a")).toBeUndefined();
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("rechaza un máximo que no sea un entero positivo", () => {
    for (const maxEntries of [0, -1, 1.5]) expect(() => createPromiseCache<string>({ maxEntries })).toThrow("maxEntries");
  });
});
