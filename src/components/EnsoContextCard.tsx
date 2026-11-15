const IDEAM_UPDATE_URL = "https://ideam.gov.co/sala-de-prensa/noticia/actualizacion-del-fenomeno-de-el-nino-existe-el-61-de-probabilidad-de-que-persista-hasta-mayo-2027";

/** Snapshot from IDEAM's 12 Nov 2026 bulletin; this is global context, not a farm forecast. */
export default function EnsoContextCard() {
  return <article data-reveal className="rounded-3xl border border-cream/30 bg-moss card-surface p-4 lg:col-span-3" aria-labelledby="enso-context-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cream/15 text-cream" aria-hidden="true">
          <span className="text-2xl font-bold">≈</span>
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cream">Contexto climático · ENSO</p>
          <h3 id="enso-context-title" className="mt-1 text-xl font-bold text-bone-white">El Niño está presente</h3>
        </div>
      </div>
      <span className="rounded-full border border-olive-light/40 px-3 py-1 text-sm text-silver-mist">Boletín: 12 nov 2026</span>
    </div>
    <p className="mt-4 text-base leading-6 text-silver-mist">El IDEAM reporta 61 % de probabilidad de que persista hasta mayo de 2027 y 79 % de que su intensidad baje de muy fuerte a fuerte entre enero y marzo.</p>
    <p className="mt-2 text-sm leading-5 text-ash-gray">Es contexto nacional del fenómeno, no un pronóstico ni una medición de riesgo para esta finca. Sus efectos cambian según la región, la época y el cultivo.</p>
    <a href={IDEAM_UPDATE_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-cream/50 px-4 text-sm font-semibold text-cream underline-offset-4 hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-cream/50">Consultar fuente oficial del IDEAM<span className="sr-only"> (abre en una pestaña nueva)</span></a>
  </article>;
}
