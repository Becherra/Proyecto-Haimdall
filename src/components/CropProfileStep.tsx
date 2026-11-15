"use client";

import { popElement } from "./motion";
import { buildCropHealthNotes, type CitedSource, type CropHealthNotes, type NoteFact } from "../lib/cropHealthNotes";
import { CROP_PROFILES } from "../lib/cropProfiles";
import { PROFILE_TITLES, profileOptions, toProfileSelection, type ProfileDraft, type ProfileStep } from "../lib/ui/cropProfileFlow";
import { OTHER_ANSWER } from "../types";

type CropProfileStepProps = { step: ProfileStep; cropId: string; draft: ProfileDraft; onChange: (draft: ProfileDraft) => void };

const FIELD: Record<ProfileStep, "cultivarId" | "plantingMaterialId" | "stageId" | "observedThreatId"> = {
  cultivar: "cultivarId", material: "plantingMaterialId", stage: "stageId", problem: "observedThreatId",
};

const optionBase = "flex min-h-14 items-center justify-center rounded-2xl border-2 px-3 py-2 text-center text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-cream/50";
const optionOff = "border-cream/25 text-bone-white hover:border-cream";
const optionOn = "border-cream bg-cream text-meadow";
const inputClass = "w-full rounded-2xl border-2 border-cream/40 bg-meadow/40 px-4 py-3 text-bone-white placeholder:text-cream/50 focus:border-cream focus:outline-none";

/** Una pregunta del perfil de cultivo (variedad, semilla, etapa o problema), siempre con «No sé». */
export default function CropProfileStep({ step, cropId, draft, onChange }: CropProfileStepProps) {
  const field = FIELD[step];
  const options = profileOptions(CROP_PROFILES, cropId, step);
  const selected = draft[field];
  const pick = (id: string) => onChange({ ...draft, [field]: step === "problem" && selected === id ? undefined : id });

  return <>
    <h2 className="mb-1 text-center text-2xl font-bold text-bone-white">{PROFILE_TITLES[step]}</h2>
    {step === "problem" && <p className="mb-3 text-center text-sm text-cream/80">Opcional. Lo que marques es tu observación, no un diagnóstico.</p>}
    <div role="radiogroup" aria-label={PROFILE_TITLES[step]} className="mt-2 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
      {options.map((option) => <button key={option.id} type="button" role="radio" aria-checked={selected === option.id} data-option
        onClick={(event) => { popElement(event.currentTarget); pick(option.id); }} className={`${optionBase} flex-col ${selected === option.id ? optionOn : optionOff}`}>
        <span>{option.label}</span>
        {option.hint && option.hint !== option.label && <span className="text-xs font-normal opacity-75">{option.hint}</span>}
      </button>)}
    </div>
    {step === "cultivar" && selected === OTHER_ANSWER && <label className="mt-4 block text-sm text-cream">
      ¿Cómo se llama? (opcional)
      <input className={`${inputClass} mt-1`} maxLength={60} value={draft.otherCultivarName ?? ""} onChange={(event) => onChange({ ...draft, otherCultivarName: event.target.value })} placeholder="Nombre de la variedad" />
    </label>}
    {step === "problem" && <ProblemDetails cropId={cropId} draft={draft} onChange={onChange} />}
  </>;
}

function ProblemDetails({ cropId, draft, onChange }: Omit<CropProfileStepProps, "step">) {
  const selection = toProfileSelection(CROP_PROFILES, cropId, draft);
  const notes = selection ? buildCropHealthNotes(CROP_PROFILES, selection) : undefined;
  return <>
    <label className="mt-4 block text-sm text-cream">
      Describe lo que ves con tus palabras (opcional)
      <textarea className={`${inputClass} mt-1 min-h-20`} maxLength={280} value={draft.symptomsNote ?? ""} onChange={(event) => onChange({ ...draft, symptomsNote: event.target.value })} placeholder="Qué notaste y en qué parte de la planta" />
    </label>
    {notes && <CropHealthNotesPanel notes={notes} />}
  </>;
}

function Sources({ sources }: { sources: CitedSource[] }) {
  return <ul className="mt-1 space-y-0.5 text-xs text-cream/70">
    {sources.map((source) => <li key={`${source.url}-${source.locator ?? ""}`}>
      <a href={source.url} target="_blank" rel="noreferrer" className="underline decoration-cream/40 hover:text-cream">{source.label}</a>{source.locator ? `, ${source.locator}` : ""}
    </li>)}
  </ul>;
}

function Fact({ title, fact }: { title: string; fact?: NoteFact }) {
  if (!fact) return null;
  return <div className="mt-3">
    <h4 className="font-semibold text-bone-white">{title}</h4>
    <p>{fact.text}</p>
    {fact.context && <p className="text-cream/80">{fact.context}</p>}
    <Sources sources={fact.sources} />
  </div>;
}

/** Lo que dicen las fuentes del cultivo descrito: observación sin confirmar, medidas documentadas y vacíos. */
export function CropHealthNotesPanel({ notes }: { notes: CropHealthNotes }) {
  const { observation } = notes;
  return <section aria-label="Lo que dicen las fuentes" className="mt-4 rounded-2xl border border-cream/30 bg-meadow/30 p-4 text-sm text-cream">
    <p className="font-semibold text-bone-white" role="note">{notes.disclaimer}</p>
    <p className="mt-2">{notes.cultivar.label} · {notes.stage.label}</p>
    {notes.userNote && <p className="mt-2 italic">Tu descripción (no la interpretamos): «{notes.userNote}»</p>}
    {observation && <>
      <h3 className="mt-3 text-base font-bold text-bone-white">{observation.heading}</h3>
      {observation.officialNotice && <p className="mt-2 rounded-xl bg-clay/40 px-3 py-2 font-semibold text-clay-light" role="alert">{observation.officialNotice}</p>}
      <Fact title="Tu variedad" fact={observation.cultivarResponse} />
      <Fact title="Síntomas descritos por la fuente (para comparar)" fact={observation.symptomsToCompare} />
      <Fact title="Qué la favorece" fact={observation.favoringConditions} />
      {observation.measures.length > 0 && <div className="mt-3">
        <h4 className="font-semibold text-bone-white">Medidas documentadas</h4>
        <ul className="mt-1 space-y-2">
          {observation.measures.map((measure) => <li key={measure.id}>
            <p>{measure.action}</p>
            <p className="text-cream/80">Cuándo: {measure.condition} Por qué: {measure.reason} Verifica: {measure.verification}</p>
            <Sources sources={measure.sources} />
          </li>)}
        </ul>
      </div>}
    </>}
    <h4 className="mt-3 font-semibold text-bone-white">Lo que no sabemos</h4>
    <ul className="mt-1 list-disc space-y-1 pl-5">{notes.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
  </section>;
}
