type LogoProps = {
  /** "mark" = solo el ícono; "horizontal" = ícono + nombre. */
  variant?: "mark" | "horizontal";
  /** "color" para fondos verdes oscuros; "dark" para fondos claros. */
  tone?: "color" | "dark";
  className?: string;
};

const TONES = {
  color: { eye: "#EAD39D", accent: "#B5C266", text: "#EAD39D" },
  dark: { eye: "#0D3C16", accent: "#0D3C16", text: "#0D3C16" },
} as const;

/** Marca de Heimdall: un ojo vigía con un brote en el iris y una órbita satelital. Fondo transparente. */
export default function Logo({ variant = "mark", tone = "color", className = "h-10 w-auto" }: LogoProps) {
  const { eye, accent, text } = TONES[tone];
  const mark = <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 36 C14 20 50 20 60 36 C50 52 14 52 4 36 Z" stroke={eye} strokeWidth="3.2" />
    <circle cx="32" cy="36" r="10.5" stroke={eye} strokeWidth="2.6" />
    <path d="M32 42 V33" stroke={accent} strokeWidth="2.6" />
    <path d="M32 35 C32 29.5 27 28.5 25 29.5 C25 33.5 28 35.5 32 35 Z" fill={accent} stroke="none" />
    <path d="M32 33 C32 27.5 37 26.5 39 27.5 C39 31.5 36 33.5 32 33 Z" fill={accent} stroke="none" />
    <path d="M12 17 A 28 28 0 0 1 46 9" stroke={accent} strokeWidth="2.2" strokeDasharray="1 4.5" />
    <circle cx="50" cy="10" r="3.4" fill={eye} stroke="none" />
  </g>;
  if (variant === "mark") return <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Heimdall">{mark}</svg>;
  return <svg viewBox="0 0 280 64" className={className} role="img" aria-label="Heimdall">
    {mark}
    <text x="76" y="43" fontFamily="var(--font-inter), system-ui, sans-serif" fontSize="30" fontWeight="700" letterSpacing="3" fill={text}>HEIMDALL</text>
  </svg>;
}
