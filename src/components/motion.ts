"use client";

import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const NO_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Quien pide menos movimiento en su sistema no ve animaciones: todo queda en su estado final. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(NO_MOTION_QUERY).matches;
}

/**
 * Entrada escalonada: los hijos con `data-reveal` suben y aparecen en cascada al montar el contenedor.
 * Devuelve la ref que se pone en el contenedor.
 */
export function useReveal<T extends HTMLElement>(): RefObject<T | null> {
  const scope = useRef<T>(null);
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.from("[data-reveal]", { opacity: 0, y: 26, duration: 0.65, ease: "power3.out", stagger: 0.09, clearProps: "opacity,transform" });
  }, { scope });
  return scope;
}

/** Rebote breve al elegir una opción, para que el toque se sienta. */
export function popElement(element: Element): void {
  if (prefersReducedMotion()) return;
  gsap.fromTo(element, { scale: 0.93 }, { scale: 1, duration: 0.5, ease: "back.out(3)", clearProps: "transform" });
}
