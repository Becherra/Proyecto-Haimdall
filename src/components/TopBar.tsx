import Link from "next/link";
import Logo from "./Logo";

export default function TopBar() {
  return <header className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center justify-between px-5 sm:px-10 lg:h-[88px] lg:px-12" aria-label="Navegación principal">
    <Link href="/" aria-label="Heimdall, inicio" className="flex items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream">
      <Logo variant="horizontal" size={44} />
    </Link>
    <p className="hidden text-[11px] uppercase tracking-[0.18em] text-ash-gray sm:block">Cultivos · clima · evidencia</p>
  </header>;
}
