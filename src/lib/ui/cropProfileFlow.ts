import { getCropProfile } from "../cropProfiles";
import { NO_PROBLEM_ANSWER, OTHER_ANSWER, UNKNOWN_ANSWER, type CropProfileCatalog, type CropProfileSelection } from "../../types";

/** Preguntas extra que aparecen después de «¿Qué cultivo tienes?» cuando el cultivo tiene perfil. */
export type ProfileStep = "cultivar" | "material" | "stage" | "problem";
export type ProfileOption = { id: string; label: string; hint?: string };

/** Respuestas en curso; cada paso se completa con una opción, incluida «No sé». */
export type ProfileDraft = {
  cultivarId?: string;
  otherCultivarName?: string;
  plantingMaterialId?: string;
  stageId?: string;
  observedThreatId?: string;
  symptomsNote?: string;
};

export const PROFILE_TITLES: Record<ProfileStep, string> = {
  cultivar: "¿Qué variedad tienes?",
  material: "¿Con qué semilla sembraste?",
  stage: "¿En qué etapa está?",
  problem: "¿Has visto algún problema?",
};

const UNKNOWN: ProfileOption = { id: UNKNOWN_ANSWER, label: "No sé" };

/** Pasos del perfil para el cultivo elegido; vacío si el cultivo aún no tiene perfil (no se pregunta nada más). */
export function profileStepsFor(catalog: CropProfileCatalog, cropId: string | null): ProfileStep[] {
  const profile = cropId ? getCropProfile(catalog, cropId) : undefined;
  if (!profile) return [];
  return profile.plantingMaterials.length > 0 ? ["cultivar", "material", "stage", "problem"] : ["cultivar", "stage", "problem"];
}

/** Tarjeta en la que abren las preguntas: la de `target` si el cultivo la tiene (la 0 es «¿Qué cultivo tienes?»), si no la primera. */
export function startingCardIndex(catalog: CropProfileCatalog, cropId: string | null, target: ProfileStep | undefined): number {
  const index = target ? profileStepsFor(catalog, cropId).indexOf(target) : -1;
  return index === -1 ? 0 : index + 1;
}

/** Opciones de cada paso, siempre con una salida («No sé», «Otra», «Nada») para no bloquear al agricultor. */
export function profileOptions(catalog: CropProfileCatalog, cropId: string, step: ProfileStep): ProfileOption[] {
  const profile = getCropProfile(catalog, cropId);
  if (!profile) return [];
  switch (step) {
    case "cultivar": return [...profile.cultivars.map(({ id, name }) => ({ id, label: name })), { id: OTHER_ANSWER, label: "Otra variedad" }, UNKNOWN];
    case "material": return [...profile.plantingMaterials.map(({ id, name }) => ({ id, label: name })), { id: OTHER_ANSWER, label: "Otro" }, UNKNOWN];
    case "stage": return [...profile.growthStages.map(({ id, label, technicalName }) => ({ id, label, hint: technicalName })), UNKNOWN];
    case "problem": return [...profile.threats.map(({ id, commonName }) => ({ id, label: commonName })), { id: NO_PROBLEM_ANSWER, label: "No he visto nada" }, UNKNOWN];
  }
}

/** Un paso está contestado si eligió una opción; el problema observado es opcional. */
export function isStepAnswered(step: ProfileStep, draft: ProfileDraft): boolean {
  if (step === "cultivar") return draft.cultivarId !== undefined;
  if (step === "material") return draft.plantingMaterialId !== undefined;
  if (step === "stage") return draft.stageId !== undefined;
  return true;
}

/** Convierte las respuestas en una selección completa; lo que falte cuenta como «No sé». Undefined si el cultivo no tiene perfil. */
export function toProfileSelection(catalog: CropProfileCatalog, cropId: string | null, draft: ProfileDraft): CropProfileSelection | undefined {
  if (!cropId || !getCropProfile(catalog, cropId)) return undefined;
  const steps = profileStepsFor(catalog, cropId);
  return {
    cropId,
    cultivarId: draft.cultivarId ?? UNKNOWN_ANSWER,
    otherCultivarName: draft.cultivarId === OTHER_ANSWER ? draft.otherCultivarName?.trim() || undefined : undefined,
    plantingMaterialId: steps.includes("material") ? draft.plantingMaterialId ?? UNKNOWN_ANSWER : undefined,
    stageId: draft.stageId ?? UNKNOWN_ANSWER,
    observedThreatId: draft.observedThreatId,
    symptomsNote: draft.symptomsNote?.trim() || undefined,
  };
}

/** Inverso de `toProfileSelection`, para marcar las respuestas al volver a editar. */
export function draftFromSelection(selection: CropProfileSelection | undefined): ProfileDraft {
  if (!selection) return {};
  const { cultivarId, otherCultivarName, plantingMaterialId, stageId, observedThreatId, symptomsNote } = selection;
  return { cultivarId, otherCultivarName, plantingMaterialId, stageId, observedThreatId, symptomsNote };
}
