import profilesData from "../../data/crop-profiles.json";
import { CROPS } from "./catalog";
import {
  cropProfileCatalogSchema, NO_PROBLEM_ANSWER, OTHER_ANSWER, UNKNOWN_ANSWER,
  type CropProfile, type CropProfileCatalog, type CropProfileSelection, type SourceRef,
} from "../types";

const RESERVED_IDS = new Set([UNKNOWN_ANSWER, OTHER_ANSWER, NO_PROBLEM_ANSWER]);

/** Recoge todas las citas del catálogo, estén donde estén, para comprobar que apuntan a una fuente real. */
function collectSourceRefs(value: unknown, found: SourceRef[] = []): SourceRef[] {
  if (Array.isArray(value)) value.forEach((item) => collectSourceRefs(item, found));
  else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.sourceId === "string") found.push(record as SourceRef);
    Object.values(record).forEach((item) => collectSourceRefs(item, found));
  }
  return found;
}

function duplicates(ids: readonly string[]): string[] {
  return ids.filter((item, index) => ids.indexOf(item) !== index);
}

function profileReferenceErrors(profile: CropProfile, knownCropIds: ReadonlySet<string>): string[] {
  const where = `perfil ${profile.cropId}`;
  const stageIds = new Set(profile.growthStages.map((stage) => stage.id));
  const threatIds = new Set(profile.threats.map((threat) => threat.id));
  const ownIds = [...profile.cultivars, ...profile.plantingMaterials, ...profile.growthStages, ...profile.threats].map((item) => item.id);
  const errors = [
    ...(knownCropIds.has(profile.cropId) ? [] : [`${where}: el cultivo no existe en data/crops.json`]),
    ...duplicates(ownIds).map((dup) => `${where}: id repetido «${dup}»`),
    ...ownIds.filter((own) => RESERVED_IDS.has(own)).map((own) => `${where}: «${own}» está reservado para las respuestas del flujo`),
  ];
  for (const cultivar of profile.cultivars) {
    for (const response of cultivar.threatResponses) {
      if (!threatIds.has(response.threatId)) errors.push(`${where}: ${cultivar.id} cita la amenaza inexistente «${response.threatId}»`);
    }
  }
  for (const measure of profile.threats.flatMap((threat) => threat.measures)) {
    for (const stageId of measure.stageIds) {
      if (!stageIds.has(stageId)) errors.push(`${where}: la medida ${measure.id} cita la etapa inexistente «${stageId}»`);
    }
  }
  return errors;
}

/**
 * Errores de integridad que Zod no puede ver: citas a fuentes inexistentes, cultivos que no están
 * en el catálogo agronómico, ids repetidos o reservados, y referencias rotas entre variedades, amenazas y etapas.
 */
export function findCatalogReferenceErrors(catalog: CropProfileCatalog, knownCropIds: ReadonlySet<string>): string[] {
  const sourceIds = new Set(catalog.sources.map((source) => source.id));
  const errors = duplicates(catalog.sources.map((source) => source.id)).map((dup) => `fuente repetida «${dup}»`);
  errors.push(...duplicates(catalog.profiles.map((profile) => profile.cropId)).map((dup) => `perfil repetido «${dup}»`));
  for (const ref of collectSourceRefs(catalog.profiles)) {
    if (!sourceIds.has(ref.sourceId)) errors.push(`cita a la fuente inexistente «${ref.sourceId}»`);
  }
  return [...errors, ...catalog.profiles.flatMap((profile) => profileReferenceErrors(profile, knownCropIds))];
}

/** Valida forma (Zod) e integridad del catálogo; falla con todos los problemas juntos. */
export function parseCropProfileCatalog(raw: unknown, knownCropIds: ReadonlySet<string>): CropProfileCatalog {
  const catalog = cropProfileCatalogSchema.parse(raw);
  const errors = findCatalogReferenceErrors(catalog, knownCropIds);
  if (errors.length > 0) throw new Error(`Catálogo de perfiles inválido:\n- ${errors.join("\n- ")}`);
  return catalog;
}

/** Catálogo piloto validado al cargar el módulo, como `CROPS`. */
export const CROP_PROFILES: CropProfileCatalog = parseCropProfileCatalog(profilesData, new Set(CROPS.map((crop) => crop.id)));

/** Perfil de un cultivo, o undefined si aún no tiene perfil (el flujo entonces no hace preguntas extra). */
export function getCropProfile(catalog: CropProfileCatalog, cropId: string): CropProfile | undefined {
  return catalog.profiles.find((profile) => profile.cropId === cropId);
}

/** Problemas de una selección contra el perfil: ids que no existen. «No sé» y «Otra» siempre son válidas. */
export function selectionErrors(catalog: CropProfileCatalog, selection: CropProfileSelection): string[] {
  const profile = getCropProfile(catalog, selection.cropId);
  if (!profile) return [`El cultivo «${selection.cropId}» no tiene perfil`];
  const check = (value: string | undefined, allowed: readonly { id: string }[], extra: readonly string[], label: string) =>
    value === undefined || extra.includes(value) || allowed.some((item) => item.id === value) ? [] : [`${label} desconocido: «${value}»`];
  return [
    ...check(selection.cultivarId, profile.cultivars, [UNKNOWN_ANSWER, OTHER_ANSWER], "Variedad"),
    ...check(selection.plantingMaterialId, profile.plantingMaterials, [UNKNOWN_ANSWER, OTHER_ANSWER], "Material de siembra"),
    ...check(selection.stageId, profile.growthStages, [UNKNOWN_ANSWER], "Etapa"),
    ...check(selection.observedThreatId, profile.threats, [UNKNOWN_ANSWER, NO_PROBLEM_ANSWER], "Problema"),
  ];
}
