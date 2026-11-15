"use client";

import { useState, type FormEvent } from "react";
import { formatCoordinates } from "../lib/ui/coordinates";
import { farmSchema, userPrioritiesSchema } from "../types";
import type { Farm, UserPriorities } from "../types";

type PrioritiesFormProps = {
  farm: Farm;
  initialValues: UserPriorities;
  error: string | null;
  submitting: boolean;
  onSubmit: (priorities: UserPriorities) => void;
  onChangeFarm: () => void;
};

const crops = [
  ["maiz", "Maíz"], ["frijol", "Fríjol"], ["soya", "Soya"], ["arveja", "Arveja"],
  ["mucuna", "Mucuna"], ["crotalaria", "Crotalaria"], ["yuca", "Yuca"], ["papa", "Papa"],
  ["avena", "Avena forrajera"], ["repollo", "Repollo"],
] as const;

const priorityFields = [
  ["waterSaving", "Ahorrar agua", "Planear mejor el uso del agua."],
  ["extraIncome", "Mejorar ingresos", "Considerar alternativas de ingreso."],
  ["soilImprovement", "Cuidar el suelo", "Dar valor a la materia orgánica."],
  ["erosionReduction", "Reducir erosión", "Priorizar cobertura y protección."],
  ["lowRisk", "Evitar riesgos", "Favorecer opciones más conservadoras."],
] as const satisfies readonly (readonly [keyof Pick<UserPriorities, "waterSaving" | "extraIncome" | "soilImprovement" | "erosionReduction" | "lowRisk">, string, string])[];

const inputClass = "min-h-12 w-full rounded-xl border border-white/15 bg-[#111] px-4 text-sm text-white outline-none transition focus:border-saffron-spark focus:ring-2 focus:ring-saffron-spark/30";

export default function PrioritiesForm({ farm, initialValues, error, submitting, onSubmit, onChangeFarm }: PrioritiesFormProps) {
  const [values, setValues] = useState(initialValues);
  const [elevation, setElevation] = useState(initialValues.elevationMeters?.toString() ?? "");
  const [slope, setSlope] = useState(initialValues.slopePercent?.toString() ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const label = farm.placeLabel ?? "Ubicación seleccionada";
  const safeFarm = farmSchema.parse(farm);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = {
      ...values,
      ...(elevation ? { elevationMeters: Number(elevation) } : { elevationMeters: undefined }),
      ...(slope ? { slopePercent: Number(slope) } : { slopePercent: undefined }),
    };
    const parsed = userPrioritiesSchema.safeParse(candidate);
    if (!parsed.success) { setValidationError("Revisa los valores opcionales de altitud y pendiente."); return; }
    setValidationError(null);
    onSubmit(parsed.data);
  }

  return <section className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-8 lg:pt-10" aria-labelledby="priorities-title">
    <ol className="mx-auto mb-8 grid max-w-2xl grid-cols-3 text-center text-xs sm:text-sm" aria-label="Pasos del análisis">
      <li className="border-b-2 border-saffron-spark pb-3 font-semibold text-white"><span className="mr-2 text-saffron-spark">01</span>Finca</li>
      <li aria-current="step" className="border-b-2 border-electric-iris pb-3 font-semibold text-white"><span className="mr-2 text-electric-iris">02</span>Tus prioridades</li>
      <li className="border-b-2 border-white/15 pb-3 text-slate-500"><span className="mr-2">03</span>Resultados</li>
    </ol>

    <header className="mb-7 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-saffron-spark">Una recomendación hecha para tu finca</p>
      <h2 id="priorities-title" className="mt-3 font-display text-3xl font-medium tracking-tight text-white sm:text-4xl">¿Qué quieres priorizar?</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">Cuéntanos qué cultivas y qué te importa. Puedes ajustar estas prioridades antes de cada análisis.</p>
    </header>

    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Finca seleccionada</p>
        <p className="mt-1 truncate font-medium text-white">{label}</p>
        <p className="mt-1 text-xs text-slate-400">{formatCoordinates(safeFarm.centroid)}</p>
      </div>
      <button type="button" onClick={onChangeFarm} className="min-h-10 shrink-0 rounded-full border border-white/20 px-4 text-sm text-slate-200 transition hover:border-saffron-spark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-spark">Cambiar finca</button>
    </div>

    <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[0.86fr_1.14fr]">
      <div className="space-y-5">
        <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-5 sm:p-6">
          <label htmlFor="current-crop" className="block text-sm font-semibold text-white">¿Qué cultivo tienes actualmente?</label>
          <p className="mt-1 text-xs leading-5 text-slate-400">Nos sirve como punto de comparación, no como recomendación.</p>
          <select id="current-crop" value={values.currentCropId ?? "maiz"} onChange={(event) => setValues((current) => ({ ...current, currentCropId: event.target.value }))} className={`${inputClass} mt-4`}>
            {crops.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-5 sm:p-6">
          <label htmlFor="water-availability" className="block text-sm font-semibold text-white">¿Cómo está la disponibilidad de agua?</label>
          <p className="mt-1 text-xs leading-5 text-slate-400">Tu respuesta ayuda a interpretar los indicadores climáticos.</p>
          <select id="water-availability" value={values.waterAvailability ?? "medium"} onChange={(event) => setValues((current) => ({ ...current, waterAvailability: event.target.value as UserPriorities["waterAvailability"] }))} className={`${inputClass} mt-4`}>
            <option value="low">Limitada</option><option value="medium">Intermedia</option><option value="high">Abundante</option>
          </select>
        </div>

        <details className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200 marker:text-saffron-spark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-spark">Datos opcionales que conoces</summary>
          <p className="mt-3 text-xs leading-5 text-slate-400">Si los ingresas, el análisis usa tus datos declarados para complementar la referencia regional.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="farm-elevation" className="mb-1 block text-xs text-slate-300">Altitud (m s. n. m.)</label><input id="farm-elevation" type="number" min="-500" max="6000" step="any" value={elevation} onChange={(event) => setElevation(event.target.value)} placeholder="Ej. 1450" className={inputClass} /></div>
            <div><label htmlFor="farm-slope" className="mb-1 block text-xs text-slate-300">Pendiente media (%)</label><input id="farm-slope" type="number" min="0" max="100" step="any" value={slope} onChange={(event) => setSlope(event.target.value)} placeholder="Ej. 12" className={inputClass} /></div>
          </div>
        </details>
      </div>

      <fieldset className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-5 sm:p-6">
        <legend className="px-2 text-sm font-semibold text-white">Elige qué pesa más para ti</legend>
        <p className="mb-6 text-xs leading-5 text-slate-400">Mueve cada control de 0 (no es prioridad) a 5 (máxima prioridad).</p>
        <div className="space-y-6">
          {priorityFields.map(([key, title, description]) => <div key={key}>
            <div className="mb-2 flex items-start justify-between gap-3"><div><label htmlFor={`priority-${key}`} className="text-sm font-medium text-white">{title}</label><p className="mt-0.5 text-xs text-slate-400">{description}</p></div><output htmlFor={`priority-${key}`} className="min-w-10 rounded-lg bg-electric-iris/15 px-2 py-1 text-center text-sm font-bold tabular-nums text-[#c4adff]">{values[key]}</output></div>
            <input id={`priority-${key}`} type="range" min="0" max="5" step="1" value={values[key]} aria-valuetext={`${values[key]} de 5`} onChange={(event) => setValues((current) => ({ ...current, [key]: Number(event.target.value) }))} className="h-2 w-full cursor-pointer accent-[#ffb829] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-spark" />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>No es prioridad</span><span>Máxima prioridad</span></div>
          </div>)}
        </div>
      </fieldset>

      {(validationError || error) && <p className="lg:col-span-2 rounded-xl border border-red-300/30 bg-red-950/30 p-3 text-sm text-red-100" role="alert">{validationError ?? error}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
        <p className="text-xs leading-5 text-slate-500">El análisis es apoyo para decidir; no reemplaza la orientación de un agrónomo local.</p>
        <button type="submit" disabled={submitting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-electric-iris px-6 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(128,82,255,0.22)] transition hover:bg-[#956fff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-spark disabled:cursor-wait disabled:opacity-60">
          {submitting ? "Analizando tu finca…" : "Ver análisis de mi finca"}<span aria-hidden="true">→</span>
        </button>
      </div>
      {submitting && <p className="lg:col-span-2 text-center text-sm text-saffron-spark" role="status" aria-live="polite">Consultando clima y comparando rotaciones. Puede tardar unos segundos.</p>}
    </form>
  </section>;
}
