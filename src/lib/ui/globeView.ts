import { GLOBE_RELIEF } from "../config";

export type GlobeView = { altitude: number; transitionMs: number };

/** Calcula una aproximación legible sin acercarse tanto que pierda nitidez. */
export function calculateGlobeView(hasLocation: boolean, viewportWidth: number, reducedMotion = false): GlobeView {
  if (!hasLocation) return { altitude: 1.5, transitionMs: 0 };
  return { altitude: viewportWidth < 640 ? 0.6 : 0.5, transitionMs: reducedMotion ? 0 : 2000 };
}

/**
 * Grados por segmento de la malla del globo: el relieve solo se ve si hay vértices que levantar. En celular se usan
 * menos (~65 000 vértices frente a ~260 000) para que gire fluido.
 */
export function globeCurvatureResolution(isSmallScreen: boolean): number {
  return isSmallScreen ? 1 : 0.5;
}

/**
 * Escala de la capa de nombres y límites respecto al radio del globo: queda por encima de la montaña más alta del relieve
 * (más una pequeña holgura) para que el relieve no la tape.
 */
export function referenceLayerScale(): number {
  return 1 + GLOBE_RELIEF.maxHeightRatio + 0.001;
}
