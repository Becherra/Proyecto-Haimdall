import type { Farm } from "../types";
import { validateTerrain } from "./geo";

export type AnalysisSite =
  | { valid: true; location: { lat: number; lon: number }; informationGaps: string[]; areaHa?: number }
  | { valid: false; errors: string[] };

const REGIONAL_CLIMATE_NOTE = "el clima de NASA POWER es regional y conocer el lote no aumenta su resolución";

/** Qué se sabe y qué no del lote según cómo lo describió el agricultor (docs/farm-contract.md). */
function terrainGap(terrain: Farm["terrain"], calculatedAreaHa: number | undefined): string {
  if (terrain.kind === "point") return "Solo se conoce un punto de la finca: no se conocen los límites ni el tamaño del lote.";
  if (terrain.kind === "approx_size") {
    return `El tamaño del lote (~${Number(terrain.areaHa.toFixed(2))} ha) es una estimación del agricultor, no una medición, y no se conocen sus límites reales.`;
  }
  return `Lote dibujado de ${(calculatedAreaHa ?? terrain.areaHa).toFixed(2)} ha (área recalculada desde el polígono); ${REGIONAL_CLIMATE_NOTE}.`;
}

/**
 * Decide dónde se analiza y qué vacíos de información deja la descripción del lote.
 * Con `farm` valida de nuevo su geometría (el área del polígono se recalcula, no se confía en la enviada) y usa `farm.centroid`;
 * sin `farm` usa `lat`/`lon`, que se mantienen para clientes anteriores. Es pura: no consulta red ni archivos.
 */
export function resolveAnalysisSite({ lat, lon, farm }: { lat: number; lon: number; farm?: Farm }): AnalysisSite {
  if (!farm) return { valid: true, location: { lat, lon }, informationGaps: [] };
  const terrain = validateTerrain(farm.terrain);
  if (!terrain.valid) return { valid: false, errors: terrain.errors };
  const informationGaps = [terrainGap(farm.terrain, terrain.calculatedAreaHa), ...terrain.warnings];
  if (farm.accuracyM !== undefined) informationGaps.push(`La ubicación viene del GPS del dispositivo, con una precisión declarada de ±${Math.round(farm.accuracyM)} m.`);
  const areaHa = farm.terrain.kind === "polygon" ? terrain.calculatedAreaHa : undefined;
  return { valid: true, location: { ...farm.centroid }, informationGaps, ...(areaHa === undefined ? {} : { areaHa }) };
}
