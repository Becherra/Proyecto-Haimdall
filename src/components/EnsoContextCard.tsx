"use client";

import { useEffect, useState } from "react";
import type { CurrentSeason } from "../types";
import { DROUGHT_CATEGORY_LABEL, formatDroughtMonth, summarizeDroughtForecast } from "../lib/ui/droughtForecast";
import { describeLocalClimateSignal } from "../lib/ui/localClimateSignal";
import { getDroughtForecast, type DroughtForecastResult } from "../services/droughtForecast";

type Props = {
  season?: CurrentSeason;
  coordinates: { lat: number; lon: number };
  locationLabel: string;
  mockMode: boolean;
};

type ForecastState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; result: DroughtForecastResult };

const CATEGORY_STYLE = {
  none: "border-olive/40 bg-meadow/35 text-silver-mist",
  D0: "border-olive-light/40 bg-olive/25 text-bone-white",
  D1: "border-cream/40 bg-cream/10 text-bone-white",
  D2: "border-amber-300/50 bg-amber-500/15 text-bone-white",
  D3: "border-orange-300/60 bg-orange-500/20 text-bone-white",
  D4: "border-red-300/60 bg-red-500/20 text-bone-white",
} as const;

export default function EnsoContextCard({ season, coordinates, locationLabel, mockMode }: Props) {
  const [forecastState, setForecastState] = useState<{ requestKey: string; state: Exclude<ForecastState, { status: "loading" }> } | null>(null);
  const { lat, lon } = coordinates;
  const requestKey = `${lat}:${lon}:${mockMode}`;
  const currentState: ForecastState = forecastState?.requestKey === requestKey ? forecastState.state : { status: "loading" };
  const localSignal = season ? describeLocalClimateSignal(season) : null;
  const rainfallText = formatRainfall(localSignal?.rainPercent);
  const temperatureText = formatTemperature(localSignal?.temperatureAnomalyC);

  useEffect(() => {
    let current = true;
    getDroughtForecast({ lat, lon }, 3, mockMode)
      .then((result) => { if (current) setForecastState({ requestKey, state: { status: "ready", result } }); })
      .catch((error: unknown) => {
        if (current) setForecastState({ requestKey, state: { status: "error", message: error instanceof Error ? error.message : "No pudimos obtener el pronóstico." } });
      });
    return () => { current = false; };
  }, [lat, lon, mockMode, requestKey]);

  const forecastResult = currentState.status === "ready" ? currentState.result : null;
  const forecast = forecastResult?.forecast ?? null;
  const summary = forecast ? summarizeDroughtForecast(forecast) : null;

  return <article data-reveal className="rounded-3xl border border-cream/30 bg-moss card-surface p-4 lg:col-span-3" aria-labelledby="enso-context-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cream/15 text-cream" aria-hidden="true"><span className="text-2xl font-bold">⌁</span></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cream">Pronóstico de sequía · IDEAM</p>
          <h3 id="enso-context-title" className="mt-1 text-xl font-bold text-bone-white">¿Qué se prevé para tu zona?</h3>
        </div>
      </div>
      {forecast && <span className="rounded-full border border-olive-light/40 px-3 py-1 text-sm text-silver-mist">Actualizado {formatIssueDate(forecast.issuedAt)}</span>}
    </div>

    {currentState.status === "loading" && <p className="mt-4 rounded-2xl border border-olive/40 bg-meadow/30 p-4 text-sm text-silver-mist" role="status">Consultando el pronóstico para {locationLabel}…</p>}
    {currentState.status === "error" && <div className="mt-4 rounded-2xl border border-cream/30 bg-black/15 p-4" role="alert">
      <p className="font-semibold text-bone-white">No tenemos el pronóstico de tu zona todavía.</p>
      <p className="mt-1 text-sm leading-5 text-silver-mist">{currentState.message}</p>
    </div>}

    {forecast && summary && <>
      <div className="mt-4 rounded-2xl border border-olive/40 bg-meadow/40 p-4">
        {forecastResult?.isSample && <p className="mb-3 inline-flex rounded-full border border-cream/40 px-3 py-1 text-xs font-bold text-cream">Muestra real de Pereira · no se ajusta a tu ubicación</p>}
        <p className="text-lg font-bold leading-6 text-bone-white">{summary.headline}</p>
        <p className="mt-2 text-sm leading-5 text-silver-mist">Este resultado corresponde a la zona hidrográfica {forecast.hydrographicZone} y usa una escala de {forecast.aggregationMonths} meses. Es una señal regional: no confirma falta de agua ni daños en tu finca.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Pronóstico mensual de sequía">
          {forecast.months.filter(({ month }) => month >= forecast.forecastStartMonth).map(({ month, category }) => <li key={month} className={`flex min-h-16 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${CATEGORY_STYLE[category]}`}>
            <span className="font-semibold capitalize">{formatDroughtMonth(month)}</span>
            <span className="text-right">{simpleCategoryLabel(category)}</span>
          </li>)}
        </ul>
        <p className="mt-4 text-sm leading-5 text-bone-white"><strong>¿Qué puede significar?</strong> {summary.meaning}</p>
        <p className="mt-2 text-sm leading-5 text-silver-mist"><strong>¿Qué conviene vigilar?</strong> La disponibilidad de agua y la humedad del suelo de tu lote al acercarse esos meses. El efecto en el cultivo depende de cuál tengas y de su etapa.</p>
      </div>

      <details className="mt-3 rounded-xl border border-cream/20 px-3 py-2 text-sm text-silver-mist">
        <summary className="min-h-10 cursor-pointer py-2 font-semibold text-cream focus:outline-none focus-visible:ring-4 focus-visible:ring-cream/50">¿Qué significa este pronóstico?</summary>
        <p className="pb-2 leading-5">El IDEAM combina señales de lluvia, humedad del suelo y escorrentía para estimar condiciones secas en zonas hidrográficas. ENSO (El Niño–Oscilación del Sur) aporta contexto climático, pero esta categoría no demuestra que ENSO haya causado la señal ni que el lote ya esté afectado.</p>
        <p className="pb-2 text-xs">Categoría técnica: {summary.category === "none" ? "sin sequía" : `${summary.category} · ${DROUGHT_CATEGORY_LABEL[summary.category]}`}; índice agregado a {forecast.aggregationMonths} meses.</p>
      </details>
      <a href={forecast.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-cream/50 px-4 text-sm font-semibold text-cream underline-offset-4 hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-cream/50">Ver boletín del IDEAM<span className="sr-only"> (abre en una pestaña nueva)</span></a>
    </>}

    <section className="mt-4 rounded-2xl border border-olive/40 bg-meadow/40 p-3" aria-labelledby="nasa-observation-title">
      <p id="nasa-observation-title" className="text-xs font-bold uppercase tracking-wider text-olive-light">Lo que ya observó NASA POWER en esta ubicación</p>
      {localSignal ? <>
        <p className="mt-1 font-bold text-bone-white">{localSignal.label}</p>
        <p className="mt-1 text-sm leading-5 text-silver-mist">Hasta {localSignal.observedThrough}: {rainfallText}; {temperatureText}</p>
        <p className="mt-2 text-sm leading-5 text-silver-mist">{localSignal.meaning}</p>
      </> : <p className="mt-1 text-sm leading-5 text-silver-mist">No hay observación reciente suficiente para comparar con el pronóstico.</p>}
      <p className="mt-1 text-xs text-ash-gray">NASA POWER muestra una observación climática regional reciente, no un pronóstico ni una medición del lote.</p>
    </section>
  </article>;
}

function simpleCategoryLabel(category: keyof typeof CATEGORY_STYLE): string {
  if (category === "none") return "Sin señal seca";
  if (category === "D0") return "Más seco de lo habitual";
  return DROUGHT_CATEGORY_LABEL[category];
}

function formatRainfall(value: number | null | undefined): string {
  return value === null || value === undefined ? "comparación de lluvia no disponible" : `${Math.round(value)} % de la lluvia habitual`;
}

function formatTemperature(value: number | null | undefined): string {
  if (value === null || value === undefined) return "anomalía de temperatura no disponible";
  return `temperatura ${value > 0 ? "+" : ""}${value.toFixed(1)} °C frente a lo habitual`;
}

function formatIssueDate(value: string): string {
  const [year = "", month = "", day = ""] = value.split("-");
  const monthName = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" }).format(new Date(`${year}-${month}-01T00:00:00Z`)).replace(".", "");
  return `${Number(day)} ${monthName} ${year}`;
}
