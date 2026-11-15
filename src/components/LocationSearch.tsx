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
  const [manualOpen, setManualOpen] = useState(false);

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

  /** El botón secundario abre el campo; la búsqueda se dispara con Enter o con la lupa. */
  function onManualClick(event: React.MouseEvent<HTMLButtonElement>) {
    setManualOpen(true);
    window.setTimeout(() => document.getElementById("location-query")?.focus(), 0);
  }

  return <div className="w-full max-w-xl">
    <button type="button" onClick={useCurrentLocation} disabled={locating || loading} className="flex min-h-16 w-full items-center justify-center rounded-full bg-cream px-6 py-4 text-lg font-bold text-meadow transition hover:bg-bone-white focus:outline-none focus:ring-2 focus:ring-cream focus:ring-offset-2 focus:ring-offset-meadow disabled:cursor-wait disabled:opacity-60">{locating ? "Obteniendo ubicación…" : "Usar mi ubicación actual"}</button>
    <form onSubmit={submitSearch} noValidate className="mt-4 flex justify-center">
      {manualOpen
        ? <div className="relative w-full">
            <label htmlFor="location-query" className="sr-only">Escribe tu finca o municipio</label>
            <input id="location-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Escribe tu vereda o municipio" className="min-h-14 w-full rounded-full border border-cream/40 bg-transparent pl-5 pr-16 text-base text-bone-white outline-none placeholder:text-ash-gray focus:border-cream focus:ring-2 focus:ring-cream/50" aria-invalid={Boolean(error)} aria-describedby={error ? "location-error" : undefined} />
            <button type="submit" disabled={loading || locating} aria-label="Buscar ubicación" className="absolute inset-y-1 right-1 flex w-11 items-center justify-center rounded-full text-3xl font-bold text-cream transition hover:bg-cream/15 focus:outline-none focus:ring-2 focus:ring-cream disabled:cursor-wait disabled:opacity-60"><span aria-hidden="true">{loading ? "…" : "⌕"}</span></button>
          </div>
        : <button type="button" onClick={onManualClick} disabled={locating} className="min-h-11 rounded-full border border-cream/40 px-5 text-sm font-medium text-silver-mist transition hover:border-cream hover:text-cream focus:outline-none focus:ring-2 focus:ring-cream disabled:cursor-wait disabled:opacity-60">Escribir mi ubicación</button>}
    </form>
    {loading && <p className="mt-3 text-center text-sm text-cream" role="status" aria-live="polite">Buscando…</p>}
    {error && <p id="location-error" className="mt-3 text-center text-sm text-clay-light" role="alert">{error}</p>}
  </div>;
}
