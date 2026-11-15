/** Mueve la opción resaltada de la lista con las flechas; -1 significa "ninguna" (se queda el texto escrito). */
export function moveHighlight(current: number, count: number, key: "ArrowDown" | "ArrowUp"): number {
  if (count <= 0) return -1;
  if (key === "ArrowDown") return current >= count - 1 ? 0 : current + 1;
  return current <= 0 ? count - 1 : current - 1;
}
