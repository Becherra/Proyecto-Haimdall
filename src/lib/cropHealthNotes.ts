import { getCropProfile } from "./cropProfiles";
import {
  NO_PROBLEM_ANSWER, OTHER_ANSWER, UNKNOWN_ANSWER,
  type Claim, type CropProfile, type CropProfileCatalog, type CropProfileSelection,
  type ManagementMeasure, type SourceRef, type ThreatProfile,
} from "../types";

/** Fuente citada lista para mostrar: quién, qué, dónde. */
export type CitedSource = { label: string; url: string; locator?: string };
/** Un dato con sus fuentes ya resueltas. */
export type NoteFact = { text: string; context?: string; sources: CitedSource[] };
export type NoteMeasure = Pick<ManagementMeasure, "id" | "action" | "condition" | "reason" | "verification"> & { sources: CitedSource[] };

export type ObservationNotes = {
  /** Siempre «sin confirmar»: la app nunca diagnostica. */
  status: "observacion-sin-confirmar";
  heading: string;
  cultivarResponse?: NoteFact;
  symptomsToCompare?: NoteFact;
  favoringConditions?: NoteFact;
  officialNotice?: string;
  measures: NoteMeasure[];
};

export type CropHealthNotes = {
  cultivar: { label: string; facts: NoteFact[] };
  stage: { label: string; description?: NoteFact };
  observation?: ObservationNotes;
  /** Lo que escribió el agricultor, tal cual; no se interpreta. */
  userNote?: string;
  gaps: string[];
  disclaimer: string;
};

export const NOT_A_DIAGNOSIS = "Esto no es un diagnóstico: lo que marcas es tu observación. Solo un técnico o un análisis de laboratorio puede confirmarlo.";
export const NO_CLIMATE_LINK = "Estos datos de sanidad no se cruzan con el clima de la NASA ni cambian el puntaje de las rotaciones.";

function cite(catalog: CropProfileCatalog, refs: readonly SourceRef[]): CitedSource[] {
  return refs.flatMap((ref) => {
    const source = catalog.sources.find((item) => item.id === ref.sourceId);
    return source ? [{ label: `${source.institution} — ${source.title} (${source.date})`, url: source.url, locator: ref.locator }] : [];
  });
}

const factFromClaim = (catalog: CropProfileCatalog, claim: Claim): NoteFact => ({ text: claim.statement, context: claim.context, sources: cite(catalog, claim.sources) });

function describeCultivar(catalog: CropProfileCatalog, profile: CropProfile, selection: CropProfileSelection, gaps: string[]) {
  if (selection.cultivarId === UNKNOWN_ANSWER) {
    gaps.push("No sabemos tu variedad: no podemos decir cómo responde a los problemas de la lista.");
    return { label: "Variedad sin indicar", facts: [] };
  }
  if (selection.cultivarId === OTHER_ANSWER) {
    const name = selection.otherCultivarName || "Tu variedad";
    gaps.push(`«${name}» no está en el catálogo piloto: no tenemos datos verificados de ella.`);
    return { label: name, facts: [] };
  }
  const cultivar = profile.cultivars.find((item) => item.id === selection.cultivarId);
  return cultivar ? { label: cultivar.name, facts: cultivar.attributes.map((claim) => factFromClaim(catalog, claim)) } : { label: "Variedad sin indicar", facts: [] };
}

function describeStage(catalog: CropProfileCatalog, profile: CropProfile, stageId: string, gaps: string[]) {
  const stage = profile.growthStages.find((item) => item.id === stageId);
  if (!stage) {
    gaps.push("Sin la etapa mostramos todas las medidas; algunas pueden no aplicar ahora.");
    return { label: "Etapa sin indicar" };
  }
  return { label: stage.label, description: factFromClaim(catalog, stage.description) };
}

function cultivarResponse(catalog: CropProfileCatalog, profile: CropProfile, cultivarId: string, threat: ThreatProfile, gaps: string[]): NoteFact | undefined {
  const cultivar = profile.cultivars.find((item) => item.id === cultivarId);
  if (!cultivar) return undefined;
  const response = cultivar.threatResponses.find((item) => item.threatId === threat.id)?.response;
  if (!response || response.status === "undocumented") {
    gaps.push(`No hay datos verificados de cómo responde ${cultivar.name} a ${threat.commonName.toLowerCase()}.`);
    return undefined;
  }
  return { text: `${cultivar.name} está documentada como ${response.value} a ${threat.commonName.toLowerCase()}.`, context: response.context, sources: cite(catalog, response.sources) };
}

/** Medidas de la amenaza que aplican a la etapa; si la etapa es desconocida, todas. */
export function measuresForStage(threat: ThreatProfile, stageId: string): ManagementMeasure[] {
  if (stageId === UNKNOWN_ANSWER) return threat.measures;
  return threat.measures.filter((measure) => measure.stageIds.length === 0 || measure.stageIds.includes(stageId));
}

function officialNotice(threat: ThreatProfile): string | undefined {
  if (!threat.requiresOfficialConfirmation) return undefined;
  const norm = threat.regulation.status === "documented" ? ` (${threat.regulation.value.norm})` : "";
  return `${threat.commonName} tiene medidas oficiales${norm}. Requiere confirmación: avisa al ICA o a tu extensionista y no apliques productos ni arranques plantas por tu cuenta.`;
}

function describeObservation(catalog: CropProfileCatalog, profile: CropProfile, selection: CropProfileSelection, threat: ThreatProfile, gaps: string[]): ObservationNotes {
  if (threat.symptoms.status === "undocumented") gaps.push(threat.symptoms.reason);
  return {
    status: "observacion-sin-confirmar",
    heading: `Marcaste: posible ${threat.commonName.toLowerCase()} (sin confirmar)`,
    cultivarResponse: cultivarResponse(catalog, profile, selection.cultivarId, threat, gaps),
    symptomsToCompare: threat.symptoms.status === "documented" ? { text: threat.symptoms.value.join(" "), context: threat.symptoms.context, sources: cite(catalog, threat.symptoms.sources) } : undefined,
    favoringConditions: threat.favoringConditions.status === "documented" ? { text: threat.favoringConditions.value.join(" "), context: threat.favoringConditions.context, sources: cite(catalog, threat.favoringConditions.sources) } : undefined,
    officialNotice: officialNotice(threat),
    measures: measuresForStage(threat, selection.stageId).map(({ id, action, condition, reason, verification, sources }) => ({ id, action, condition, reason, verification, sources: cite(catalog, sources) })),
  };
}

/**
 * Resume lo que las fuentes dicen sobre el cultivo que describió el agricultor.
 * Nunca afirma que el cultivo tenga una enfermedad: la observación se presenta como «posible, sin confirmar»,
 * y todo vacío de información se lista en `gaps`. No usa clima ni ubicación.
 */
export function buildCropHealthNotes(catalog: CropProfileCatalog, selection: CropProfileSelection): CropHealthNotes | undefined {
  const profile = getCropProfile(catalog, selection.cropId);
  if (!profile) return undefined;
  const gaps: string[] = [];
  const cultivar = describeCultivar(catalog, profile, selection, gaps);
  const stage = describeStage(catalog, profile, selection.stageId, gaps);
  const threat = profile.threats.find((item) => item.id === selection.observedThreatId);
  const observation = threat ? describeObservation(catalog, profile, selection, threat, gaps) : undefined;
  if (selection.observedThreatId === UNKNOWN_ANSWER || selection.observedThreatId === NO_PROBLEM_ANSWER) {
    gaps.push("Si algún día ves algo raro en las plantas, consulta a tu extensionista antes de aplicar cualquier producto.");
  }
  gaps.push(NO_CLIMATE_LINK);
  return { cultivar, stage, observation, userNote: selection.symptomsNote || undefined, gaps, disclaimer: NOT_A_DIAGNOSIS };
}
