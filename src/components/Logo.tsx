import Image from "next/image";

type LogoProps = {
  /** "mark" = solo el ícono; "horizontal" = ícono + nombre. */
  variant?: "mark" | "horizontal";
  /** "cream" para fondos verdes oscuros; "dark" para fondos claros. */
  tone?: "cream" | "dark";
  /** Alto en píxeles del ícono. */
  size?: number;
  className?: string;
};

// El PNG tiene proporción 576:681 (ancho:alto) tras recortar el fondo.
const RATIO = 576 / 681;

/** Logo de Heimdall con fondo transparente. Fuente: `public/brand/heimdall-logo-*.png`. */
export default function Logo({ variant = "mark", tone = "cream", size = 40, className = "" }: LogoProps) {
  const icon = <Image src={`/brand/heimdall-logo-${tone}-128.png`} alt={variant === "mark" ? "Heimdall" : ""} width={Math.round(size * RATIO)} height={size} priority unoptimized />;
  if (variant === "mark") return <span className={`inline-flex ${className}`}>{icon}</span>;
  return <span className={`inline-flex items-center gap-2.5 ${className}`}>
    {icon}
    <span className={`font-bold uppercase tracking-[0.18em] ${tone === "cream" ? "text-cream" : "text-meadow"}`} style={{ fontSize: size * 0.5 }}>Heimdall</span>
  </span>;
}
