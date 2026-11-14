export type GeolocationProvider = Pick<Geolocation, "getCurrentPosition">;
export type GeolocationFailure = "permission-denied" | "unavailable" | "timeout" | "unsupported" | "cancelled";

export function isGeolocationFailure(value: unknown): value is GeolocationFailure {
  return value === "permission-denied" || value === "unavailable" || value === "timeout" || value === "unsupported" || value === "cancelled";
}

export type GeolocationOptions = Pick<PositionOptions, "enableHighAccuracy" | "timeout" | "maximumAge">;

export class GeolocationError extends Error {
  constructor(public readonly reason: GeolocationFailure, public readonly code?: number) {
    super(geolocationErrorMessage(reason));
    this.name = "GeolocationError";
  }
}

const INITIAL_OPTIONS: GeolocationOptions = { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 };
const RETRY_OPTIONS: GeolocationOptions = { enableHighAccuracy: true, timeout: 20_000, maximumAge: 300_000 };

/** Devuelve las dos opciones de solicitud en orden, para resolver primero rápido y luego preciso. */
export function getGeolocationAttempts(): readonly [GeolocationOptions, GeolocationOptions] {
  return [INITIAL_OPTIONS, RETRY_OPTIONS];
}

/** Solicita ubicación con una primera lectura rápida y reintento preciso ante timeout o indisponibilidad. */
export async function requestCurrentLocation(provider?: GeolocationProvider, signal?: AbortSignal): Promise<GeolocationCoordinates> {
  const geolocation = provider ?? (typeof navigator !== "undefined" ? navigator.geolocation : undefined);
  if (!geolocation) throw new GeolocationError("unsupported");
  const attempts = getGeolocationAttempts();
  for (const [index, options] of attempts.entries()) {
    if (signal?.aborted) throw new GeolocationError("cancelled");
    try {
      return await getPosition(geolocation, options, signal);
    } catch (error) {
      const failure = error instanceof GeolocationError ? error : new GeolocationError("unavailable");
      if (import.meta.env?.DEV) console.info("Geolocalización fallida", { code: failure.code, attempt: index + 1 });
      const canRetry = index === 0 && (failure.reason === "timeout" || failure.reason === "unavailable");
      if (!canRetry) throw failure;
    }
  }
  throw new GeolocationError("unavailable");
}

function getPosition(provider: GeolocationProvider, options: GeolocationOptions, signal?: AbortSignal): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(new GeolocationError("cancelled")));
    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
    provider.getCurrentPosition(
      ({ coords }) => finish(() => resolve(coords)),
      (error) => finish(() => reject(new GeolocationError(reasonFromCode(error.code), error.code))),
      options,
    );
  });
}

function reasonFromCode(code: number): GeolocationFailure {
  if (code === 1) return "permission-denied";
  if (code === 2) return "unavailable";
  if (code === 3) return "timeout";
  return "unavailable";
}

export function geolocationErrorMessage(reason: GeolocationFailure): string {
  if (reason === "permission-denied") return "Permiso denegado. Activa la ubicación en la configuración del navegador o del sitio; también puedes buscar por nombre.";
  if (reason === "timeout") return "La ubicación tardó demasiado incluso después de reintentar; también puedes buscar por nombre.";
  if (reason === "unavailable") return "El dispositivo no pudo determinar tu ubicación; revisa la señal o busca por nombre.";
  if (reason === "unsupported") return "Este navegador no permite obtener ubicación; puedes buscar por nombre.";
  return "Solicitud de ubicación cancelada; puedes buscar por nombre.";
}
