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
  papa: <><path d="M6 29c-3-6 2-11 9-11 7 0 13 4 11 11-1 6-8 8-14 7-4-1-5-3-6-7Z" /><path d="M24 36c-1-7 5-12 12-11 7 1 11 7 9 13-2 5-9 6-15 5-4-1-6-3-6-7Z" /><path d="M16 12c-2-4 2-7 8-7s10 3 8 8c-2 4-9 5-13 3-1-1-3-2-3-4Z" /><path d="M12 27h.01M36 33h.01M26 11h.01" strokeWidth="3.600" /></>,
  avena: <><path d="M24 45V8" /><ellipse cx="17" cy="15" rx="3.6" ry="6.5" transform="rotate(-30 17 15)" /><ellipse cx="31" cy="15" rx="3.6" ry="6.5" transform="rotate(30 31 15)" /><ellipse cx="17" cy="26" rx="3.6" ry="6.5" transform="rotate(-30 17 26)" /><ellipse cx="31" cy="26" rx="3.6" ry="6.5" transform="rotate(30 31 26)" /><ellipse cx="24" cy="6" rx="3" ry="4.5" /></>,
  repollo: <><path d="M24.0 7.0 A 6.6 6.6 0 0 1 34.9 11.0 A 6.6 6.6 0 0 1 40.7 21.0 A 6.6 6.6 0 0 1 38.7 32.5 A 6.6 6.6 0 0 1 29.8 40.0 A 6.6 6.6 0 0 1 18.2 40.0 A 6.6 6.6 0 0 1 9.3 32.5 A 6.6 6.6 0 0 1 7.3 21.0 A 6.6 6.6 0 0 1 13.1 11.0 A 6.6 6.6 0 0 1 24.0 7.0 Z" /><path d="M24 42C24 32 24 22 24 12M24 42C19 34 15 27 14 19M24 42C29 34 33 27 34 19" strokeWidth="2" /></>,
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
