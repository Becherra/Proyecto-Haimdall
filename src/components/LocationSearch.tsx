"use client";

import { useState } from "react";
import { readLocationCache, writeLocationCache } from "../lib/ui/locationCache";
import { geolocationErrorMessage, requestCurrentLocation } from "../services/geolocation";
import { locationResultSchema, type LocationResult } from "../types";

type LocationSearchProps = { onLocationSelected: (location: LocationResult, accuracyMeters?: number) => void };

export default function LocationSearch({ onLocationSelected }: LocationSearchProps) {
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
    try {
      const coords = await requestCurrentLocation();
      const location = locationResultSchema.parse({ lat: coords.latitude, lon: coords.longitude, label: "Tu ubicación actual" });
      onLocationSelected(location, coords.accuracy);
    } catch (caught) {
      setError(geolocationErrorMessage(caught));
    } finally { setLocating(false); }
  }

  return <div className="w-full max-w-xl">
    <form onSubmit={submitSearch} noValidate>
    <label htmlFor="location-query" className="mb-2 block text-sm font-medium text-slate-200">Busca tu finca o municipio</label>
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-cyan-200" aria-hidden="true">⌕</span>
        <input id="location-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca tu finca, ciudad o región..." className="min-h-14 w-full rounded-xl border border-white/15 bg-white/10 py-3 pl-11 pr-4 text-base text-white outline-none placeholder:text-slate-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/60" aria-invalid={Boolean(error)} aria-describedby={error ? "location-error" : undefined} />
      </div>
      <button type="submit" disabled={loading} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-7 font-semibold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-wait disabled:opacity-60"><span aria-hidden="true">⌕</span>{loading ? "Buscando…" : "Buscar"}</button>
    </div>
    {loading && <p className="mt-3 text-sm text-cyan-200" role="status" aria-live="polite">Consultando OpenStreetMap…</p>}
    </form>
    <div className="mt-3 rounded-xl border border-cyan-200/20 bg-cyan-950/30 p-3 text-left">
      <p className="text-xs text-cyan-100">Usaremos tu ubicación para mostrarte tu zona. No la guardamos.</p>
      <button type="button" onClick={useCurrentLocation} disabled={locating || loading} className="mt-3 flex min-h-14 w-full items-center justify-center rounded-xl border border-cyan-200/60 bg-cyan-100 px-5 py-3 text-base font-bold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-wait disabled:opacity-60">{locating ? "Obteniendo ubicación…" : "Usar mi ubicación actual"}</button>
    </div>
    {error && <p id="location-error" className="mt-3 text-left text-sm text-rose-300" role="alert">{error}</p>}
  </div>;
}
