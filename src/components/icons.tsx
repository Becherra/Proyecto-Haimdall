import type { ReactNode } from "react";

/** Íconos de línea (48×48) en el color del texto: `currentColor`. Sin emojis, se ven igual en cualquier celular. */
function Svg({ children, className = "h-14 w-14" }: { children: ReactNode; className?: string }) {
  return <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

const leaf = "M24 4 C31 11 31 20 24 28 C17 20 17 11 24 4 Z";

const CROP_ICONS: Record<string, ReactNode> = {
  maiz: <><ellipse cx="24" cy="20" rx="7" ry="14" /><path d="M24 7v26M18 14h12M17.5 20h13M18 26h12" strokeWidth="1.8" /><path d="M24 36C14 36 11 27 13 21M24 36c10 0 13-9 11-15M24 36v8" /></>,
  frijol: <><path d="M13 30C7 22 15 9 28 9c10 0 12 11 6 17-4 4-6 12-14 12-4 0-6-4-7-8Z" /><path d="M19 25c2-4 6-5 9-4" strokeWidth="1.8" /></>,
  soya: <><path d="M24 42V22" /><ellipse cx="15" cy="17" rx="8" ry="5.5" transform="rotate(-25 15 17)" /><ellipse cx="33" cy="17" rx="8" ry="5.5" transform="rotate(25 33 17)" /></>,
  arveja: <><path d="M4 20c6 22 34 22 40 0-10-5-30-5-40 0Z" /><circle cx="14" cy="27" r="4.2" /><circle cx="24" cy="30" r="4.2" /><circle cx="34" cy="27" r="4.2" /></>,
  mucuna: <><path d="M24 44V28" /><path d={leaf} transform="translate(0 -1)" /><path d={leaf} transform="rotate(-60 24 30) translate(0 4)" /><path d={leaf} transform="rotate(60 24 30) translate(0 4)" /></>,
  crotalaria: <><circle cx="24" cy="22" r="4" /><ellipse cx="24" cy="11" rx="4" ry="6" /><ellipse cx="24" cy="11" rx="4" ry="6" transform="rotate(72 24 22)" /><ellipse cx="24" cy="11" rx="4" ry="6" transform="rotate(144 24 22)" /><ellipse cx="24" cy="11" rx="4" ry="6" transform="rotate(216 24 22)" /><ellipse cx="24" cy="11" rx="4" ry="6" transform="rotate(288 24 22)" /><path d="M24 36v9" /></>,
  yuca: <><path d="M9 37c-2-7 5-16 18-20 7-2 12-5 14-10 1 13-7 27-19 31-6 2-11 1-13-1Z" /><path d="M17 33c4-5 9-8 15-11" strokeWidth="1.8" /></>,
  papa: <><path d="M9 26C7 15 19 9 30 11c10 2 13 14 7 23-6 9-24 8-28-8Z" /><path d="M18 22h.01M27 17h.01M30 28h.01M20 31h.01" strokeWidth="4" /></>,
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
