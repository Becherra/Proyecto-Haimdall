import { describe, expect, it } from "vitest";
import { generateActionPlan, type PlanInput } from "../src/lib/actionPlan";
import { validateAnalysisProfile } from "../src/lib/analysis";
import { actionPlanSchema, analysisRequestSchema, type CurrentSeason } from "../src/types";

const season: CurrentSeason = { windowDays: 30, firstDate: "20261001", lastDate: "20261030", daysWithData: 30, rainMm: 40, normalRainMm: 100, rainPercentOfNormal: 40, status: "much-drier", temperatureAnomalyC: 1, currentDryStreakDays: 3, baselineYears: 10 };
const input: PlanInput = { rotation: { id: "baseline", name: "Café", cropIds: ["cafe"], description: "Cultivo actual" }, location: { lat: 4.8133, lon: -75.6961 }, profile: { cropId: "cafe", cultivarId: "unknown", stageId: "produccion" }, season };
const priorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3, currentCropId: "cafe" };

describe("plan de ejecución piloto", () => {
  it("activa observación respaldada, pero bloquea cosecha sin confirmar madurez", () => {
    const plan = generateActionPlan(input);
    expect(plan.status).toBe("partial");
    const actions = plan.stages.flatMap((stage) => stage.actions);
    expect(actions[0].status).toBe("ready");
    expect(actions[0].evidence.map((e) => e.type)).toEqual(["published-practice", "regional", "declared"]);
    expect(actions[0].evidence[0].reference).toContain("Página 5");
    expect(actions[1].status).toBe("missing-data");
    expect(actions[1].instructions).toEqual([]);
    expect(actionPlanSchema.safeParse(plan).success).toBe(true);
  });
  it.each([undefined, "unknown"])("sin etapa (%s) no prescribe", (stageId) => {
    const plan = generateActionPlan({ ...input, profile: stageId ? { ...input.profile!, stageId } : undefined });
    expect(plan.status).toBe("insufficient");
    expect(plan.gaps.length).toBeGreaterThan(0);
  });
  it.each([null, { ...season, status: "normal" as const }])("sin señal seca suficiente no activa la regla", (season) => {
    expect(generateActionPlan({ ...input, season }).status).toBe("insufficient");
  });
  it("fuera del piloto o en escenario hipotético no prescribe", () => {
    expect(generateActionPlan({ ...input, location: { lat: 40, lon: 0 } }).status).toBe("insufficient");
    expect(generateActionPlan({ ...input, hypothetical: true }).status).toBe("insufficient");
  });
  it("plátano sin fuente de ejecución verificada muestra el vacío", () => {
    const plan = generateActionPlan({ ...input, rotation: { ...input.rotation, cropIds: ["platano"] }, profile: { cropId: "platano", cultivarId: "unknown", stageId: "vegetativo" } });
    expect(plan.status).toBe("insufficient");
    expect(plan.gaps.join()).toContain("prácticas verificadas");
  });
  it("no interpreta síntomas ni diagnostica usando clima", () => {
    expect(generateActionPlan({ ...input, profile: { ...input.profile!, symptomsNote: "Tengo una enfermedad", observedThreatId: "roya" } })).toEqual(generateActionPlan(input));
    expect(generateActionPlan(input).stages.flatMap((s) => s.actions)[0].limitations?.join()).toContain("no confirma");
  });
  it("ids estables, diferentes por alternativa, sin mutar entradas", () => {
    const before = structuredClone(input);
    expect(generateActionPlan(input)).toEqual(generateActionPlan(input));
    const other = generateActionPlan({ ...input, rotation: { ...input.rotation, id: "legume" } });
    expect(other.stages[2].actions[0].id).not.toBe(generateActionPlan(input).stages[2].actions[0].id);
    expect(input).toEqual(before);
  });
  it("acepta entrada antigua, valida perfil y rechaza incoherencias", () => {
    const body = { lat: 4, lon: -75, startYear: 2020, endYear: 2022, priorities };
    expect(analysisRequestSchema.safeParse(body).success).toBe(true);
    expect(analysisRequestSchema.parse({ ...body, cropProfile: input.profile }).cropProfile).toEqual(input.profile);
    expect(() => validateAnalysisProfile(priorities, input.profile)).not.toThrow();
    expect(() => validateAnalysisProfile({ ...priorities, currentCropId: "platano" }, input.profile)).toThrow();
    expect(() => validateAnalysisProfile(priorities, { ...input.profile!, stageId: "inventada" })).toThrow();
  });
});
