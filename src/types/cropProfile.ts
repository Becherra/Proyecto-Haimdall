import { z } from "zod";

/**
 * Perfiles de cultivo y sanidad vegetal (piloto café y plátano).
 *
 * Contrato separado del motor de puntuación climática: nada aquí alimenta `scoring.ts`.
 * Toda afirmación agronómica lleva al menos una fuente; lo que las fuentes leídas no dicen
 * se guarda como `{ status: "undocumented" }`, nunca como un valor inventado.
 */

export const CROP_PROFILE_SCHEMA_VERSION = 1;

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa ids en minúscula separados por guiones");
const text = z.string().trim().min(1);

/** Ficha de una fuente consultada. Se cita por `id` desde cada afirmación. */
export const profileSourceSchema = z.object({
  id,
  institution: text,
  title: text,
  /** Fecha o versión tal como la da la fuente ("2017-02", "2021"); "sin fecha" si no la indica. */
  date: text,
  url: z.url(),
  documentType: z.enum(["avance-tecnico", "boletin", "manual", "resolucion", "alerta", "registro-repositorio", "articulo"]),
  /** Cultivos y variedades que la fuente cubre, en texto libre. */
  crops: text,
  geographicScope: text,
  /** Licencia o términos visibles en la fuente; "no indicada" si no aparecen. */
  license: text,
  /** Qué se leyó realmente (documento completo, solo resumen, imagen escaneada…) y qué no. */
  limitations: text,
});
export type ProfileSource = z.infer<typeof profileSourceSchema>;

/** Cita a una fuente, con la parte exacta donde está el dato. */
export const sourceRefSchema = z.object({ sourceId: id, locator: text.optional() });
export type SourceRef = z.infer<typeof sourceRefSchema>;

const sourceRefs = z.array(sourceRefSchema).min(1, "Toda afirmación necesita al menos una fuente");

/** Afirmación agronómica en lenguaje sencillo con sus fuentes y el contexto donde vale (región, año, variedad). */
export const claimSchema = z.object({ statement: text, sources: sourceRefs, context: text.optional() });
export type Claim = z.infer<typeof claimSchema>;

/** Un dato que puede estar documentado (con fuentes) o explícitamente sin documentar. */
export function documented<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion("status", [
    z.object({ status: z.literal("documented"), value, sources: sourceRefs, context: text.optional() }),
    z.object({ status: z.literal("undocumented"), reason: text }),
  ]);
}

export const threatResponseSchema = z.object({
  threatId: id,
  response: documented(z.enum(["resistente", "susceptible"])),
});
export type ThreatResponse = z.infer<typeof threatResponseSchema>;

/** Variedad (café) o clon (plátano). */
export const cultivarSchema = z.object({
  id,
  name: text,
  kind: z.enum(["variedad", "clon"]),
  propagation: documented(text),
  attributes: z.array(claimSchema),
  recommendedRegions: documented(z.array(text).min(1)),
  threatResponses: z.array(threatResponseSchema),
});
export type Cultivar = z.infer<typeof cultivarSchema>;

/** Tipo de material de siembra (colino, cormo, vitroplanta…). */
export const plantingMaterialSchema = z.object({ id, name: text, description: claimSchema });
export type PlantingMaterial = z.infer<typeof plantingMaterialSchema>;

/** Etapa del cultivo con un nombre comprensible y su equivalente técnico. */
export const growthStageSchema = z.object({ id, label: text, technicalName: text, description: claimSchema });
export type GrowthStage = z.infer<typeof growthStageSchema>;

/**
 * Medida documentada. No existe una categoría química a propósito: Heimdall no recomienda
 * pesticidas, dosis ni erradicación a partir de coordenadas o síntomas autodeclarados.
 */
export const managementMeasureSchema = z.object({
  id,
  kind: z.enum(["material-de-siembra", "monitoreo", "cultural", "bioseguridad", "precaucion", "consulta-oficial"]),
  action: text,
  /** Etapas donde aplica; vacío = cualquier etapa. */
  stageIds: z.array(id),
  condition: text,
  reason: text,
  /** Cómo comprobar que se hizo o quién confirma el resultado. */
  verification: text,
  sources: sourceRefs,
});
export type ManagementMeasure = z.infer<typeof managementMeasureSchema>;

export const threatAgentSchema = z.object({ scientificName: text, commonName: text });

export const threatProfileSchema = z.object({
  id,
  commonName: text,
  agents: z.array(threatAgentSchema).min(1),
  agentType: z.enum(["insecto", "hongo", "bacteria", "virus", "nematodo", "otro"]),
  /** Por qué sabemos que importa en Colombia. */
  colombianRelevance: claimSchema,
  /** Dónde la ubica la fuente; las alertas no se generalizan fuera de este ámbito. */
  geographicScope: claimSchema,
  symptoms: documented(z.array(text).min(1)),
  favoringConditions: documented(z.array(text).min(1)),
  regulation: documented(z.object({ authority: text, norm: text })),
  /** Si es true, la app nunca la presenta sin pedir confirmación oficial (ICA o extensionista). */
  requiresOfficialConfirmation: z.boolean(),
  measures: z.array(managementMeasureSchema),
});
export type ThreatProfile = z.infer<typeof threatProfileSchema>;

export const cropProfileSchema = z.object({
  /** Debe coincidir con un `id` de `data/crops.json`. */
  cropId: id,
  scientificName: claimSchema,
  commonNames: z.array(text).min(1),
  scope: text,
  cultivars: z.array(cultivarSchema).min(1),
  plantingMaterials: z.array(plantingMaterialSchema),
  growthStages: z.array(growthStageSchema).min(1),
  threats: z.array(threatProfileSchema),
});
export type CropProfile = z.infer<typeof cropProfileSchema>;

export const cropProfileCatalogSchema = z.object({
  schemaVersion: z.literal(CROP_PROFILE_SCHEMA_VERSION),
  /** Fecha de la última revisión de fuentes (AAAA-MM-DD). */
  reviewedAt: z.iso.date(),
  sources: z.array(profileSourceSchema).min(1),
  profiles: z.array(cropProfileSchema).min(1),
});
export type CropProfileCatalog = z.infer<typeof cropProfileCatalogSchema>;

/** Respuesta «No sé» en cualquier paso del flujo. */
export const UNKNOWN_ANSWER = "unknown";
/** Respuesta «Otra variedad» / «otro material». */
export const OTHER_ANSWER = "other";
/** «No he visto ningún problema». */
export const NO_PROBLEM_ANSWER = "none";

/**
 * Lo que el agricultor responde sobre su cultivo. Es una observación propia, nunca un diagnóstico:
 * `observedThreatId` significa «creo ver esto», y `symptomsNote` se muestra tal cual sin interpretarla.
 */
export const cropProfileSelectionSchema = z.object({
  cropId: id,
  cultivarId: id,
  otherCultivarName: z.string().trim().max(60).optional(),
  plantingMaterialId: id.optional(),
  stageId: id,
  observedThreatId: id.optional(),
  symptomsNote: z.string().trim().max(280).optional(),
});
export type CropProfileSelection = z.infer<typeof cropProfileSelectionSchema>;
