"use client";

import { useMemo } from "react";
import { summarizeMonthlyClimate } from "../lib/ui/monthlyClimateSummary";
import type { AnalysisResponse, ClimateScenario, Farm, RotationResult } from "../types";

type AnalysisDashboardProps = {
  farm: Farm;
  response: AnalysisResponse;
  baseline: AnalysisResponse;
  scenarioDraft: ClimateScenario;
  mockMode: boolean;
  applyingScenario: boolean;
  scenarioError: string | null;
  onScenarioChange: (scenario: ClimateScenario) => void;
  onApplyScenario: () => void;
  onShowBaseline: () => void;
  onEditPriorities: () => void;
  onChangeFarm: () => void;
};

const number = (value: number | null | undefined, digits = 1) => value === null || value === undefined ? "Sin dato" : new Intl.NumberFormat("es-CO", { maximumFractionDigits: digits }).format(value);
const monthDate = (value: string | undefined) => value ? `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}` : null;
const sourceLabel = { live: "NASA POWER en vivo", cache: "NASA POWER · caché", sample: "Muestra NASA POWER" } as const;

function Indicator({ title, value, unit, note }: { title: string; value: string; unit?: string; note: string }) {
  return <article className="rounded-2xl border border-white/10 bg-[#101010] p-4 sm:p-5">
    <p className="text-xs font-medium text-slate-400">{title}</p>
    <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}{unit && <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>}</p>
    <p className="mt-1 text-[11px] leading-4 text-slate-500">{note}</p>
  </article>;
}

function ClimateChart({ response }: { response: AnalysisResponse }) {
  const summary = useMemo(() => summarizeMonthlyClimate(response.monthlyClimate), [response.monthlyClimate]);
  const maximum = Math.max(1, ...summary.flatMap((month) => [month.precipitationMm ?? 0, month.evaporationMm ?? 0]));
  const hasValues = summary.some((month) => month.precipitationMm !== null || month.evaporationMm !== null);
  const usesPotentialEvaporation = response.monthlyClimate.some((month) => month.potentialEvaporationMm !== undefined);

  return <section className="rounded-3xl border border-white/10 bg-[#0b0b0b] p-4 sm:p-6" aria-labelledby="climate-chart-title">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-saffron-spark">Clima de referencia</p><h3 id="climate-chart-title" className="mt-1 text-lg font-semibold text-white">Lluvia y evaporación por mes</h3></div>
      <div className="flex flex-wrap gap-4 text-xs text-slate-300"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#32c7b0]" aria-hidden="true" />Lluvia</span><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#8052ff]" aria-hidden="true" />{usesPotentialEvaporation ? "Evaporación potencial" : "Evaporación NASA"}</span></div>
    </div>
    {!hasValues ? <p className="mt-6 rounded-xl border border-white/10 p-4 text-sm text-slate-400" role="status">No hay valores mensuales suficientes para mostrar la gráfica.</p> : <>
      <div className="mt-6 grid h-44 grid-cols-6 gap-2 border-b border-l border-white/10 pb-1 sm:grid-cols-12 sm:gap-3" role="img" aria-label="Comparación mensual de lluvia y evaporación; valores promediados entre los años analizados.">
        {summary.map((month) => <div key={month.month} className="flex min-w-0 flex-col items-center justify-end">
          <div className="flex h-36 w-full items-end justify-center gap-1">
            <div title={`${month.label}: lluvia ${number(month.precipitationMm)} mm`} className="w-[38%] max-w-3 rounded-t bg-[#32c7b0]" style={{ height: `${month.precipitationMm === null ? 0 : Math.max(3, month.precipitationMm / maximum * 100)}%` }} />
            <div title={`${month.label}: evaporación ${number(month.evaporationMm)} mm`} className="w-[38%] max-w-3 rounded-t bg-[#8052ff]" style={{ height: `${month.evaporationMm === null ? 0 : Math.max(3, month.evaporationMm / maximum * 100)}%` }} />
          </div><span className="mt-2 text-[9px] text-slate-500 sm:text-[10px]">{month.label}</span>
        </div>)}
      </div>
      <table className="sr-only"><caption>Promedio mensual de lluvia y evaporación del periodo analizado, en milímetros.</caption><thead><tr><th>Mes</th><th>Lluvia mm</th><th>Evaporación mm</th></tr></thead><tbody>{summary.map((month) => <tr key={month.month}><th>{month.label}</th><td>{number(month.precipitationMm)}</td><td>{number(month.evaporationMm)}</td></tr>)}</tbody></table>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">Promedio de los años analizados; NASA POWER describe condiciones regionales, no mediciones exactas del lote.</p>
    </>}
  </section>;
}

function DetailList({ title, items }: { title: string; items: readonly string[] }) {
  return <details className="group border-t border-white/10 py-3">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-spark"><span>{title}<span className="ml-2 text-xs text-slate-500">{items.length}</span></span><span className="text-saffron-spark transition group-open:rotate-45" aria-hidden="true">+</span></summary>
    <ul className="mt-3 space-y-2 pl-4 text-xs leading-5 text-slate-300">{items.map((item) => <li key={item} className="list-disc marker:text-saffron-spark">{item}</li>)}</ul>
  </details>;
}

function RotationCard({ result, baseline, index }: { result: RotationResult; baseline: RotationResult | undefined; index: number }) {
  const difference = baseline ? result.score - baseline.score : 0;
  const calendar = result.calendar;
  return <article className="flex flex-col rounded-3xl border border-white/10 bg-[#0c0c0c] p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-saffron-spark">Opción {index + 1}</p><h3 className="mt-2 text-lg font-semibold leading-snug text-white">{result.rotation.name}</h3><p className="mt-2 text-xs leading-5 text-slate-400">{result.rotation.description}</p></div>
      <div className="shrink-0 rounded-2xl border border-electric-iris/30 bg-electric-iris/10 px-3 py-2 text-center"><p className="text-2xl font-bold tabular-nums text-white">{number(result.score, 1)}</p><p className="text-[10px] text-slate-400">de 5</p></div>
    </div>
    {baseline && <p className={`mt-3 text-xs font-medium ${difference > 0 ? "text-emerald-300" : difference < 0 ? "text-amber-200" : "text-slate-400"}`}>{difference > 0 ? "+" : ""}{number(difference, 1)} frente a la línea base</p>}
    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10" aria-label={`Puntaje ${number(result.score, 1)} de 5`} role="img"><div className="h-full rounded-full bg-gradient-to-r from-electric-iris to-saffron-spark" style={{ width: `${Math.max(0, Math.min(100, result.score / 5 * 100))}%` }} /></div>
    <div className="mt-5 rounded-2xl bg-white/[0.035] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Por qué aparece</p><p className="mt-2 text-sm leading-6 text-slate-100">{result.whySuggested}</p></div>
    <div className="mt-4"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Beneficios posibles</p><ul className="space-y-2 text-xs leading-5 text-slate-300">{result.benefits.map((item) => <li key={item} className="flex gap-2"><span className="text-emerald-300" aria-hidden="true">↗</span>{item}</li>)}</ul></div>
    <div className="mt-4">
      <DetailList title="Evidencia climática" items={result.evidence} />
      <DetailList title="Vacíos de información" items={result.informationGaps} />
      <DetailList title="Riesgos a considerar" items={result.risks} />
      <DetailList title="Validar con experto local" items={result.validateWithLocalExpert} />
      <details className="group border-t border-white/10 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-spark">Calendario de la rotación <span className="text-xs text-slate-500">{calendar ? `${calendar.months.length} meses` : "No disponible"}</span></summary>
        {calendar ? <><div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6">{calendar.months.map((month) => <div key={month.offset} className={`rounded-lg border p-2 text-center ${month.risk ? "border-amber-300/30 bg-amber-950/20" : "border-white/10 bg-white/[0.025]"}`}><p className="text-[10px] text-slate-500">Mes {month.offset + 1}</p><p className="mt-1 truncate text-[10px] font-medium text-slate-200">{month.cropId ?? "Descanso"}</p></div>)}</div><p className="mt-3 text-[11px] text-slate-400">{calendar.fallowMonths} meses de campo vacío · {calendar.vulnerableMonths} meses vulnerables. Calendario ilustrativo, no fechas de siembra.</p></> : <p className="mt-3 text-xs leading-5 text-slate-400">El backend no entregó calendario para esta ubicación.</p>}
      </details>
    </div>
  </article>;
}

export default function AnalysisDashboard({ farm, response, baseline, scenarioDraft, mockMode, applyingScenario, scenarioError, onScenarioChange, onApplyScenario, onShowBaseline, onEditPriorities, onChangeFarm }: AnalysisDashboardProps) {
  const source = mockMode ? "Datos de demostración · no son datos para decisiones" : sourceLabel[response.climate.source];
  const dates = [monthDate(response.climate.firstDate), monthDate(response.climate.lastDate)].filter(Boolean).join(" – ");
  const rainfallPercent = Math.round(((scenarioDraft.rainFactor ?? 1) - 1) * 100);
  const activeScenario = response.scenario !== undefined && ((response.scenario.tempDeltaC ?? 0) !== 0 || (response.scenario.rainFactor ?? 1) !== 1);
  const totalMissing = Object.values(response.climate.missingByParameter).reduce((sum, count) => sum + count, 0);

  return <section className="mx-auto max-w-[1440px] px-4 pb-12 pt-5 sm:px-8 lg:pt-9" aria-labelledby="analysis-title">
    <ol className="mx-auto mb-8 grid max-w-2xl grid-cols-3 text-center text-xs sm:text-sm" aria-label="Pasos del análisis">
      <li className="border-b-2 border-saffron-spark pb-3 text-slate-400"><span className="mr-2">01</span>Finca</li><li className="border-b-2 border-saffron-spark pb-3 text-slate-400"><span className="mr-2">02</span>Tus prioridades</li><li aria-current="step" className="border-b-2 border-electric-iris pb-3 font-semibold text-white"><span className="mr-2 text-electric-iris">03</span>Resultados</li>
    </ol>
    <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-saffron-spark">HEIMDALL · análisis climático</p><h2 id="analysis-title" className="mt-2 font-display text-3xl font-medium tracking-tight text-white sm:text-4xl">Tu finca, con contexto</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{farm.placeLabel ?? "Finca seleccionada"} · {dates || "Periodo histórico"} · {number(response.climate.daysAnalyzed, 0)} días analizados</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={onEditPriorities} className="min-h-10 rounded-full border border-white/20 px-4 text-sm text-slate-200 transition hover:border-saffron-spark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-spark">Editar objetivos</button><button type="button" onClick={onChangeFarm} className="min-h-10 rounded-full border border-white/20 px-4 text-sm text-slate-200 transition hover:border-saffron-spark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-spark">Cambiar finca</button></div>
    </header>

    <div className="mb-5 flex flex-col gap-2 rounded-2xl border border-cyan-300/15 bg-cyan-950/20 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-cyan-100">{source}</p><p className="mt-1 text-xs text-slate-400">Periodo histórico de referencia; no es un pronóstico.{totalMissing > 0 ? ` Se reportan ${totalMissing} valores diarios faltantes.` : " No se reportaron faltantes diarios."}</p></div><span className="w-fit rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-300">{response.climate.source === "sample" ? "Respaldo" : response.climate.source === "cache" ? "Caché" : "Fuente NASA"}</span></div>

    {activeScenario && <p className="mb-5 rounded-xl border border-amber-300/25 bg-amber-950/20 p-3 text-sm leading-5 text-amber-100" role="status">Estás viendo un escenario hipotético; no es una predicción. La humedad del suelo no se recalculó.</p>}
    {scenarioError && <p className="mb-5 rounded-xl border border-red-300/30 bg-red-950/30 p-3 text-sm text-red-100" role="alert">{scenarioError}</p>}

    <section className="mb-6 rounded-3xl border border-electric-iris/20 bg-gradient-to-br from-[#151020] to-[#0b0b0b] p-5 sm:p-6" aria-labelledby="scenario-title">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-md"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c4adff]">Explora sin confundirlo con el pronóstico</p><h3 id="scenario-title" className="mt-1 text-lg font-semibold text-white">¿Y si cambia el clima?</h3><p className="mt-1 text-xs leading-5 text-slate-400">Prueba cambios uniformes sobre la historia de NASA POWER.</p></div>
        <div className="grid flex-1 gap-5 sm:grid-cols-2 xl:max-w-2xl">
          <div><div className="mb-2 flex justify-between gap-2"><label htmlFor="scenario-temperature" className="text-xs font-medium text-slate-200">Cambio de temperatura</label><output htmlFor="scenario-temperature" className="text-xs font-semibold text-[#c4adff]">{number(scenarioDraft.tempDeltaC ?? 0, 1)} °C</output></div><input id="scenario-temperature" type="range" min="-2" max="5" step="0.5" value={scenarioDraft.tempDeltaC ?? 0} disabled={mockMode || applyingScenario} onChange={(event) => onScenarioChange({ ...scenarioDraft, tempDeltaC: Number(event.target.value) })} className="w-full accent-[#8052ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-spark disabled:opacity-40" /><div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>−2 °C</span><span>+5 °C</span></div></div>
          <div><div className="mb-2 flex justify-between gap-2"><label htmlFor="scenario-rain" className="text-xs font-medium text-slate-200">Cambio de lluvia</label><output htmlFor="scenario-rain" className="text-xs font-semibold text-[#c4adff]">{rainfallPercent > 0 ? "+" : ""}{rainfallPercent} %</output></div><input id="scenario-rain" type="range" min="-50" max="50" step="5" value={rainfallPercent} disabled={mockMode || applyingScenario} onChange={(event) => onScenarioChange({ ...scenarioDraft, rainFactor: 1 + Number(event.target.value) / 100 })} className="w-full accent-[#8052ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-spark disabled:opacity-40" /><div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>−50 %</span><span>+50 %</span></div></div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row xl:flex-col"><button type="button" onClick={onApplyScenario} disabled={mockMode || applyingScenario || ((scenarioDraft.tempDeltaC ?? 0) === 0 && (scenarioDraft.rainFactor ?? 1) === 1)} className="min-h-11 rounded-full bg-electric-iris px-5 text-sm font-semibold text-white transition hover:bg-[#956fff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-spark disabled:cursor-not-allowed disabled:opacity-40">{applyingScenario ? "Recalculando…" : "Aplicar escenario"}</button>{activeScenario && <button type="button" onClick={onShowBaseline} disabled={applyingScenario} className="min-h-10 rounded-full border border-white/20 px-4 text-xs text-slate-200 hover:border-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-spark disabled:opacity-40">Volver al análisis base</button>}</div>
      </div>
      {mockMode && <p className="mt-4 text-xs text-amber-100" role="status">Los escenarios requieren `NEXT_PUBLIC_USE_MOCKS=false`; el mock es solo una vista de demostración.</p>}
      {applyingScenario && <p className="mt-3 text-xs text-slate-300" role="status" aria-live="polite">Aplicando el escenario a la serie histórica…</p>}
    </section>

    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Indicator title="Balance hídrico" value={number(response.indicators.waterDeficitMm)} unit="mm" note={`${response.indicators.waterBalanceMethod === "potential" ? "Lluvia − evapotranspiración potencial estimada" : "Lluvia − evaporación"}; negativo indica déficit.`} />
      <Indicator title="Estrés por calor" value={number(response.indicators.heatStressDays, 0)} unit="días" note="Total del periodo analizado, no por año." />
      <Indicator title="Riesgo de helada" value={number(response.indicators.frostRiskDays, 0)} unit="días" note="Total del periodo analizado, no por año." />
      <Indicator title="Lluvia diaria extrema" value={number(response.indicators.extremeRainThresholdMm)} unit="mm" note="Umbral del percentil extremo de precipitación." />
      <Indicator title="Temperatura media estimada" value={number(response.indicators.meanTemperatureC)} unit="°C" note={response.indicators.siteElevationMeters === undefined ? "Promedio de la celda climática regional." : `Ajustada con altitud del sitio (${number(response.indicators.siteElevationMeters, 0)} m).`} />
      <Indicator title="Humedad de raíces" value={number(response.indicators.meanRootZoneWetness, 2)} unit="/ 1" note="Proxy regional de humedad, no medición del suelo de tu lote." />
      <Indicator title="Datos diarios faltantes" value={number(totalMissing, 0)} unit="valores" note="Suma de faltantes reportados por parámetro." />
      <Indicator title="Cobertura temporal" value={number(response.climate.daysAnalyzed, 0)} unit="días" note={`${monthDate(response.climate.firstDate) ?? "Inicio sin dato"} a ${monthDate(response.climate.lastDate) ?? "fin sin dato"}.`} />
    </div>

    <div className="mb-8"><ClimateChart response={response} /></div>

    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-saffron-spark">Comparación explicable</p><h3 className="mt-1 text-xl font-semibold text-white">Tres caminos para evaluar</h3></div><p className="max-w-xl text-xs leading-5 text-slate-400">El puntaje ordena opciones según tus prioridades. No es una garantía de rendimiento.</p></div>
    <div className="grid items-start gap-4 xl:grid-cols-3">{response.rotations.map((result, index) => <RotationCard key={result.rotation.id} result={result} baseline={baseline.rotations.find((item) => item.rotation.id === result.rotation.id)} index={index} />)}</div>

    {response.dataSources && <details className="mt-7 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"><summary className="cursor-pointer text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-spark">Fuentes de datos y para qué se usaron <span className="ml-1 text-xs text-slate-500">{response.dataSources.length}</span></summary><ul className="mt-4 grid gap-3 sm:grid-cols-2">{response.dataSources.map((source) => <li key={source.id} className="rounded-xl border border-white/10 bg-black/40 p-3"><p className="text-sm font-medium text-white">{source.name}</p><p className="mt-1 text-xs text-saffron-spark">{source.provider}</p><p className="mt-2 text-xs leading-5 text-slate-400">{source.use}</p>{source.url && <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-cyan-200 underline underline-offset-2">Ver fuente<span className="sr-only">: {source.name}</span></a>}</li>)}</ul></details>}
    <footer className="mt-8 border-t border-white/10 pt-5 text-center text-xs leading-5 text-slate-500">Heimdall ofrece apoyo a la decisión, no reemplaza el conocimiento del agricultor ni la validación de un agrónomo local.</footer>
  </section>;
}
