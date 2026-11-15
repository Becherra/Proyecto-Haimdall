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
  crotalaria: <><circle cx="24" cy="22" r="4" /><ellipse cx="24" cy="11" rx="4" ry="6" /><ellipse cx="24" cy="11" rx="4" ry="6" transform="rotate(72 24 22)" /><ellipse cx="24" cy="11" rx="4" ry="6" transform="rotate(144 24 22)" /><ellipse cx="24" cy="11" rx="4" ry="6" transform="rotate(216 24 22)" /><ellipse cx="24" cy="11" rx="4" ry="6" transform="rotate(288 24 22)" /><path d="M24 36v9" /></>,
  yuca: <><path d="M43 6c4 7 0 18-9 27C25 41 15 45 5 43c0-11 7-21 16-29C29 7 38 2 43 6Z" /><ellipse cx="38" cy="11" rx="5" ry="7.500" transform="rotate(45 38 11)" strokeWidth="1.8" /><path d="M27 16c1 5 5 8 10 9M19 23c1 5 5 8 10 9M12 31c1 4 4 6 8 7" strokeWidth="1.8" /></>,
  papa: <><path d="M9 27C5 22 8 15 14 13c2-4 9-4 12-2 6-3 14 1 14 8 4 4 2 12-4 15-4 5-14 6-19 3-5 0-7-5-8-10Z" /><path d="M16 20q2.500-2.500 5 0M27 18q2.500-2.500 5 0M30 29q2.500-2.500 5 0M18 31q2.500-2.500 5 0" strokeWidth="2" /></>,
  avena: <><path d="M24 45V8" /><ellipse cx="17" cy="15" rx="3.6" ry="6.5" transform="rotate(-30 17 15)" /><ellipse cx="31" cy="15" rx="3.6" ry="6.5" transform="rotate(30 31 15)" /><ellipse cx="17" cy="26" rx="3.6" ry="6.5" transform="rotate(-30 17 26)" /><ellipse cx="31" cy="26" rx="3.6" ry="6.5" transform="rotate(30 31 26)" /><ellipse cx="24" cy="6" rx="3" ry="4.5" /></>,
  repollo: <><path d="M24 7C13 7 7 16 7 26c0 9 7 16 17 16s17-7 17-16C41 16 35 7 24 7Z" /><path d="M24 7c-5 9-5 24 0 35M11 15c7 3 10 11 8 21M37 15c-7 3-10 11-8 21" strokeWidth="2" /></>,
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
