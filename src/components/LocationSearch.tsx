"use client";

import { useState } from "react";
import { readLocationCache, writeLocationCache } from "../lib/ui/locationCache";
import { geolocationErrorMessage, isGeolocationFailure, requestCurrentLocation } from "../services/geolocation";
import { locationResultSchema, type LocationResult } from "../types";

type LocationSearchProps = { onLocationSelected: (location: LocationResult, accuracyMeters?: number) => void; onGpsStart?: () => void; onGpsLocationSelected?: (location: LocationResult, accuracyMeters: number) => void; onGpsError?: (message: string) => void };

export default function LocationSearch({ onLocationSelected, onGpsStart, onGpsLocationSelected, onGpsError }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2 || normalized.length > 100) { setError("Escribe una ubicación de 2 a 100 caracteres."); return; }
    setError(null);
    const cached = readLocationCache(normalized);
    if (cached) { onLocationSelected(cached); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(normalized)}`);
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "No se encontró esa ubicación.");
      const parsed = locationResultSchema.safeParse(payload);
      if (!parsed.success) throw new Error("La respuesta de ubicación no es válida.");
      writeLocationCache(normalized, parsed.data);
      onLocationSelected(parsed.data);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible buscar la ubicación."); }
    finally { setLoading(false); }
  }

  async function useCurrentLocation() {
    setError(null);
    setLocating(true);
    onGpsStart?.();
    try {
      const coords = await requestCurrentLocation();
      const location = locationResultSchema.parse({ lat: coords.latitude, lon: coords.longitude, label: "Tu ubicación actual" });
      (onGpsLocationSelected ?? onLocationSelected)(location, coords.accuracy);
    } catch (caught) {
      const message = geolocationErrorMessage(caught && typeof caught === "object" && "reason" in caught && isGeolocationFailure(caught.reason) ? caught.reason : "unavailable");
      setError(message);
      onGpsError?.(message);
    } finally { setLocating(false); }
  }

  return <div className="w-full max-w-xl">
    <form onSubmit={submitSearch} noValidate>
    <label htmlFor="location-query" className="mb-2 block text-left text-sm font-medium text-silver-mist">Encuentra tu finca o municipio</label>
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-cream" aria-hidden="true">⌕</span>
        <input id="location-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca tu finca, ciudad o región..." className="min-h-14 w-full rounded-full border border-cream/25 bg-transparent py-3 pl-11 pr-4 text-base text-bone-white outline-none placeholder:text-ash-gray focus:border-cream focus:ring-2 focus:ring-cream/50" aria-invalid={Boolean(error)} aria-describedby={error ? "location-error" : undefined} />
      </div>
      <button type="submit" disabled={loading} className="flex min-h-14 items-center justify-center gap-2 rounded-full border border-cream/30 px-7 font-semibold text-bone-white transition hover:border-cream hover:text-cream focus:outline-none focus:ring-2 focus:ring-cream focus:ring-offset-2 focus:ring-offset-black disabled:cursor-wait disabled:opacity-60"><span aria-hidden="true">⌕</span>{loading ? "Buscando…" : "Buscar"}</button>
    </div>
    {loading && <p className="mt-3 text-sm text-cream" role="status" aria-live="polite">Consultando OpenStreetMap…</p>}
    </form>
    <div className="mt-3 text-left">
      <p className="text-xs text-ash-gray">Usaremos tu ubicación para mostrarte tu zona. No la guardamos.</p>
      <button type="button" onClick={useCurrentLocation} disabled={locating || loading} className="mt-3 flex min-h-14 w-full items-center justify-center rounded-full bg-cream px-5 py-3 text-base font-semibold text-meadow transition hover:bg-bone-white focus:outline-none focus:ring-2 focus:ring-cream focus:ring-offset-2 focus:ring-offset-black disabled:cursor-wait disabled:opacity-60">{locating ? "Obteniendo ubicación…" : "Usar mi ubicación actual"}</button>
    </div>
    {error && <p id="location-error" className="mt-3 text-left text-sm text-clay-light" role="alert">{error}</p>}
  </div>;
}
