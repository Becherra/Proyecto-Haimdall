import { PLAN_STAGES, UNKNOWN_ANSWER, type ActionPlan, type CropProfileSelection, type Evidence, type PlanAction, type PlanStage } from "../../types";
import type { SpeechItem } from "./resultsCopy";

export type PlanIconName = "bulb" | "tool" | "eye" | "list" | "book" | "pin" | "person" | "search";
export type PlanStageState = "ready" | "blocked" | "empty";
export type PlanStageView = { stage: PlanStage; label: string; icon: PlanIconName; state: PlanStageState };
/** "tell-stage": el agricultor dijo «No sé» a la etapa; contarla puede activar pasos. */
export type PlanFix = "tell-stage";
export type ActionPlanView = {
  tone: "ready" | "partial" | "empty"; title: string; summary: string;
  stages: PlanStageView[]; ready: PlanAction[]; blocked: PlanAction[]; gaps: string[]; fix: PlanFix | null; disclaimer: string;
};
export type PlanChip = { label: string; tone: "ready" | "empty" };
export type EvidenceChip = { label: string; icon: PlanIconName; href?: string };

const STAGE_COPY: Record<PlanStage, { label: string; icon: PlanIconName }> = {
  understand: { label: "Entender", icon: "bulb" },
  prepare: { label: "Preparar", icon: "tool" },
  monitor: { label: "Vigilar", icon: "eye" },
  review: { label: "Revisar", icon: "list" },
};

const EMPTY_SUMMARY = "Aún no hay pasos con respaldo para tu caso; no es que no haya riesgo, nos falta saber más.";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const allActions = (plan: ActionPlan) => plan.stages.flatMap((group) => group.actions);

function stageState(actions: readonly PlanAction[]): PlanStageState {
  if (actions.some((action) => action.status === "ready")) return "ready";
  return actions.length > 0 ? "blocked" : "empty";
}

function summarize(ready: number, blocked: number): string {
  if (ready === 0) return EMPTY_SUMMARY;
  const parts = [count(ready, "paso listo", "pasos listos")];
  if (blocked > 0) parts.push(count(blocked, "espera un dato", "esperan un dato"));
  return parts.join(" · ");
}

/** Prepara el plan de una rotación para la vista: etapas con su estado, pasos listos y bloqueados, y qué puede completar el agricultor. */
export function describeActionPlan(plan: ActionPlan, profile: CropProfileSelection | undefined): ActionPlanView {
  const actions = allActions(plan);
  const ready = actions.filter((action) => action.status === "ready");
  const blocked = actions.filter((action) => action.status !== "ready");
  const stages = PLAN_STAGES.map((stage) => ({ stage, ...STAGE_COPY[stage], state: stageState(actions.filter((action) => action.stage === stage)) }));
  const fix = ready.length === 0 && profile?.stageId === UNKNOWN_ANSWER ? "tell-stage" : null;
  return {
    tone: ready.length === 0 ? "empty" : blocked.length > 0 || plan.status === "partial" ? "partial" : "ready",
    title: ready.length === 0 ? "Aún no hay pasos para ti" : "Qué hacer ahora",
    summary: summarize(ready.length, blocked.length),
    stages, ready, blocked, gaps: plan.gaps, fix, disclaimer: plan.disclaimer,
  };
}

/** Etiqueta corta del plan para la tarjeta del camino; null si la respuesta no trae plan (backend antiguo). */
export function planChip(plan: ActionPlan | undefined): PlanChip | null {
  if (!plan) return null;
  const ready = allActions(plan).filter((action) => action.status === "ready").length;
  return ready === 0 ? { label: "Sin pasos aún", tone: "empty" } : { label: count(ready, "paso para hacer", "pasos para hacer"), tone: "ready" };
}

const shortName = (source: string) => source.split(" — ")[0].trim();

/** Nombre corto de una fuente del paso, para un chip: publicación con su página, dato de la zona o lo que declaró el agricultor. */
export function evidenceChip(evidence: Evidence): EvidenceChip {
  const href = evidence.sourceUrl ? { href: evidence.sourceUrl } : {};
  switch (evidence.type) {
    case "published-practice": {
      const page = evidence.reference?.split(",")[0].trim();
      return { label: page ? `${shortName(evidence.source)} · ${page}` : shortName(evidence.source), icon: "book", ...href };
    }
    case "regional": return { label: `${shortName(evidence.source)} · tu zona`, icon: "pin" };
    case "declared": return { label: "Lo que nos contaste", icon: "person" };
    default: return { label: shortName(evidence.source), icon: "search", ...href };
  }
}

/** El plan para leer en voz alta: resumen, instrucciones de los pasos listos, lo que falta en los bloqueados y los vacíos. */
export function actionPlanSpeechItems(view: ActionPlanView): SpeechItem[] {
  return [
    { text: `${view.title}. ${view.summary}` },
    ...view.ready.map((action) => ({ text: `${action.what}. ${(action.instructions ?? []).join(" ")} ${action.verification}` })),
    ...view.blocked.map((action) => ({ text: `${action.what}. Falta: ${action.missingData.join(" ")}` })),
    ...(view.gaps.length ? [{ text: `Lo que no sabemos: ${view.gaps.join(" ")}` }] : []),
  ];
}
