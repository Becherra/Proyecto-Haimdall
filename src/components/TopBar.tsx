import Link from "next/link";

export default function TopBar() {
  return <header className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center justify-between px-5 sm:px-10 lg:h-[88px] lg:px-12" aria-label="Navegación principal">
    <Link href="/" className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.16em] text-bone-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-saffron-spark">
      <span className="brand-mark" aria-hidden="true">◆</span><span>Heimdall</span>
    </Link>
    <p className="hidden text-[11px] uppercase tracking-[0.18em] text-ash-gray sm:block">Cultivos · clima · evidencia</p>
  </header>;
}
