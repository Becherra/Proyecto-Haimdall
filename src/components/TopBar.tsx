import Link from "next/link";

export default function TopBar() {
  return <header className="relative z-20 mx-auto flex w-full max-w-[1280px] items-center justify-between px-6 py-5 sm:px-10" aria-label="Navegación principal">
    <Link href="/" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-bone-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-saffron-spark">
      <span className="brand-mark" aria-hidden="true">◆</span> Heimdall
    </Link>
    <nav className="hidden items-center gap-6 text-xs uppercase tracking-[0.14em] text-ash-gray sm:flex" aria-label="Secciones">
      <a href="#inicio" className="transition-colors hover:text-bone-white focus-visible:text-bone-white">Inicio</a>
      <a href="#datos" className="transition-colors hover:text-bone-white focus-visible:text-bone-white">Datos NASA</a>
    </nav>
    <a href="#inicio" className="rounded-full bg-electric-iris px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-bone-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-saffron-spark">Explorar</a>
  </header>;
}
