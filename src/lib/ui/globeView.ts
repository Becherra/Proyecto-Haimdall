export type GlobeView = { altitude: number; transitionMs: number };

/** Calcula una aproximación legible sin acercarse tanto que pierda nitidez. */
export function calculateGlobeView(hasLocation: boolean, viewportWidth: number, reducedMotion = false): GlobeView {
  if (!hasLocation) return { altitude: 1.5, transitionMs: 0 };
  return { altitude: viewportWidth < 640 ? 0.6 : 0.5, transitionMs: reducedMotion ? 0 : 2000 };
}

/**
 * El globo es también el mapa: lejos se ve con el relieve NASA; al acercarse cambia a mosaicos satelitales y se puede bajar
 * hasta ver una casa. Altitudes en radios del globo sobre la superficie (1 = 6371 km).
 * - `minAltitude` ≈ 250 m: muestra el nivel 18 de los mosaicos; el 19 no existe en muchas zonas rurales (sale "Map data not yet available").
 * - `satelliteBelow`/`reliefAbove`: dos umbrales distintos para que la vista no parpadee entre modos al rozar el límite.
 * - `markBelow` ≈ 16 km: ya se distinguen fincas y caminos, así que tiene sentido marcar el terreno.
 * - `tapZoomFactor`: tocar el globo acerca la cámara a esa fracción de su altura actual.
 */
export const GLOBE_ZOOM_LIMITS = { minAltitude: 0.00004, maxAltitude: 3, satelliteBelow: 0.3, reliefAbove: 0.4, markBelow: 0.0025, tapZoomFactor: 0.25 } as const;
/** Medio ángulo vertical de la cámara de globe.gl (fov de 50°). */
const HALF_FOV_RAD = (25 * Math.PI) / 180;

export type GlobeSurface = "relief" | "satellite";

/** Decide si el globo se dibuja con relieve o con imagen satelital según la altitud, con histéresis. */
export function nextGlobeSurface(current: GlobeSurface, altitude: number): GlobeSurface {
  if (current === "relief") return altitude < GLOBE_ZOOM_LIMITS.satelliteBelow ? "satellite" : "relief";
  return altitude > GLOBE_ZOOM_LIMITS.reliefAbove ? "relief" : "satellite";
}

/** Si ya se está lo bastante cerca como para marcar la finca. */
export function canMarkFarmAt(altitude: number): boolean {
  return altitude <= GLOBE_ZOOM_LIMITS.markBelow;
}

/**
 * Velocidad de zoom de OrbitControls. La rueda escala la distancia al CENTRO del globo, así que cerca del suelo un
 * paso fijo saltaría kilómetros de una vez: se limita para que cada paso cambie la altitud ~15 %.
 */
export function globeZoomSpeed(altitude: number): number {
  const safe = Math.max(altitude, GLOBE_ZOOM_LIMITS.minAltitude);
  return Math.min(Math.sqrt(safe) * 0.5, 2.9 * safe);
}

/**
 * Velocidad de giro de OrbitControls. Cerca del suelo (≈0,15 × altitud) el terreno sigue al dedo 1:1, como un mapa;
 * lejos se conserva la de globe.gl (0,3 × altitud). Las dos rectas se cruzan en 0,3, así que no hay salto.
 */
export function globeRotateSpeed(altitude: number): number {
  const safe = Math.max(altitude, GLOBE_ZOOM_LIMITS.minAltitude);
  return Math.max(0.15 * safe, 0.3 * safe - 0.045);
}

/**
 * Plano cercano de la cámara (en unidades de la escena) proporcional a la altitud: con el valor fijo de globe.gl (0,05)
 * no se podría bajar de ~3,5 km sin que el suelo se recorte.
 */
export function cameraNearPlane(altitude: number, globeRadius: number): number {
  return Math.min(0.05, Math.max(0.0001, altitude * globeRadius * 0.2));
}

/** Altitud a la que vuela la cámara tras tocar el globo: más cerca, sin pasar del mínimo. */
export function tapZoomAltitude(altitude: number): number {
  return Math.max(GLOBE_ZOOM_LIMITS.minAltitude, altitude * GLOBE_ZOOM_LIMITS.tapZoomFactor);
}

/** Medio alto (en grados de latitud) de lo que se ve desde esa altitud, para abrir el editor con la misma vista. */
export function visibleHalfSpanDegrees(altitude: number): number {
  return (Math.max(0, altitude) * Math.tan(HALF_FOV_RAD) * 180) / Math.PI;
}

/**
 * Grados por segmento de la malla del globo: el relieve solo se ve si hay vértices que levantar. En celular se usan
 * menos (~65 000 vértices frente a ~260 000) para que gire fluido.
 */
export function globeCurvatureResolution(isSmallScreen: boolean): number {
  return isSmallScreen ? 1 : 0.5;
}
