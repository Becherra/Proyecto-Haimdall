"use client";

import { useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { popElement, prefersReducedMotion } from "./motion";
import { stackPose } from "../lib/ui/stackPose";
import { CropIcon, GoalIcon } from "./icons";
import Logo from "./Logo";
import { applySelection, cropAnswerFields, cropAnswerFromPriorities, NO_CROP, selectionFromPriorities } from "../lib/ui/prioritySelection";
import type { PriorityKey } from "../lib/ui/prioritySelection";
import { userPrioritiesSchema } from "../types";
import type { Farm, UserPriorities } from "../types";

type PrioritiesSlidesProps = {
  farm: Farm;
  initialValues: UserPriorities;
  error: string | null;
  submitting: boolean;
  onSubmit: (priorities: UserPriorities) => void;
  onChangeFarm: () => void;
};

type Water = NonNullable<UserPriorities["waterAvailability"]>;

const CROPS = [
  ["cafe", "Café"], ["platano", "Plátano"], ["maiz", "Maíz"], ["frijol", "Fríjol"], ["soya", "Soya"], ["arveja", "Arveja"],
  ["mucuna", "Mucuna"], ["crotalaria", "Crotalaria"], ["yuca", "Yuca"], ["papa", "Papa"],
  ["avena", "Avena"], ["repollo", "Repollo"], [NO_CROP, "Ninguno"],
] as const;

const WATER: readonly (readonly [Water, number, string])[] = [["low", 1, "Poca"], ["medium", 2, "Normal"], ["high", 3, "Mucha"]];

const GOALS: readonly (readonly [PriorityKey, string])[] = [
  ["waterSaving", "Ahorrar agua"], ["extraIncome", "Ganar más"], ["soilImprovement", "Cuidar el suelo"],
  ["erosionReduction", "Frenar la erosión"], ["lowRisk", "Menos riesgo"],
];

const TITLES = ["¿Qué cultivo tienes?", "¿Cuánta agua tienes?", "¿Qué te importa más?"] as const;

const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const ArrowLeft = () => <svg {...iconProps} className="h-8 w-8"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
const ArrowRight = () => <svg {...iconProps} className="h-10 w-10" strokeWidth={3}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const Check = () => <svg {...iconProps} className="h-11 w-11" strokeWidth={3.2}><path d="M4 12.5l5 5L20 6.5" /></svg>;
const Spinner = () => <svg {...iconProps} className="h-10 w-10 animate-spin"><path d="M12 3a9 9 0 1 0 9 9" /></svg>;
const Drop = ({ filled }: { filled: boolean }) => <svg viewBox="0 0 24 24" className={`h-10 w-10 ${filled ? "" : "opacity-25"}`} fill="currentColor" aria-hidden="true"><path d="M12 2.5c3.6 4.4 6.5 8 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10.5 8.4 6.9 12 2.5z" /></svg>;

/** Tarjeta de la pila: la activa al frente, las siguientes asomando detrás y las contestadas fuera de pantalla. */
function StackCard({ offset, children }: { offset: number; children: ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  // GSAP mueve la tarjeta con un resorte suave; la primera vez y con "menos movimiento" se coloca sin animar.
  useGSAP(() => {
    const pose = stackPose(offset);
    const animate = mounted.current && !prefersReducedMotion();
    mounted.current = true;
    if (animate) gsap.to(card.current, { ...pose, duration: 0.75, ease: "power3.out" });
    else gsap.set(card.current, pose);
    if (offset === 0 && !prefersReducedMotion()) {
      gsap.from(card.current?.querySelectorAll("[data-option]") ?? [], { opacity: 0, y: 18, scale: 0.94, duration: 0.5, ease: "back.out(1.7)", stagger: 0.045, delay: animate ? 0.25 : 0.1, clearProps: "opacity,transform" });
    }
  }, { scope: card, dependencies: [offset] });
  return <div ref={card} style={{ transformOrigin: "bottom center", zIndex: 10 - Math.abs(offset), ...(offset > 0 ? { backgroundColor: `color-mix(in srgb, var(--color-moss) ${offset === 1 ? 70 : 40}%, var(--color-meadow))` } : {}) }} inert={offset !== 0} aria-hidden={offset !== 0}
    className="absolute inset-0 flex flex-col overflow-y-auto rounded-3xl border border-olive/50 bg-moss card-surface p-5 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
    {children}
  </div>;
}

const optionBase = "flex items-center rounded-2xl border-2 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-cream/50";
const optionOff = "border-cream/25 text-bone-white hover:border-cream";
const optionOn = "border-cream bg-cream text-meadow";

export default function PrioritiesSlides({ farm, initialValues, error, submitting, onSubmit, onChangeFarm }: PrioritiesSlidesProps) {
  const [step, setStep] = useState(0);
  const [crop, setCrop] = useState<string | null>(cropAnswerFromPriorities(initialValues));
  const [water, setWater] = useState<Water | null>(initialValues.waterAvailability ?? null);
  const [goals, setGoals] = useState<PriorityKey[]>(() => selectionFromPriorities(initialValues));
  const last = TITLES.length - 1;
  const placeLabel = farm.placeLabel ?? "Tu finca";

  const goNext = () => setStep((current) => Math.min(last, current + 1));
  const toggleGoal = (key: PriorityKey) => setGoals((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);

  function submit() {
    // «Ninguno» marca que no hay cultivo actual en lugar de mandar uno.
    const answers = { ...initialValues, ...cropAnswerFields(crop), waterAvailability: water ?? undefined };
    const parsed = userPrioritiesSchema.safeParse(applySelection(answers, goals));
    if (parsed.success) onSubmit(parsed.data);
  }
  const unanswered = (step === 0 && crop === null) || (step === 1 && water === null);
  const onNext = step === last ? submit : goNext;
  const onBack = step === 0 ? onChangeFarm : () => setStep(step - 1);

  return <section className="fixed inset-0 z-40 flex flex-col bg-scene" aria-label={`Preguntas sobre ${placeLabel}`}>
    <header className="flex items-center justify-between px-4 pt-4">
      <Logo variant="horizontal" size={34} />
      <ol className="flex items-center gap-2" aria-label={`Pregunta ${step + 1} de ${TITLES.length}`}>
        {TITLES.map((title, index) => <li key={title} aria-current={index === step ? "step" : undefined} className={`h-2.5 rounded-full transition-all ${index === step ? "w-8 bg-cream" : index < step ? "w-2.5 bg-olive-light" : "w-2.5 bg-cream/25"}`} />)}
      </ol>
    </header>

    <div className="relative mx-auto mb-12 mt-5 w-full max-w-md flex-1 px-4 lg:max-w-3xl">
      <div className="relative h-full">
        <StackCard offset={0 - step}>
          <h2 className="mb-4 text-center text-2xl font-bold text-bone-white">{TITLES[0]}</h2>
          <div role="radiogroup" aria-label={TITLES[0]} className="grid flex-1 auto-rows-fr grid-cols-3 gap-2.5 lg:grid-cols-4 lg:gap-4">
            {CROPS.map(([id, name]) => <button key={id} type="button" role="radio" aria-checked={crop === id} data-option onClick={(event) => { popElement(event.currentTarget); setCrop(id); }} className={`${optionBase} min-h-[5.5rem] justify-center gap-1 ${id === NO_CROP ? "col-span-full flex-row gap-3" : "flex-col"} ${crop === id ? optionOn : optionOff}`}>
              <CropIcon id={id} /><span className="text-sm font-semibold">{name}</span>
            </button>)}
          </div>
        </StackCard>

        <StackCard offset={1 - step}>
          <h2 className="mb-4 text-center text-2xl font-bold text-bone-white">{TITLES[1]}</h2>
          <div role="radiogroup" aria-label={TITLES[1]} className="flex flex-1 flex-col gap-3 lg:gap-4">
            {WATER.map(([id, drops, name]) => <button key={id} type="button" role="radio" aria-checked={water === id} data-option onClick={(event) => { popElement(event.currentTarget); setWater(id); }} className={`${optionBase} min-h-24 flex-1 justify-between px-6 ${water === id ? optionOn : optionOff}`}>
              <span className={`flex gap-1 ${water === id ? "text-meadow" : "text-cream"}`} aria-hidden="true">{[1, 2, 3].map((slot) => <Drop key={slot} filled={slot <= drops} />)}</span>
              <span className="text-xl font-bold">{name}</span>
            </button>)}
          </div>
        </StackCard>

        <StackCard offset={2 - step}>
          <h2 className="mb-4 text-center text-2xl font-bold text-bone-white">{TITLES[2]}</h2>
          <div role="group" aria-label={TITLES[2]} className="grid flex-1 auto-rows-fr grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-4">
            {GOALS.map(([key, name], index) => {
              const on = goals.includes(key);
              return <button key={key} type="button" aria-pressed={on} data-option onClick={(event) => { popElement(event.currentTarget); toggleGoal(key); }} className={`${optionBase} relative min-h-28 flex-col justify-center gap-1.5 ${index === GOALS.length - 1 ? "col-span-2" : ""} ${on ? optionOn : optionOff}`}>
                <GoalIcon id={key} /><span className="text-sm font-semibold">{name}</span>
                {on && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-meadow text-cream" aria-hidden="true"><svg {...iconProps} className="h-4 w-4" strokeWidth={3.5}><path d="M4 12.5l5 5L20 6.5" /></svg></span>}
              </button>;
            })}
          </div>
        </StackCard>
      </div>
    </div>

    {error && <p className="mx-4 mb-2 rounded-2xl bg-clay/40 px-4 py-3 text-center text-sm text-clay-light" role="alert">{error}</p>}
    <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-3xl">
      <button type="button" onClick={onBack} disabled={submitting} aria-label={step === 0 ? "Volver al mapa" : "Pregunta anterior"} className="flex h-20 w-20 shrink-0 lg:h-16 lg:w-16 items-center justify-center rounded-full border-2 border-cream/50 text-bone-white transition hover:border-cream focus:outline-none focus:ring-2 focus:ring-cream disabled:opacity-40"><ArrowLeft /></button>
      <button type="button" onClick={onNext} disabled={submitting || unanswered} aria-label={step === last ? "Ver resultados" : "Siguiente"} className={`flex h-20 min-w-0 flex-1 lg:h-16 items-center justify-center rounded-full bg-cream text-meadow shadow-lg transition hover:bg-bone-white focus:outline-none focus:ring-4 focus:ring-cream/50 ${submitting ? "cursor-wait opacity-70" : "disabled:cursor-not-allowed disabled:opacity-40"}`}>
        {submitting ? <Spinner /> : step === last ? <Check /> : <ArrowRight />}
      </button>
    </div>
    {submitting && <p className="sr-only" role="status" aria-live="polite">Analizando tu finca</p>}
  </section>;
}
