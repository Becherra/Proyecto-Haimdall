import type { CurrentSeason } from "../types";
import { describeLocalClimateSignal } from "../lib/ui/localClimateSignal";

const IDEAM_UPDATE_URL = "https://ideam.gov.co/sala-de-prensa/noticia/actualizacion-del-fenomeno-de-el-nino-existe-el-61-de-probabilidad-de-que-persista-hasta-mayo-2027";

/** Snapshot from IDEAM's 12 Nov 2026 bulletin; this is global context, not a farm forecast. */
export default function EnsoContextCard({ season }: { season?: CurrentSeason }) {
  const localSignal = season ? describeLocalClimateSignal(season) : null;
  const rainfallText = localSignal?.rainPercent === null || localSignal?.rainPercent === undefined
    ? "comparación de lluvia no disponible"
    : Math.round(localSignal.rainPercent) + " % de la lluvia normal";
  const temperatureText = localSignal?.temperatureAnomalyC === null || localSignal?.temperatureAnomalyC === undefined
    ? "anomalía de temperatura no disponible."
    : "temperatura " + (localSignal.temperatureAnomalyC > 0 ? "+" : "") + localSignal.temperatureAnomalyC.toFixed(1) + " °C frente a lo normal.";
  return <article data-reveal className="rounded-3xl border border-cream/30 bg-moss card-surface p-4 lg:col-span-3" aria-labelledby="enso-context-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cream/15 text-cream" aria-hidden="true">
          <span className="text-2xl font-bold">≈</span>
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cream">Contexto climático · ENSO</p>
          <h3 id="enso-context-title" className="mt-1 text-xl font-bold text-bone-white">El Niño está activo</h3>
        </div>
      </div>
      <span className="rounded-full border border-olive-light/40 px-3 py-1 text-sm text-silver-mist">Boletín: 12 nov 2026</span>
    </div>
    <p className="mt-4 text-base leading-6 text-silver-mist">El IDEAM prevé que el fenómeno podría continuar hasta mayo de 2027 y debilitarse durante los primeros meses del año.</p>
    <p className="mt-2 text-sm leading-5 text-ash-gray">Es contexto nacional del fenómeno, no un pronóstico ni una medición de riesgo para esta finca. Sus efectos cambian según la región, la época y el cultivo.</p>
    <div className="mt-4 rounded-2xl border border-olive/40 bg-meadow/40 p-3" aria-live="polite">
      <p className="text-xs font-bold uppercase tracking-wider text-olive-light">Señal reciente en esta ubicación · NASA POWER</p>
      {localSignal ? <>
        <p className="mt-1 font-bold text-bone-white">{localSignal.label}</p>
        <p className="mt-1 text-sm leading-5 text-silver-mist">Ventana observada hasta {localSignal.observedThrough}; {rainfallText}; {temperatureText}</p>
        <p className="mt-3 text-sm leading-5 text-bone-white"><strong>¿Qué puede significar?</strong> {localSignal.meaning}</p>
        <p className="mt-1 text-sm leading-5 text-silver-mist"><strong>¿Qué vigilar?</strong> {localSignal.watch}</p>
      </> : <p className="mt-1 text-sm leading-5 text-silver-mist">No hay observación reciente suficiente para esta ubicación; el contexto ENSO no permite inferir por sí solo el riesgo de la finca.</p>}
      <p className="mt-1 text-xs text-ash-gray">Es una observación climática regional reciente, no un pronóstico ni una medición del lote.</p>
    </div>
    <p className="mt-4 rounded-xl border border-cream/20 p-3 text-sm leading-5 text-silver-mist">El fenómeno no afecta igual a todas las zonas. Para saber qué se espera cerca de tu finca, debemos revisar el pronóstico regional del IDEAM; la señal de lluvia de arriba muestra lo que ya pasó, no lo que va a pasar.</p>
    <a href={IDEAM_UPDATE_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-cream/50 px-4 text-sm font-semibold text-cream underline-offset-4 hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-cream/50">Consultar fuente oficial del IDEAM<span className="sr-only"> (abre en una pestaña nueva)</span></a>
  </article>;
}
