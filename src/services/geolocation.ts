export type GeolocationProvider = Pick<Geolocation, "getCurrentPosition">;

export type GeolocationFailure = "permission-denied" | "unavailable" | "timeout" | "unsupported";

export class GeolocationError extends Error {
  constructor(public readonly reason: GeolocationFailure, message: string) {
    super(message);
  }
}

/** Solicita la ubicación solo cuando la UI la invoca, con precisión y timeout acotados. */
export function requestCurrentLocation(provider?: GeolocationProvider): Promise<GeolocationCoordinates> {
  if (provider === undefined && (typeof navigator === "undefined" || !navigator.geolocation)) return Promise.reject(new GeolocationError("unsupported", "Este navegador no permite obtener la ubicación."));
  const geolocation = provider ?? navigator.geolocation;
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) => resolve(coords),
      (error) => reject(new GeolocationError(mapGeolocationCode(error.code), "No fue posible obtener la ubicación.")),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

function mapGeolocationCode(code: number): GeolocationFailure {
  if (code === 1) return "permission-denied";
  if (code === 2) return "unavailable";
  return "timeout";
}

export function geolocationErrorMessage(error: unknown): string {
  const reason = error instanceof GeolocationError ? error.reason : "unavailable";
  if (reason === "permission-denied") return "Permiso denegado. Activa la ubicación en la configuración del navegador o del sitio y vuelve a intentarlo. También puedes buscar por nombre.";
  if (reason === "timeout") return "La ubicación tardó demasiado. Inténtalo de nuevo o busca por nombre.";
  return "No fue posible obtener tu ubicación. También puedes buscar por nombre.";
}
