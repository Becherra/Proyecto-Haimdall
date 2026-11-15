# HEIMDALL — Guía de color

Fuente de verdad: los tokens `@theme` de `src/app/globals.css`. Esta guía explica **qué rol cumple cada color**; no copies hex en componentes, usa la clase de Tailwind (`bg-meadow`, `text-cream`…) o `var(--color-…)`.

Paleta de referencia: Meadow Green, Mustard Green, Peach (oliva en la imagen) y Outerspace.

## Tokens y roles

| Token | Hex | Rol |
|---|---|---|
| `meadow` | `#0d3c16` | Fondo de página y de pantallas completas. Texto sobre botones crema. |
| `moss` | `meadow` 70% + `olive` 30% (`#2c501f`) | Superficie de tarjetas y paneles (verde, derivado de la paleta). 1.36:1 contra `meadow`. |
| `spruce` | `#243d47` | Azul: solo el océano del globo y avisos informativos (fuente de datos). No para tarjetas. |
| `cream` | `#ead39d` | **Acción**: botones primarios, estrella/“Mejor”, borde de lo seleccionado. |
| `olive` | `#737f35` | Acento secundario: chips (“Hoy”), barras de datos, bordes de tarjetas. **Nunca como texto** (2.9:1 sobre meadow). |
| `olive-light` | `#b5c266` | Íconos de cultivo y de sección, etiquetas pequeñas (eyebrows), puntajes y datos positivos. |
| `bone-white` | `#f8efd2` | Texto principal. |
| `silver-mist` | `#e3d7b3` | Texto secundario. |
| `ash-gray` | `#c9bf9a` | Texto terciario y metadatos. |
| `clay` / `clay-light` | `#8f3a26` / `#f0a58f` | **Riesgo, error, empeora.** Único color fuera de la paleta de la imagen. `clay` es solo superficie o borde (1.7:1 sobre meadow); el texto de riesgo va en `clay-light`. |

## Reglas

1. **Un color, un significado.** Crema = acción o “lo mejor”; arcilla = riesgo o peor; oliva claro = etiqueta o dato positivo. No uses crema para señalar riesgos.
2. **Superficies**: meadow (fondo) → moss (tarjeta). Para hundir un bloque dentro de una tarjeta usa `bg-meadow/35`, nunca blanco o gris translúcido.
3. **Sin grises neutros ni hex sueltos.** Todo sale de los tokens. Si necesitas una variante, usa opacidad (`cream/10`) o `color-mix(in srgb, var(--color-x) N%, var(--color-y))`.
4. **Excepciones de JS**: Leaflet, SVG y partículas (three.js) no leen variables CSS; ahí se repite el hex del token (`#EAD39D`, `#0D3C16`…). Si cambia un token, búscalo con `grep -rn "#EAD39D" src`.
5. **Globo**: la textura se tiñe con `scripts/tint-earth-textures.mjs` (océano = spruce, tierra = olive). Si cambias esos tokens, vuelve a correr `node scripts/tint-earth-textures.mjs`.
6. Combinaciones de texto: bone-white / silver-mist / cream / olive-light sobre meadow o moss; meadow sobre cream.
7. **Profundidad**: el fondo de página (`body`) y de pantallas completas (`bg-scene`) lleva grano de crema, viñeta y brillo oliva arriba; las tarjetas llevan `card-surface` (luz arriba, reborde y sombra) junto a `bg-moss`; el globo lleva `globe-glow`. Las tres clases están en `globals.css`. No pongas `bg-meadow` plano en una pantalla completa.

## Movimiento (GSAP)

- Paquetes: `gsap` y `@gsap/react` (hook `useGSAP`, que limpia las animaciones al desmontar). Los helpers viven en `src/components/motion.ts`.
- `useReveal`: entrada escalonada de todo lo marcado con `data-reveal` dentro de un contenedor. `popElement`: rebote al elegir una opción.
- Pila de preguntas: la pose de cada tarjeta sale de `stackPose` (`src/lib/ui/stackPose.ts`, con tests) y GSAP la anima con un resorte suave.
- Resultados: estrellas que saltan, acordeón con altura animada, barras de la gráfica y del puntaje que crecen.
- Inicio: el resplandor del globo "respira" (`GlobeGlow`).
- **Todo respeta `prefers-reduced-motion`**: con "menos movimiento" nada se anima y todo queda en su estado final.
- No pongas clases `transition` de Tailwind en elementos que GSAP mueve (transform/opacity): pelean entre sí. Usa `transition-colors`.

