import type { ReactNode } from "react";

/** Íconos de línea (48×48) en el color del texto: `currentColor`. Sin emojis, se ven igual en cualquier celular. */
function Svg({ children, className = "h-14 w-14" }: { children: ReactNode; className?: string }) {
  return <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

const leaf = "M24 4 C31 11 31 20 24 28 C17 20 17 11 24 4 Z";

const CROP_ICONS: Record<string, ReactNode> = {
  maiz: <><ellipse cx="24" cy="20" rx="7" ry="14" /><path d="M24 7v26M18 14h12M17.5 20h13M18 26h12" strokeWidth="1.8" /><path d="M24 36C14 36 11 27 13 21M24 36c10 0 13-9 11-15M24 36v8" /></>,
  frijol: <><g transform="translate(18 17) rotate(-20)"><path d="M-11 0C-11-7-4-9.500 3-7.500 10-5.500 12-1 9 2 6 4.500 4 1 1 3.500-2 6-11 7-11 0Z" /><path d="M5-3c-1.500 1-2.500 2-3 3.500" strokeWidth="1.8" /></g><g transform="translate(30 31) rotate(15)"><path d="M-11 0C-11-7-4-9.500 3-7.500 10-5.500 12-1 9 2 6 4.500 4 1 1 3.500-2 6-11 7-11 0Z" /><path d="M5-3c-1.500 1-2.500 2-3 3.500" strokeWidth="1.8" /></g></>,
  soya: <><path d="M24 42V22" /><ellipse cx="15" cy="17" rx="8" ry="5.5" transform="rotate(-25 15 17)" /><ellipse cx="33" cy="17" rx="8" ry="5.5" transform="rotate(25 33 17)" /></>,
  arveja: <><path d="M4 20c6 22 34 22 40 0-10-5-30-5-40 0Z" /><circle cx="14" cy="27" r="4.2" /><circle cx="24" cy="30" r="4.2" /><circle cx="34" cy="27" r="4.2" /></>,
  mucuna: <><path d="M10 45C24 43 8 33 22 28 36 23 22 14 29 6" /><ellipse cx="12" cy="31" rx="6" ry="3.500" transform="rotate(-35 12 31)" /><ellipse cx="35" cy="24" rx="6" ry="3.500" transform="rotate(-25 35 24)" /><ellipse cx="38" cy="9" rx="6" ry="3.500" transform="rotate(25 38 9)" /><path d="M27 41c7-5 14-1 15 5-6 1-11-1-15-5Z" /><path d="M32 40v-3M37 40v-3M41 43l2-2" strokeWidth="1.6" /></>,
  crotalaria: <><path d="M24 46V8" /><path d="M24 8l-9 4M24 15l9 3M24 22l-9 4M24 29l9 3" strokeWidth="1.8" /><ellipse cx="12" cy="13.500" rx="4.500" ry="3" transform="rotate(-20 12 13.500)" /><ellipse cx="36" cy="19.500" rx="4.500" ry="3" transform="rotate(20 36 19.500)" /><ellipse cx="12" cy="27.500" rx="4.500" ry="3" transform="rotate(-20 12 27.500)" /><ellipse cx="36" cy="33.500" rx="4.500" ry="3" transform="rotate(20 36 33.500)" /><circle cx="24" cy="5" r="2.500" /><path d="M24 44c-4-2-8-6-9-11M24 44c4-2 8-6 9-11" /></>,
  yuca: <><path d="M43 6c4 7 0 18-9 27C25 41 15 45 5 43c0-11 7-21 16-29C29 7 38 2 43 6Z" /><ellipse cx="38" cy="11" rx="5" ry="7.500" transform="rotate(45 38 11)" strokeWidth="1.8" /><path d="M27 16c1 5 5 8 10 9M19 23c1 5 5 8 10 9M12 31c1 4 4 6 8 7" strokeWidth="1.8" /></>,
  papa: <><path d="M12 18C12 8 23 4 31 6c5 2 6 7 7 12 3 6 6 10 4 17-2 7-9 10-18 10C13 45 7 40 7 31c0-6 5-8 5-13Z" /><path d="M15 17c-3 7-3 15 0 22" strokeWidth="2" /><path d="M27 15h4M20 33h4" strokeWidth="2" /><path d="M26 24h.01M34 30h.01M28 40h.01" strokeWidth="3.400" /></>,
  avena: <><path d="M24 45V8" /><ellipse cx="17" cy="15" rx="3.6" ry="6.5" transform="rotate(-30 17 15)" /><ellipse cx="31" cy="15" rx="3.6" ry="6.5" transform="rotate(30 31 15)" /><ellipse cx="17" cy="26" rx="3.6" ry="6.5" transform="rotate(-30 17 26)" /><ellipse cx="31" cy="26" rx="3.6" ry="6.5" transform="rotate(30 31 26)" /><ellipse cx="24" cy="6" rx="3" ry="4.5" /></>,
  repollo: <><path d="M24.0 7.0 A 6.6 6.6 0 0 1 34.9 11.0 A 6.6 6.6 0 0 1 40.7 21.0 A 6.6 6.6 0 0 1 38.7 32.5 A 6.6 6.6 0 0 1 29.8 40.0 A 6.6 6.6 0 0 1 18.2 40.0 A 6.6 6.6 0 0 1 9.3 32.5 A 6.6 6.6 0 0 1 7.3 21.0 A 6.6 6.6 0 0 1 13.1 11.0 A 6.6 6.6 0 0 1 24.0 7.0 Z" /><path d="M24 42C24 32 24 22 24 12M24 42C19 34 15 27 14 19M24 42C29 34 33 27 34 19" strokeWidth="2" /></>,
  generic: <><path d="M24 44V22" /><path d="M24 26C14 26 8 20 8 11c10 0 16 5 16 15ZM24 22c0-9 6-14 16-14 0 9-6 14-16 14Z" /></>,
  none: <><circle cx="24" cy="24" r="16" /><path d="M13 35 35 13" /></>,
};

const GOAL_ICONS: Record<string, ReactNode> = {
  waterSaving: <path d="M24 5c8 9.5 14 16.5 14 24a14 14 0 0 1-28 0c0-7.500 6-14.500 14-24Z" />,
  extraIncome: <><ellipse cx="24" cy="14" rx="13" ry="5.5" /><path d="M11 14v8c0 3 6 5.500 13 5.500S37 25 37 22v-8M11 22v8c0 3 6 5.500 13 5.500S37 33 37 30v-8M11 30v6c0 3 6 5.500 13 5.500S37 39 37 36v-6" /></>,
  soilImprovement: <><path d="M24 30V16" /><path d="M24 20c0-6-5-8-9-7 0 5 3 8 9 7ZM24 17c0-6 5-8 9-7 0 5-3 8-9 7Z" /><path d="M6 34h36M10 40h28" /></>,
  erosionReduction: <><path d="M4 36 17 14l8 12 6-8 13 18Z" /><path d="M14 42h.01M24 42h.01M34 42h.01" strokeWidth="4" /></>,
  lowRisk: <><path d="M24 5 38 10v13c0 9-6 16-14 19C16 39 10 32 10 23V10Z" /><path d="m17 24 5 5 9-10" /></>,
};

/** Ícono de un cultivo por su id (`none` = no tengo cultivo). */
export function CropIcon({ id, className }: { id: string; className?: string }) {
  return <Svg className={className}>{CROP_ICONS[id] ?? CROP_ICONS.none}</Svg>;
}

/** Ícono de una prioridad por su clave (`waterSaving`, `extraIncome`, …). */
export function GoalIcon({ id, className }: { id: string; className?: string }) {
  return <Svg className={className}>{GOAL_ICONS[id]}</Svg>;
}

const UI_ICONS = {
  play: <path d="M14 8v32l26-16Z" fill="currentColor" />,
  stop: <rect x="11" y="11" width="26" height="26" rx="4" fill="currentColor" />,
  speaker: <><path d="M6 19h8l11-9v28l-11-9H6Z" fill="currentColor" /><path d="M32 17c3 4 3 10 0 14M37 12c6 7 6 17 0 24" /></>,
  star: <path d="M24 5l5.500 11.500 12.500 1.700-9.200 8.700 2.300 12.400L24 33l-11.100 6.300 2.300-12.400L6 18.200l12.500-1.700Z" fill="currentColor" />,
  leaf: <path d="M8 40C8 20 20 8 42 6c0 22-12 34-34 34ZM8 40 28 20" fill="currentColor" />,
  arrow: <path d="M6 24h32M28 14l10 10-10 10" />,
  back: <path d="M42 24H10M20 14 10 24l10 10" />,
  field: <><path d="M4 38 14 16h20l10 22Z" /><path d="M9 28h30M12 22h24" strokeWidth="1.800" /></>,
  sun: <><circle cx="24" cy="24" r="8" /><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M10 38l4-4M34 14l4-4" /></>,
  snow: <path d="M24 5v38M7.500 14.500l33 19M7.500 33.500l33-19M18 8l6 5 6-5M18 40l6-5 6 5" />,
  rain: <><path d="M14 30a9 9 0 0 1 1-18 11 11 0 0 1 21 3 7.500 7.500 0 0 1-1 15Z" /><path d="M16 36l-2 6M24 36l-2 6M32 36l-2 6" /></>,
  thermo: <><path d="M20 8a4 4 0 0 1 8 0v18a9 9 0 1 1-8 0Z" /><path d="M24 14v20" /><circle cx="24" cy="35" r="3" fill="currentColor" /></>,
  roots: <><path d="M24 4v16M24 12c-4-6-10-6-13-3M24 12c4-6 10-6 13-3" /><path d="M24 20v22M24 26c-6 2-9 8-9 16M24 26c6 2 9 8 9 16" /></>,
  drop: <path d="M24 5c8 9.500 14 16.500 14 24a14 14 0 0 1-28 0c0-7.500 6-14.500 14-24Z" />,
  dropFilled: <path d="M24 5c8 9.500 14 16.500 14 24a14 14 0 0 1-28 0c0-7.500 6-14.500 14-24Z" fill="currentColor" />,
  bulb: <><path d="M24 4a13 13 0 0 0-7 24v6h14v-6a13 13 0 0 0-7-24Z" /><path d="M18 40h12M21 45h6" /></>,
  search: <><circle cx="21" cy="21" r="13" /><path d="m31 31 12 12" /></>,
  check: <><circle cx="24" cy="24" r="19" /><path d="m14 25 7 7 14-15" /></>,
  warning: <><path d="M24 6 3 41h42Z" /><path d="M24 19v10M24 35h.01" strokeWidth="3.500" /></>,
  question: <><circle cx="24" cy="24" r="19" /><path d="M18 18c0-4 3-6 6-6s6 2 6 6c0 5-6 5-6 10M24 35h.01" strokeWidth="3" /></>,
  person: <><circle cx="24" cy="15" r="8" /><path d="M7 43c0-10 7-16 17-16s17 6 17 16" /></>,
  sliders: <><path d="M6 14h36M6 24h36M6 34h36" /><circle cx="16" cy="14" r="4" fill="currentColor" /><circle cx="32" cy="24" r="4" fill="currentColor" /><circle cx="20" cy="34" r="4" fill="currentColor" /></>,
  pin: <><path d="M24 44S9 29 9 19a15 15 0 0 1 30 0c0 10-15 25-15 25Z" /><circle cx="24" cy="19" r="5" /></>,
  calendar: <><rect x="6" y="9" width="36" height="33" rx="5" /><path d="M6 20h36M15 5v8M33 5v8" /></>,
} as const;

export type UiIconName = keyof typeof UI_ICONS;

/** Íconos de interfaz (reproducir, alertas, clima…) en el mismo estilo de línea que los cultivos. */
export function UiIcon({ name, className }: { name: UiIconName; className?: string }) {
  return <Svg className={className}>{UI_ICONS[name]}</Svg>;
}
