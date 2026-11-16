"use client";

import { useMemo, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { prefersReducedMotion } from "./motion";
import { CropIcon, UiIcon } from "./icons";
import { PlayButton } from "./PlayButton";
import { useSpeaker } from "./useSpeaker";
import { actionPlanSpeechItems, describeActionPlan, evidenceChip, type PlanStageState, type PlanStageView } from "../lib/ui/actionPlanView";
import type { ActionPlan, CropProfileSelection, PlanAction } from "../types";

type ActionPlanSectionProps = {
  plan: ActionPlan;
  profile?: CropProfileSelection;
  /** El escenario «¿y si…?» está activo y el plan mostrado es el del clima real. */
  fromBaseline?: boolean;
  onTellStage?: () => void;
};

const NODE: Record<PlanStageState, string> = {
  ready: "border-olive-light bg-olive text-bone-white",
  blocked: "border-clay-light bg-meadow text-clay-light",
  empty: "border-dashed border-ash-gray/50 bg-meadow text-ash-gray/70",
};
const NODE_LABEL: Record<PlanStageState, string> = { ready: "text-olive-light", blocked: "text-clay-light", empty: "text-ash-gray" };
const STATE_TEXT: Record<PlanStageState, string> = { ready: "tiene un paso listo", blocked: "espera un dato", empty: "sin pasos" };

/** Las 4 etapas del plan como una línea de puntos: verde si hay paso listo, candado si espera un dato, punteado si no hay nada. */
function StageTrack({ stages }: { stages: PlanStageView[] }) {
  return <ol className="relative grid grid-cols-4 gap-1 text-center" aria-label="Etapas del plan">
    <span className="absolute left-[12.5%] right-[12.5%] top-6 h-0.5 bg-olive/40" aria-hidden="true" />
    {stages.map((stage) => <li key={stage.stage} className="relative flex flex-col items-center gap-1.5" aria-label={`${stage.label}: ${STATE_TEXT[stage.state]}`}>
      <span className={`plan-node relative flex h-12 w-12 items-center justify-center rounded-full border-2 ${NODE[stage.state]}`}>
        <UiIcon name={stage.icon} className="h-7 w-7" />
        {stage.state === "blocked" && <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-clay text-bone-white"><UiIcon name="lock" className="h-3.5 w-3.5" /></span>}
      </span>
      <span className={`text-sm font-semibold ${NODE_LABEL[stage.state]}`}>{stage.label}</span>
    </li>)}
  </ol>;
}

function EvidenceChips({ action }: { action: PlanAction }) {
  const chip = "inline-flex min-h-11 items-center gap-2 rounded-full bg-meadow/60 px-4 text-sm font-semibold text-silver-mist";
  return <ul className="flex flex-wrap gap-2" aria-label="De dónde sale">
    {action.evidence.map((evidence) => {
      const { label, icon, href } = evidenceChip(evidence);
      const body = <><UiIcon name={icon} className="h-5 w-5 shrink-0 text-olive-light" />{label}</>;
      return <li key={evidence.id}>{href
        ? <a href={href} target="_blank" rel="noreferrer" className={`${chip} underline decoration-cream/30 transition hover:text-cream focus:outline-none focus-visible:ring-4 focus-visible:ring-cream/50`}>{body}</a>
        : <span className={chip} title={evidence.detail}>{body}</span>}</li>;
    })}
  </ul>;
}

function ReadyStep({ action, icon }: { action: PlanAction; icon: PlanStageView["icon"] }) {
  const cautions = [...(action.risks ?? []), ...(action.limitations ?? [])];
  return <article className="flex flex-col gap-3 rounded-2xl border-2 border-olive-light/70 bg-meadow/40 p-3.5 sm:p-4">
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-olive text-bone-white sm:h-12 sm:w-12"><UiIcon name={icon} className="h-6 w-6 sm:h-7 sm:w-7" /></span>
      <h4 className="text-lg font-bold leading-6 text-bone-white lg:text-xl">{action.what}</h4>
    </div>
    <p className="text-base leading-6 text-silver-mist">{action.why}</p>
    <ol className="flex flex-col gap-2.5">
      {(action.instructions ?? []).map((step, index) => <li key={step} className="flex items-start gap-3 text-lg leading-7 text-bone-white">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cream text-sm font-bold text-meadow">{index + 1}</span>{step}
      </li>)}
    </ol>
    <p className="flex items-start gap-2 rounded-xl bg-olive/25 px-3 py-2.5 text-base leading-6 text-bone-white"><UiIcon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-olive-light" /><span><span className="font-bold">Cómo saber que lo hiciste: </span>{action.verification}</span></p>
    <EvidenceChips action={action} />
    {cautions.length > 0 && <details className="group text-base text-silver-mist">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-cream/30 px-4 font-semibold text-cream transition hover:border-cream focus:outline-none focus-visible:ring-4 focus-visible:ring-cream/50 [&::-webkit-details-marker]:hidden"><UiIcon name="warning" className="h-5 w-5" />Ten en cuenta<UiIcon name="down" className="h-4 w-4 transition group-open:rotate-180" /></summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-6">{cautions.map((text) => <li key={text}>{text}</li>)}</ul>
    </details>}
  </article>;
}

function BlockedStep({ action }: { action: PlanAction }) {
  return <article className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-clay-light/60 p-3.5 sm:p-4">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay/40 text-clay-light"><UiIcon name="lock" className="h-6 w-6" /></span>
    <div className="min-w-0">
      <h4 className="text-lg font-bold leading-6 text-bone-white">{action.what}</h4>
      <p className="mt-1 text-base leading-6 text-clay-light">Falta: {action.missingData.join(" ")}</p>
    </div>
  </article>;
}

function EmptyPlan({ gaps, onTellStage }: { gaps: string[]; onTellStage?: () => void }) {
  return <div className="flex flex-col items-center gap-3 rounded-2xl bg-meadow/40 p-4 text-center">
    <CropIcon id="generic" className="h-12 w-12 text-ash-gray" />
    <ul className="flex w-full flex-col gap-2 text-left" aria-label="Lo que nos falta saber">
      {gaps.map((gap) => <li key={gap} className="flex items-start gap-2 text-base leading-6 text-bone-white"><UiIcon name="question" className="h-6 w-6 shrink-0 text-cream" />{gap}</li>)}
    </ul>
    {onTellStage && <button type="button" onClick={onTellStage} className="mt-1 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-cream px-5 font-bold text-meadow transition hover:bg-bone-white focus:outline-none focus:ring-4 focus:ring-cream/50">
      <UiIcon name="back" className="h-6 w-6" />Contar la etapa de mi cultivo
    </button>}
  </div>;
}

/** «Qué hacer ahora»: el plan inicial de una alternativa, con sus etapas, pasos listos, pasos bloqueados y vacíos. */
export default function ActionPlanSection({ plan, profile, fromBaseline = false, onTellStage }: ActionPlanSectionProps) {
  const view = useMemo(() => describeActionPlan(plan, profile), [plan, profile]);
  const { playingKey, play } = useSpeaker();
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.from(".plan-node", { scale: 0, duration: 0.45, ease: "back.out(2.2)", stagger: 0.1, delay: 0.2, clearProps: "transform" });
  }, { scope: root, dependencies: [view] });
  const hasSteps = view.tone !== "empty";

  return <section ref={root} data-reveal aria-label={view.title} className={`flex flex-col gap-4 rounded-3xl border-2 bg-moss card-surface p-4 ${hasSteps ? "border-olive-light" : "border-olive/40"}`}>
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <UiIcon name="list" className={`h-10 w-10 shrink-0 ${hasSteps ? "text-olive-light" : "text-ash-gray"}`} />
        <h3 className="min-w-0 flex-1 text-xl font-bold leading-6 text-bone-white">{view.title}</h3>
        <PlayButton playing={playingKey === "action-plan"} onClick={() => play("action-plan", actionPlanSpeechItems(view))} />
      </div>
      <p className={`text-base font-semibold leading-6 ${hasSteps ? "text-olive-light" : "text-silver-mist"}`}>{view.summary}</p>
    </div>
    <StageTrack stages={view.stages} />
    {fromBaseline && <p className="flex items-center gap-2 rounded-xl bg-spruce/60 px-3 py-2 text-sm text-bone-white" role="note"><UiIcon name="sun" className="h-5 w-5 shrink-0 text-cream" />Este plan es con el clima de hoy, no con el «¿y si…?».</p>}
    {view.ready.map((action) => <ReadyStep key={action.id} action={action} icon={view.stages.find((stage) => stage.stage === action.stage)?.icon ?? "list"} />)}
    {view.blocked.map((action) => <BlockedStep key={action.id} action={action} />)}
    {hasSteps
      ? view.gaps.length > 0 && <ul className="flex flex-col gap-2" aria-label="Lo que no sabemos">{view.gaps.map((gap) => <li key={gap} className="flex items-start gap-2 text-base leading-6 text-silver-mist"><UiIcon name="question" className="mt-0.5 h-5 w-5 shrink-0 text-cream" />{gap}</li>)}</ul>
      : <EmptyPlan gaps={view.gaps} onTellStage={view.fix === "tell-stage" ? onTellStage : undefined} />}
    <p className="text-sm leading-5 text-ash-gray">{view.disclaimer}</p>
  </section>;
}
