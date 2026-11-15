/** Estado de instalación que la interfaz necesita para decidir qué mostrar. */
export type InstallMode = "installed" | "prompt" | "ios-manual" | "unavailable";

type InstallInputs = {
  /** `true` si la app ya corre como instalada (standalone). */
  isStandalone: boolean;
  /** `true` si el navegador ya entregó el evento `beforeinstallprompt`. */
  hasPromptEvent: boolean;
  userAgent: string;
  /** `navigator.maxTouchPoints`; los iPad nuevos se identifican como Mac y solo se distinguen por el táctil. */
  maxTouchPoints?: number;
};

/** Safari en iPhone/iPad no tiene `beforeinstallprompt`: se instala a mano desde Compartir. */
export function isIosDevice(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/** Los navegadores que no son Safari en iOS (Chrome, Firefox, Edge) tampoco ofrecen "Añadir a inicio" en el mismo menú. */
function isIosSafari(userAgent: string): boolean {
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
}

/** Decide si se muestra el botón de instalar, la guía manual de iOS o nada. */
export function getInstallMode({ isStandalone, hasPromptEvent, userAgent, maxTouchPoints }: InstallInputs): InstallMode {
  if (isStandalone) return "installed";
  if (hasPromptEvent) return "prompt";
  if (isIosDevice(userAgent, maxTouchPoints) && isIosSafari(userAgent)) return "ios-manual";
  return "unavailable";
}
