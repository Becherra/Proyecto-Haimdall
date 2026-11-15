import { describe, expect, it } from "vitest";
import { actionPlanSchema, evidenceSchema, planActionSchema, rotationResultSchema } from "../src/types";

const evidence = { id: "power-prectotcorr", type: "regional", source: "NASA POWER", scale: "malla de ~0.5°", date: "2015–2024", detail: "Lluvia de jul–ago por debajo de lo normal" };
const readyAction = {
  id: "sow-window", stage: "prepare", status: "ready", what: "Sembrar dentro de la ventana de siembra del catálogo",
  why: "Evita los meses más secos del sitio", appliesWhen: "Etapa de preparación del lote", prerequisites: [], missingData: [],
  verification: "Registrar la fecha de siembra y la lluvia de las dos semanas siguientes", evidence: [evidence],
};
const plan = { status: "ready", stages: [{ stage: "prepare", actions: [readyAction] }], gaps: [], disclaimer: "Plan orientativo construido con estos datos y fuentes; algunas condiciones del lote aún no se conocen." };

describe("evidenceSchema", () => {
  it("acepta los cinco tipos de evidencia y rechaza uno desconocido", () => {
    for (const type of ["observed", "estimated", "declared", "regional", "published-practice"]) {
      expect(evidenceSchema.safeParse({ ...evidence, type }).success).toBe(true);
    }
    expect(evidenceSchema.safeParse({ ...evidence, type: "invented" }).success).toBe(false);
  });
});

describe("planActionSchema", () => {
  it("acepta una acción lista con evidencia y sin datos pendientes", () => {
    expect(planActionSchema.safeParse(readyAction).success).toBe(true);
  });

  it("rechaza una acción lista sin evidencia", () => {
    expect(planActionSchema.safeParse({ ...readyAction, evidence: [] }).success).toBe(false);
  });

  it("rechaza una acción lista que todavía tiene datos pendientes", () => {
    expect(planActionSchema.safeParse({ ...readyAction, missingData: ["Disponibilidad de riego"] }).success).toBe(false);
  });

  it("exige decir qué dato falta cuando el estado es 'missing-data' o 'insufficient-evidence'", () => {
    expect(planActionSchema.safeParse({ ...readyAction, status: "missing-data", missingData: [] }).success).toBe(false);
    expect(planActionSchema.safeParse({ ...readyAction, status: "missing-data", missingData: ["Disponibilidad de riego"] }).success).toBe(true);
    expect(planActionSchema.safeParse({ ...readyAction, status: "insufficient-evidence", evidence: [], missingData: [] }).success).toBe(false);
  });
});

describe("actionPlanSchema", () => {
  it("acepta un plan con una acción lista", () => {
    expect(actionPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("acepta un plan 'insufficient' sin acciones listas y con sus vacíos", () => {
    const insufficient = {
      ...plan, status: "insufficient", gaps: ["No hay guía técnica documentada para este cultivo en esta zona"],
      stages: [{ stage: "prepare", actions: [{ ...readyAction, status: "insufficient-evidence", evidence: [], missingData: ["Guía técnica del cultivo en la zona"] }] }],
    };
    expect(actionPlanSchema.safeParse(insufficient).success).toBe(true);
  });

  it("rechaza un plan 'insufficient' que traiga acciones listas (no inventa tareas)", () => {
    expect(actionPlanSchema.safeParse({ ...plan, status: "insufficient", gaps: ["Sin guía"] }).success).toBe(false);
  });

  it("rechaza un plan 'insufficient' sin explicar los vacíos", () => {
    const stages = [{ stage: "prepare", actions: [{ ...readyAction, status: "insufficient-evidence", evidence: [], missingData: ["Guía"] }] }];
    expect(actionPlanSchema.safeParse({ ...plan, status: "insufficient", stages, gaps: [] }).success).toBe(false);
  });

  it("rechaza etapas repetidas y acciones en una etapa distinta a la de su grupo", () => {
    const stage = { stage: "prepare", actions: [readyAction] };
    expect(actionPlanSchema.safeParse({ ...plan, stages: [stage, stage] }).success).toBe(false);
    expect(actionPlanSchema.safeParse({ ...plan, stages: [{ stage: "monitor", actions: [readyAction] }] }).success).toBe(false);
  });
});

describe("rotationResultSchema · actionPlan", () => {
  const result = {
    rotation: { id: "base", name: "Actual", cropIds: ["maiz"], description: "Línea base" }, score: 4, whySuggested: "Conserva suelo",
    evidence: ["NASA POWER"], benefits: ["Menor erosión"], informationGaps: ["Suelo local"], risks: ["Mercado"], validateWithLocalExpert: ["Validar fechas"],
  };

  it("sigue aceptando rotaciones sin plan de acción (compatibilidad)", () => {
    expect(rotationResultSchema.safeParse(result).success).toBe(true);
  });

  it("acepta un plan de acción opcional y valida su forma", () => {
    expect(rotationResultSchema.safeParse({ ...result, actionPlan: plan }).success).toBe(true);
    expect(rotationResultSchema.safeParse({ ...result, actionPlan: { ...plan, status: "otro" } }).success).toBe(false);
  });
});
