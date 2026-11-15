import type { Crop, Rotation, RotationResult } from "../types";
import { HIGH_ATTRIBUTE_THRESHOLD, LOW_ATTRIBUTE_THRESHOLD, NITROGEN_FIXER_THRESHOLD } from "./config";

/** Rotaciones posibles por cada estrategia alternativa; el análisis las puntúa y se queda con la mejor de cada lista. */
export type RotationCandidates = { legume: Rotation[]; coverDrought: Rotation[] };

/** Nombre común sin el nombre científico: "Maíz (Zea mays)" → "Maíz". */
export function commonName(crop: Crop): string {
  return crop.name.split(" (")[0];
}

/** Cultivo permanente (café, plátano): no se rota ni se sugiere; solo puede ser el cultivo actual del agricultor. */
const isPermanent = (crop: Crop) => crop.perennial === true;
/** El anual declara (con fuente) que se puede asociar en las calles de ese permanente. */
const intercropsWith = (crop: Crop, permanent: Crop) => crop.intercropsWith?.includes(permanent.id) === true;

const sameFamily = (a: Crop, b: Crop) => a.family !== undefined && a.family === b.family;
const fixesNitrogen = (crop: Crop) => crop.nitrogenFixation >= NITROGEN_FIXER_THRESHOLD;
/** Tiene mercado propio: deja fuera los abonos verdes, que van en la alternativa de cobertura. */
const hasMarket = (crop: Crop) => crop.marketPotential >= LOW_ATTRIBUTE_THRESHOLD;
const isCover = (crop: Crop) => crop.erosionReduction >= HIGH_ATTRIBUTE_THRESHOLD;
const isDroughtTolerant = (crop: Crop) => crop.droughtTolerance >= HIGH_ATTRIBUTE_THRESHOLD;

function sequence(id: string, crops: readonly Crop[], description: string): Rotation {
  return { id, name: crops.map(commonName).join(" → "), cropIds: crops.map((crop) => crop.id), description };
}

/** Un permanente con un anual en sus calles: se lee "café + fríjol" y no "café → fríjol" porque no es una rotación. */
function intercropSequence(id: string, permanent: Crop, partner: Crop, description: string): Rotation {
  return { id, name: `${commonName(permanent)} + ${commonName(partner)}`, cropIds: [permanent.id, partner.id], description };
}

const YOUNG_STAGE = "mientras el cultivo es joven (establecimiento o renovación)";

/** Línea base: el cultivo actual del agricultor repetido, sin rotación. */
export function baselineRotation(current: Crop): Rotation {
  return { id: "baseline", name: `Actual: ${current.name}`, cropIds: [current.id], description: "Mantiene la práctica declarada como línea base de comparación." };
}

/**
 * Parejas para el cultivo actual que combinan un cultivo que fija nitrógeno con uno que no:
 * si el actual no fija, se le suma una leguminosa de grano; si ya fija, un cultivo de otra familia que aproveche ese nitrógeno.
 */
function legumeCandidates(crops: readonly Crop[], current: Crop): Rotation[] {
  if (isPermanent(current)) {
    return crops
      .filter((crop) => !isPermanent(crop) && fixesNitrogen(crop) && intercropsWith(crop, current))
      .map((partner) => intercropSequence("legume", current, partner, `Intercala ${commonName(partner)}, una leguminosa que fija nitrógeno, en las calles de ${commonName(current)} ${YOUNG_STAGE}, para aportar al suelo y tener una cosecha mientras tanto.`));
  }
  const currentFixes = fixesNitrogen(current);
  return crops
    .filter((crop) => !isPermanent(crop) && crop.id !== current.id && hasMarket(crop) && fixesNitrogen(crop) !== currentFixes && !sameFamily(crop, current))
    .map((partner) => sequence("legume", [current, partner], currentFixes
      ? `Alterna ${commonName(current)}, que fija nitrógeno, con ${commonName(partner)} para aprovechar ese nitrógeno y diversificar ingresos.`
      : `Intercala ${commonName(partner)}, una leguminosa que fija nitrógeno, con ${commonName(current)} para aportar al suelo y diversificar ingresos.`));
}

/** Cultivo actual + una cobertura del suelo + un cultivo tolerante a sequía, los tres distintos (CONTEXT.md §8). */
function coverDroughtCandidates(crops: readonly Crop[], current: Crop): Rotation[] {
  if (isPermanent(current)) {
    return crops
      .filter((crop) => !isPermanent(crop) && !fixesNitrogen(crop) && intercropsWith(crop, current))
      .map((partner) => intercropSequence("cover-drought", current, partner, `Asocia ${commonName(partner)} en las calles de ${commonName(current)} ${YOUNG_STAGE}, para diversificar ingresos sin dejar el suelo desnudo.`));
  }
  const others = crops.filter((crop) => crop.id !== current.id && !isPermanent(crop));
  return others.filter(isCover).flatMap((cover) => others.filter((crop) => isDroughtTolerant(crop) && crop.id !== cover.id)
    .map((tolerant) => sequence("cover-drought", [current, cover, tolerant], `Mantiene ${commonName(current)}, agrega ${commonName(cover)} como cobertura del suelo y ${commonName(tolerant)} como cultivo resistente a la sequía.`)));
}

/**
 * Arma las rotaciones candidatas alrededor del cultivo actual para las dos estrategias alternativas.
 * No elige: devuelve todas las combinaciones válidas del catálogo para que el motor de puntuación decida según el sitio y las prioridades.
 * Una lista vacía significa que el catálogo no alcanza para esa estrategia.
 */
export function candidateRotations(crops: readonly Crop[], current: Crop): RotationCandidates {
  return { legume: legumeCandidates(crops, current), coverDrought: coverDroughtCandidates(crops, current) };
}

/** Un solo cultivo, sin rotación: punto de partida para quien hoy no tiene cultivo. */
function singleCropRotation(crop: Crop): Rotation {
  return { id: "single", name: commonName(crop), cropIds: [crop.id], description: "Sembrar un solo cultivo, sin rotación." };
}

/** Opciones para quien no tiene cultivo actual: un solo cultivo, o las dos estrategias alternativas armadas a partir de cualquier cultivo del catálogo. */
export type StartingRotations = RotationCandidates & { single: Rotation[] };

/**
 * Arma los candidatos cuando no hay cultivo actual: todos los cultivos solos y todas las parejas/tríos válidos
 * (cada cultivo del catálogo hace de punto de partida). El motor de puntuación elige la mejor de cada lista.
 */
export function startingRotations(allCrops: readonly Crop[]): StartingRotations {
  // Recomendar un cultivo permanente a quien hoy no tiene nada es una inversión de años: solo se ofrecen cultivos anuales.
  const crops = allCrops.filter((crop) => !isPermanent(crop));
  const fromEach = crops.map((crop) => candidateRotations(crops, crop));
  const neutral = (rotations: Rotation[]) => rotations.map((rotation) => ({ ...rotation, description: rotation.description.replace(/^Mantiene /, "Empieza con ") }));
  return { single: crops.map(singleCropRotation), legume: fromEach.flatMap((candidates) => candidates.legume), coverDrought: neutral(fromEach.flatMap((candidates) => candidates.coverDrought)) };
}

/**
 * Fracción (0–1) de relevos de la secuencia que cambian de familia botánica, contando la vuelta del último cultivo al primero.
 * Un monocultivo da 0; una rotación que nunca repite familia en relevos seguidos da 1.
 * Devuelve null si la secuencia está vacía o algún cultivo no trae familia: sin ese dato no se puede evaluar.
 */
export function familyBreakShare(crops: readonly Crop[]): number | null {
  if (crops.length === 0 || crops.some((crop) => crop.family === undefined)) return null;
  const changes = crops.filter((crop, index) => crop.family !== crops[(index + 1) % crops.length].family).length;
  return changes / crops.length;
}

/** El resultado de mayor puntaje; en empate, el primero. Lanza un Error si no hay candidatos. */
export function pickBest(results: readonly RotationResult[]): RotationResult {
  if (results.length === 0) throw new Error("No hay rotaciones candidatas para elegir");
  return results.reduce((best, result) => (result.score > best.score ? result : best));
}
