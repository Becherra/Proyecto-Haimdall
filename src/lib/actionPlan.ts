import { z } from "zod";
import rawRules from "../../data/action-plan-rules.json";
import { actionPlanSchema, PLAN_STAGES, type ActionPlan, type CropProfileSelection, type CurrentSeason, type PlanAction, type Rotation } from "../types";
import { SOWING_CALENDAR_REGION } from "./config";

const ruleSchema = z.object({ id: z.string().min(1), cropId: z.string(), stageId: z.string(), source: z.string(), url: z.url(), reference: z.string(), sourceDate: z.string(), scope: z.string(), instructions: z.array(z.string().min(1)).min(1), verification: z.string(), limitations: z.array(z.string()) });
const catalog = z.object({ version: z.literal(1), reviewedAt: z.iso.date(), rules: z.array(ruleSchema) }).parse(rawRules);
export type PlanInput = { rotation: Rotation; location: { lat: number; lon: number }; profile?: CropProfileSelection; season?: CurrentSeason | null; hypothetical?: boolean };
const disclaimer = "Apoyo a la decisión. Plan inicial sin almacenamiento de seguimiento; no confirma enfermedades ni condiciones del lote.";

function assemble(actions: PlanAction[], gaps: string[]): ActionPlan {
  const ready = actions.filter((action) => action.status === "ready").length;
  return actionPlanSchema.parse({ status: ready === 0 ? "insufficient" : gaps.length || ready < actions.length ? "partial" : "ready", stages: PLAN_STAGES.map((stage) => ({ stage, actions: actions.filter((action) => action.stage === stage) })), gaps, disclaimer });
}

function coverageGap({ rotation, location, profile, hypothetical }: PlanInput): string | null {
  const b = SOWING_CALENDAR_REGION;
  if (hypothetical) return "El escenario es hipotético: vuelve al clima de referencia para obtener un plan inicial.";
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon) || location.lat < b.minLat || location.lat > b.maxLat || location.lon < b.minLon || location.lon > b.maxLon) return "Fuera del ámbito geográfico del piloto del Eje Cafetero.";
  if (!profile) return "Falta el perfil del cultivo y su etapa.";
  if (!["cafe", "platano"].includes(profile.cropId) || !rotation.cropIds.includes(profile.cropId)) return "El cultivo no pertenece al piloto o no corresponde a esta alternativa.";
  if (profile.stageId === "unknown") return "Falta conocer la etapa del cultivo.";
  return null;
}

/** Genera un plan inicial determinista; solo activa observación cuando hay fuente y señal reciente. No diagnostica ni modifica puntajes. */
export function generateActionPlan(input: PlanInput): ActionPlan {
  const gap = coverageGap(input);
  if (gap) return assemble([], [gap]);
  const rule = catalog.rules.find((item) => item.cropId === input.profile?.cropId && item.stageId === input.profile.stageId);
  if (!rule) return assemble([], ["No hay prácticas verificadas en el catálogo de ejecución para este cultivo y etapa. No se prescribe manejo."]);
  const season = input.season;
  if (!season || !["drier", "much-drier"].includes(season.status)) return assemble([], ["No hay una señal reciente seca que active esta regla; esto no demuestra ausencia de riesgos en la finca."]);
  const prefix = `${input.rotation.id}:${rule.id}`;
  const evidence = [
    { id: `${prefix}:source`, type: "published-practice" as const, source: rule.source, sourceUrl: rule.url, date: rule.sourceDate, reference: rule.reference, scale: rule.scope, detail: "La publicación recomienda observar la maduración y seleccionar los frutos maduros durante la cosecha." },
    { id: `${prefix}:climate`, type: "regional" as const, source: "NASA POWER", sourceUrl: "https://power.larc.nasa.gov/", date: season.lastDate, detail: "La comparación reciente disponible muestra menos lluvia de lo habitual; no mide la humedad ni el estado de esta finca." },
    { id: `${prefix}:profile`, type: "declared" as const, source: "Agricultor", detail: "Café en producción, según el perfil declarado." },
  ];
  const common = { ruleId: rule.id, evidence, risks: ["No deducir enfermedades, madurez o necesidad de tratamiento de los datos climáticos."], limitations: rule.limitations };
  const actions: PlanAction[] = [
    { ...common, id: `${prefix}:observe`, stage: "monitor", status: "ready", what: "Revisa la maduración antes de planear la cosecha", why: "El cultivo está en producción y la señal regional seca aconseja comprobar su estado en campo.", appliesWhen: "Cafetal en producción con señal reciente seca; antes de decidir qué frutos recolectar.", prerequisites: ["Cultivo y etapa declarados", "Señal reciente seca disponible"], missingData: [], instructions: rule.instructions, verification: rule.verification },
    { ...common, id: `${prefix}:harvest`, stage: "review", status: "missing-data", what: "Decidir la recolección selectiva", why: "La selección depende de la madurez real de los frutos.", appliesWhen: "Después de comprobar la madurez en campo.", prerequisites: ["Observación de frutos maduros"], missingData: ["Confirmación de madurez en campo; este endpoint no la recoge."], instructions: [], verification: "Comprueba con la observación del lote qué frutos están maduros antes de decidir la cosecha." },
  ];
  return assemble(actions, ["Falta confirmar la madurez en campo.", "Este plan cubre observación del café actual; no valida el establecimiento ni manejo de cultivos asociados."]);
}
