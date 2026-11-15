"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { readLocationCache, writeLocationCache } from "../lib/ui/locationCache";
import { moveHighlight } from "../lib/ui/suggestNav";
import { geolocationErrorMessage, isGeolocationFailure, requestCurrentLocation } from "../services/geolocation";
import { locationResultSchema, type LocationResult } from "../types";

type LocationSearchProps = { onLocationSelected: (location: LocationResult, accuracyMeters?: number) => void; onGpsStart?: () => void; onGpsLocationSelected?: (location: LocationResult, accuracyMeters: number) => void; onGpsError?: (message: string) => void };

const SUGGEST_DEBOUNCE_MS = 150;
const SUGGEST_MIN_CHARS = 3;
const suggestionsSchema = z.object({ results: z.array(locationResultSchema) });

export default function LocationSearch({ onLocationSelected, onGpsStart, onGpsLocationSelected, onGpsError }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const debounceTimer = useRef<number | undefined>(undefined);
  const suggestAbort = useRef<AbortController | null>(null);

  useEffect(() => () => { window.clearTimeout(debounceTimer.current); suggestAbort.current?.abort(); }, []);

  function cancelSuggestions() {
    window.clearTimeout(debounceTimer.current);
    suggestAbort.current?.abort();
    setSuggestions([]);
    setHighlight(-1);
  }

  /** Pide sugerencias; si falla simplemente no se muestran, la búsqueda normal sigue disponible. */
  async function loadSuggestions(text: string) {
    const controller = new AbortController();
    suggestAbort.current = controller;
    try {
      const response = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(text)}`, { signal: controller.signal });
      const parsed = response.ok ? suggestionsSchema.safeParse(await response.json()) : null;
      // Una respuesta vieja nunca debe pisar la de lo que se escribió después.
      if (!controller.signal.aborted) setSuggestions(parsed?.success ? parsed.data.results : []);
    } catch { if (!controller.signal.aborted) setSuggestions([]); }
  }

  /** La lista se queda visible mientras llega la siguiente, así cambia al ritmo de la escritura sin parpadear. */
  function onQueryChange(value: string) {
    setQuery(value);
    setError(null);
    window.clearTimeout(debounceTimer.current);
    suggestAbort.current?.abort();
    setHighlight(-1);
    if (value.trim().length < SUGGEST_MIN_CHARS) { setSuggestions([]); return; }
    debounceTimer.current = window.setTimeout(() => void loadSuggestions(value.trim()), SUGGEST_DEBOUNCE_MS);
  }

  function chooseSuggestion(location: LocationResult) {
    cancelSuggestions();
    setQuery(location.label);
    onLocationSelected(location);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setHighlight((current) => moveHighlight(current, suggestions.length, event.key as "ArrowDown" | "ArrowUp"));
    } else if (event.key === "Escape") cancelSuggestions();
  }

  async function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const highlighted = suggestions[highlight];
    if (highlighted) { chooseSuggestion(highlighted); return; }
    cancelSuggestions();
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
            <input id="location-query" value={query} onChange={(event) => onQueryChange(event.target.value)} onKeyDown={onInputKeyDown} placeholder="Escribe tu finca, vereda o municipio" autoComplete="off" role="combobox" aria-expanded={suggestions.length > 0} aria-controls="location-suggestions" aria-autocomplete="list" aria-activedescendant={highlight >= 0 ? `location-suggestion-${highlight}` : undefined} className="min-h-14 w-full rounded-full border border-cream/40 bg-transparent pl-5 pr-16 text-base text-bone-white outline-none placeholder:text-ash-gray focus:border-cream focus:ring-2 focus:ring-cream/50" aria-invalid={Boolean(error)} aria-describedby={error ? "location-error" : undefined} />
            <button type="submit" disabled={loading || locating} aria-label="Buscar ubicación" className="absolute inset-y-1 right-1 flex w-11 items-center justify-center rounded-full text-3xl font-bold text-cream transition hover:bg-cream/15 focus:outline-none focus:ring-2 focus:ring-cream disabled:cursor-wait disabled:opacity-60">{loading ? <span aria-hidden="true" className="text-2xl">…</span> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.8-4.8" /></svg>}</button>
            {suggestions.length > 0 && <ul id="location-suggestions" role="listbox" aria-label="Lugares sugeridos" className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-3xl border border-cream/40 bg-meadow text-left shadow-lg">
              {suggestions.map((suggestion, index) => <li key={`${suggestion.lat}:${suggestion.lon}:${suggestion.label}`} id={`location-suggestion-${index}`} role="option" aria-selected={index === highlight} onMouseDown={(event) => { event.preventDefault(); chooseSuggestion(suggestion); }} onMouseEnter={() => setHighlight(index)} className={`cursor-pointer px-5 py-3 text-sm text-bone-white ${index === highlight ? "bg-cream/15" : ""}`}>{suggestion.label}</li>)}
            </ul>}
          </div>
        : <button type="button" onClick={onManualClick} disabled={locating} className="min-h-11 rounded-full border border-cream/40 px-5 text-sm font-medium text-silver-mist transition hover:border-cream hover:text-cream focus:outline-none focus:ring-2 focus:ring-cream disabled:cursor-wait disabled:opacity-60">Escribir mi ubicación</button>}
    </form>
    {loading && <p className="mt-3 text-center text-sm text-cream" role="status" aria-live="polite">Buscando…</p>}
    {error && <p id="location-error" className="mt-3 text-center text-sm text-clay-light" role="alert">{error}</p>}
  </div>;
}
