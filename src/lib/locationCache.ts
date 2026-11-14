import { locationResultSchema, type LocationResult } from "../types";

const STORAGE_KEY = "heimdall.geocode.cache.v1";

export type LocationStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): LocationStorage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch { return null; }
}

function cacheKey(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

/** Lee una ubicación guardada sin romper la búsqueda si el navegador bloquea almacenamiento. */
export function readLocationCache(query: string, storage?: LocationStorage): LocationResult | null {
  const target = storage ?? browserStorage();
  if (!target) return null;
  try {
    const raw = target.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entries: unknown = JSON.parse(raw);
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) return null;
    const value = (entries as Record<string, unknown>)[cacheKey(query)];
    const parsed = locationResultSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

/** Guarda una ubicación en caché local; los fallos de cuota o privacidad se ignoran. */
export function writeLocationCache(query: string, location: LocationResult, storage?: LocationStorage): void {
  const target = storage ?? browserStorage();
  if (!target) return;
  try {
    const raw = target.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const entries: Record<string, unknown> = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { ...(parsed as Record<string, unknown>) } : {};
    entries[cacheKey(query)] = locationResultSchema.parse(location);
    target.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* El almacenamiento local es opcional. */ }
}
