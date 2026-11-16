import { PLAN_STAGES, UNKNOWN_ANSWER, type ActionPlan, type AnalysisResponse, type CropProfileSelection, type Evidence, type PlanAction, type PlanStage, type RotationResult } from "../../types";
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

const EMPTY_SUMMARY = "No es que no haya riesgo: nos falta saber más.";

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

/** Un escenario hipotético no activa pasos de campo: con escenario activo, el plan es el de la misma alternativa con el clima real. */
export function planForRotation(result: RotationResult, response: Pick<AnalysisResponse, "scenario">, baseline?: Pick<AnalysisResponse, "rotations">): ActionPlan | undefined {
  if (!response.scenario || !baseline) return result.actionPlan;
  return baseline.rotations.find((entry) => entry.rotation.id === result.rotation.id)?.actionPlan;
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

export type PlanEvidenceRow = { typeLabel: string; source: string; detail: string; reference?: string; scale?: string; date?: string; href?: string };
export type PlanEvidenceGroup = { key: string; what: string; evidence: PlanEvidenceRow[] };

const EVIDENCE_TYPE_LABEL: Record<Evidence["type"], string> = {
  "published-practice": "Práctica publicada",
  regional: "Dato de la zona, no de tu lote",
  declared: "Lo que nos contaste",
  observed: "Medición",
  estimated: "Estimación",
};

/** "20261030" → "30/10/2026"; otras fechas (p. ej. solo el año) quedan igual. */
const readableDate = (date: string) => /^\d{8}$/.test(date) ? `${date.slice(6, 8)}/${date.slice(4, 6)}/${date.slice(0, 4)}` : date;

function evidenceRow(evidence: Evidence): PlanEvidenceRow {
  const { source, detail, reference, scale, date, sourceUrl } = evidence;
  return { typeLabel: EVIDENCE_TYPE_LABEL[evidence.type], source, detail, ...(reference ? { reference } : {}), ...(scale ? { scale } : {}), ...(date ? { date: readableDate(date) } : {}), ...(sourceUrl ? { href: sourceUrl } : {}) };
}

/** Evidencia completa de los pasos listos para la vista técnica; una práctica que se repite en varias alternativas sale una vez. */
export function describePlanEvidence(rotations: readonly RotationResult[]): PlanEvidenceGroup[] {
  const groups = new Map<string, PlanEvidenceGroup>();
  for (const { actionPlan } of rotations) {
    for (const action of actionPlan ? allActions(actionPlan) : []) {
      const key = `${action.ruleId ?? action.id}:${action.stage}`;
      if (action.status !== "ready" || groups.has(key)) continue;
      groups.set(key, { key, what: action.what, evidence: action.evidence.map(evidenceRow) });
    }
  }
  return [...groups.values()];
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
