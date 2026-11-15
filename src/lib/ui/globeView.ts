export type GlobeView = { altitude: number; transitionMs: number };

/** Calcula una aproximación legible sin acercarse tanto que pierda nitidez. */
export function calculateGlobeView(hasLocation: boolean, viewportWidth: number, reducedMotion = false): GlobeView {
  if (!hasLocation) return { altitude: 1.5, transitionMs: 0 };
  return { altitude: viewportWidth < 640 ? 0.6 : 0.5, transitionMs: reducedMotion ? 0 : 2000 };
}
