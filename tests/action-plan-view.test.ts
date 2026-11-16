import { describe, expect, it } from "vitest";
import { actionPlanSpeechItems, describeActionPlan, describePlanEvidence, evidenceChip, planChip, planForRotation } from "../src/lib/ui/actionPlanView";
import { actionPlanSchema, type ActionPlan, type CropProfileSelection, type Evidence, type PlanAction, type RotationResult } from "../src/types";

const source: Evidence = { id: "s", type: "published-practice", source: "Cenicafé — Boletín Agrometeorológico Cafetero", sourceUrl: "https://example.org/b.pdf", reference: "Página 5, En la cosecha y poscosecha", detail: "Observar la maduración." };
const climate: Evidence = { id: "c", type: "regional", source: "NASA POWER", date: "20261030", detail: "Menos lluvia de lo habitual." };
const declared: Evidence = { id: "d", type: "declared", source: "Agricultor", detail: "Café en producción." };
const base = { why: "Porque sí.", appliesWhen: "Siempre.", prerequisites: [], verification: "Describe lo que viste.", evidence: [source, climate, declared] };
const observe: PlanAction = { ...base, id: "a:observe", stage: "monitor", status: "ready", what: "Revisa la maduración", missingData: [], instructions: ["Mira los frutos.", "Separa maduros de verdes."] };
const harvest: PlanAction = { ...base, id: "a:harvest", stage: "review", status: "missing-data", what: "Decidir la recolección", missingData: ["Confirmación de madurez en campo."], instructions: [] };
const stages = (actions: PlanAction[]) => (["understand", "prepare", "monitor", "review"] as const).map((stage) => ({ stage, actions: actions.filter((a) => a.stage === stage) }));
const partial: ActionPlan = actionPlanSchema.parse({ status: "partial", stages: stages([observe, harvest]), gaps: ["Falta confirmar la madurez en campo."], disclaimer: "Apoyo a la decisión." });
const empty: ActionPlan = actionPlanSchema.parse({ status: "insufficient", stages: stages([]), gaps: ["Falta conocer la etapa del cultivo."], disclaimer: "Apoyo a la decisión." });
const coffee = (stageId: string): CropProfileSelection => ({ cropId: "cafe", cultivarId: "unknown", stageId });

describe("describeActionPlan", () => {
  it("separa pasos listos y bloqueados y marca el estado de cada etapa", () => {
    const view = describeActionPlan(partial, coffee("produccion"));
    expect(view.tone).toBe("partial");
    expect(view.ready.map((a) => a.id)).toEqual(["a:observe"]);
    expect(view.blocked.map((a) => a.id)).toEqual(["a:harvest"]);
    expect(view.stages.map((s) => [s.stage, s.state])).toEqual([["understand", "empty"], ["prepare", "empty"], ["monitor", "ready"], ["review", "blocked"]]);
    expect(view.summary).toBe("1 paso listo · 1 espera un dato");
    expect(view.fix).toBeNull();
  });

  it("sin pasos no da instrucciones, explica los vacíos y no lo presenta como ausencia de riesgo", () => {
    const view = describeActionPlan(empty, coffee("produccion"));
    expect(view.tone).toBe("empty");
    expect(view.ready).toEqual([]);
    expect(view.gaps).toEqual(["Falta conocer la etapa del cultivo."]);
    expect(view.summary).toBe("No es que no haya riesgo: nos falta saber más.");
  });

  it("ofrece volver a contar la etapa solo si el cultivo tiene perfil y la etapa quedó en «No sé»", () => {
    expect(describeActionPlan(empty, coffee("unknown")).fix).toBe("tell-stage");
    expect(describeActionPlan(empty, coffee("produccion")).fix).toBeNull();
    expect(describeActionPlan(empty, undefined).fix).toBeNull();
    expect(describeActionPlan(partial, coffee("unknown")).fix).toBeNull();
  });

  it("tolera etapas que no llegan en la respuesta", () => {
    const view = describeActionPlan({ ...empty, stages: [] }, undefined);
    expect(view.stages).toHaveLength(4);
    expect(view.stages.every((s) => s.state === "empty")).toBe(true);
  });

  it("cuenta en plural cuando hay varios pasos", () => {
    const second = { ...observe, id: "a:observe-2" };
    const plan = actionPlanSchema.parse({ ...partial, status: "ready", stages: stages([observe, second]), gaps: [] });
    expect(describeActionPlan(plan, coffee("produccion")).summary).toBe("2 pasos listos");
  });
});

describe("planForRotation", () => {
  const result = (id: string, actionPlan?: ActionPlan): RotationResult => ({ rotation: { id, name: id, cropIds: ["cafe"], description: "d" }, score: 3, whySuggested: "w", evidence: ["e"], benefits: ["b"], informationGaps: ["g"], risks: ["r"], validateWithLocalExpert: ["v"], ...(actionPlan ? { actionPlan } : {}) });
  const baseline = { rotations: [result("baseline", partial), result("legume", empty)] };

  it("sin escenario usa el plan de la propia respuesta", () => {
    expect(planForRotation(result("baseline", empty), {}, baseline)).toBe(empty);
  });

  it("con escenario «¿y si…?» muestra el plan del clima real de la misma alternativa", () => {
    const scenario = { scenario: { tempDeltaC: 2 } };
    expect(planForRotation(result("baseline", empty), scenario, baseline)).toBe(partial);
    expect(planForRotation(result("otra"), scenario, baseline)).toBeUndefined();
  });
});

describe("describePlanEvidence", () => {
  const withPlan = (id: string, actionPlan: ActionPlan): RotationResult => ({ rotation: { id, name: id, cropIds: ["cafe"], description: "d" }, score: 3, whySuggested: "w", evidence: ["e"], benefits: ["b"], informationGaps: ["g"], risks: ["r"], validateWithLocalExpert: ["v"], actionPlan });
  const ruled = actionPlanSchema.parse({ ...partial, stages: stages([{ ...observe, ruleId: "rule-v1" }, { ...harvest, ruleId: "rule-v1" }]) });

  it("lista la evidencia de cada práctica una sola vez aunque salga en varias alternativas", () => {
    const rows = describePlanEvidence([withPlan("baseline", ruled), withPlan("legume", ruled)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].what).toBe("Revisa la maduración");
    expect(rows[0].evidence.map((e) => e.typeLabel)).toEqual(["Práctica publicada", "Dato de la zona, no de tu lote", "Lo que nos contaste"]);
    expect(rows[0].evidence[0]).toMatchObject({ reference: "Página 5, En la cosecha y poscosecha", href: "https://example.org/b.pdf" });
    expect(rows[0].evidence[1].date).toBe("30/10/2026");
  });

  it("no muestra nada si ningún plan tiene pasos listos", () => {
    expect(describePlanEvidence([withPlan("baseline", empty)])).toEqual([]);
  });
});

describe("planChip", () => {
  it("resume el plan para la tarjeta del camino y no muestra nada si la respuesta no trae plan", () => {
    expect(planChip(partial)).toEqual({ label: "1 paso para hacer", tone: "ready" });
    expect(planChip(empty)).toEqual({ label: "Sin pasos aún", tone: "empty" });
    expect(planChip(undefined)).toBeNull();
  });
});

describe("evidenceChip", () => {
  it("nombra cada fuente en corto: publicación con página, dato regional y lo declarado", () => {
    expect(evidenceChip(source)).toEqual({ label: "Cenicafé · Página 5", icon: "book", href: "https://example.org/b.pdf" });
    expect(evidenceChip(climate)).toEqual({ label: "NASA POWER · tu zona", icon: "pin" });
    expect(evidenceChip(declared)).toEqual({ label: "Lo que nos contaste", icon: "person" });
  });
});

describe("actionPlanSpeechItems", () => {
  it("lee el resumen, las instrucciones de los pasos listos y lo que falta", () => {
    const text = actionPlanSpeechItems(describeActionPlan(partial, coffee("produccion"))).map((item) => item.text).join(" ");
    expect(text).toContain("Qué hacer ahora");
    expect(text).toContain("Mira los frutos.");
    expect(text).toContain("Falta: Confirmación de madurez en campo.");
  });
});
