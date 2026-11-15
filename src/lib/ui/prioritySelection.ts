import type { UserPriorities } from "../../types";

export const PRIORITY_KEYS = ["waterSaving", "extraIncome", "soilImprovement", "erosionReduction", "lowRisk"] as const;
export type PriorityKey = (typeof PRIORITY_KEYS)[number];

/** Peso (0–5) que recibe lo que el agricultor toca como importante. */
export const SELECTED_WEIGHT = 5;
/** Peso de lo que no toca: sigue contando un poco, nunca se anula. */
export const UNSELECTED_WEIGHT = 1;
/** Peso neutro cuando no elige nada (equivale a «todo igual de importante»). */
export const NEUTRAL_WEIGHT = 3;
/** Desde este peso una prioridad cuenta como «seleccionada» al editar un análisis previo. */
export const SELECTION_THRESHOLD = 4;

/** Prioridades que ya pesan mucho; sirve para marcar las tarjetas al volver a editar. */
export function selectionFromPriorities(priorities: Pick<UserPriorities, PriorityKey>): PriorityKey[] {
  return PRIORITY_KEYS.filter((key) => priorities[key] >= SELECTION_THRESHOLD);
}

/**
 * Convierte «lo que más me importa» (toques) en los pesos 0–5 del motor de puntuación.
 * Sin ninguna selección todos pesan igual. Conserva el resto de datos (cultivo, agua, altitud, pendiente).
 */
export function applySelection(base: UserPriorities, selected: readonly PriorityKey[]): UserPriorities {
  const weights = Object.fromEntries(PRIORITY_KEYS.map((key) => [key, selected.length === 0 ? NEUTRAL_WEIGHT : selected.includes(key) ? SELECTED_WEIGHT : UNSELECTED_WEIGHT])) as Record<PriorityKey, number>;
  return { ...base, ...weights };
}
