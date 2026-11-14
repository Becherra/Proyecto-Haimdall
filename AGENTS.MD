# AGENTS.md — Reglas para cualquier agente de IA en este repo

Aplica a Codex, Cursor, Antigravity, Claude o cualquier otra herramienta.
**Antes de hacer nada, lee `CONTEXT.md`.** Si algo de este archivo contradice una instrucción puntual del usuario, pregunta antes de continuar.

## 0. Contexto del usuario

- El usuario (Steven y guerra) trabaja solo. No asumas que conoce una librería o patrón: explica brevemente qué hiciste y por qué, en español, en 3–6 líneas al final de cada tarea.
- No inventes datos, parámetros de API ni resultados. Si no estás seguro, verifica ejecutando código o dilo explícitamente.

## 1. Flujo obligatorio por tarea

1. **Plan corto:** di qué archivos vas a crear/modificar y por qué (máx. 8 líneas). Si la tarea es ambigua, haz UNA pregunta antes de empezar.
2. **Tests primero (o junto al código):** cada función de lógica (`lib/`) debe tener tests antes de darla por terminada.
3. **Implementa** lo mínimo que haga pasar los tests. Nada de funcionalidades no pedidas.
4. **Verifica.** Ejecuta, en este orden, y corrige hasta que todo pase:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
5. **Commit** (solo si todo está en verde). Un commit por tarea lógica, pequeño.
6. **Reporte final:** qué se hizo, cómo probarlo a mano, qué falta o qué riesgo queda.

Nunca hagas commit con tests fallando, con código comentado "para después" o con archivos sin relación a la tarea.

## 2. Commits

Formato Conventional Commits, en inglés, imperativo:

```
feat(lib): add nasa power client with fill-value cleaning
fix(indicators): handle months with missing precipitation
test(scoring): cover water-deficit penalty
docs: update CONTEXT.md with crop list decision
chore: configure vitest and eslint
```

- Prefijos: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`.
- Trabaja directo en `main` con commits pequeños, o en rama `feat/<nombre>` si la tarea es riesgosa.
- Nunca reescribas historial (`push --force`, `rebase` de commits ya subidos) sin permiso.
- Haz `git push` al final de cada tarea terminada.

## 3. Calidad de código

## Trabajo en equipo

- A partir de la siguiente tarea, trabajar en una rama por tarea con formato `nombre/tarea`.
- Hacer `git pull --rebase` antes de empezar.
- Trabajar solo en las carpetas asignadas al dueño de la tarea y coordinar cualquier cruce antes de editar.
- Nunca hacer push directo a `main`, excepto la Tarea 2 de cimientos, ya realizada.
- Los cambios en `src/types/` deben ir en un commit separado.

- **TypeScript estricto** (`"strict": true`). Prohibido `any` salvo justificación en comentario.
- **Funciones puras** para toda la lógica de negocio (indicadores, scoring). Sin efectos secundarios, sin `fetch` dentro de ellas. Reciben datos, devuelven datos.
- **Capas separadas:**
  - `src/lib/` → lógica pura y clientes de datos.
  - `src/app/api/` → route handlers **delgados**: validan entrada, llaman a `lib/`, devuelven JSON. Sin lógica de negocio.
  - `src/components/` → solo presentación.
- Nombres descriptivos en inglés para el código; textos de cara al usuario en español.
- Funciones cortas (idealmente < 30 líneas), un solo propósito. Evita duplicación.
- Comentarios solo para explicar el **por qué**, no el qué. Documenta con JSDoc las funciones públicas de `lib/`.
- Constantes y umbrales (ej. temperatura de helada, percentil de lluvia extrema) en `src/lib/config.ts`, nunca como números sueltos en el código.
- Valida toda entrada externa (query params, respuestas de APIs) con **Zod**. Maneja errores con mensajes claros; nunca devuelvas stack traces al cliente.

## 4. Tests

- Framework: **Vitest**. Archivos `*.test.ts` junto al código o en `tests/`.
- Los tests **no llaman a internet**. Usa fixtures JSON en `tests/fixtures/` (una respuesta real de NASA POWER guardada, más casos con datos faltantes `-999`).
- Cubre: caso normal, bordes (datos vacíos, un solo mes, valores faltantes) y un caso de error.
- Un test que falla nunca se borra ni se debilita para que pase; se arregla el código o se explica por qué el test estaba mal.

## 5. Datos y APIs

- NASA POWER: el valor `-999` es dato faltante. Siempre limpiarlo y reportar cuántos datos faltaron.
- Cachea respuestas de NASA POWER (en memoria o archivo) para no repetir llamadas idénticas y no depender de la red en la demo.
- Todo número que llegue a la UI debe poder rastrearse a: un dato NASA, o un atributo de `data/crops.json` con su fuente.
- Los datos pesados (NDVI, SMAP, SRTM) se usan **precargados** en `data/samples/`, no en vivo.

## 6. Seguridad

- Las claves van en `.env.local` (ignorado por git). Mantén `.env.example` con nombres de variables sin valores.
- Nunca imprimas ni commitees secretos. Si ves uno en el historial, avisa de inmediato.
- Revisa `.gitignore` antes del primer commit (`node_modules`, `.env*`, `.next`, `coverage`).

## 7. Honestidad del producto (requisito del reto)

La herramienta es **apoyo a la decisión**. Cada rotación mostrada debe incluir: por qué se sugiere, evidencia (dato NASA usado), beneficios, **vacíos de información** y **riesgos a validar con un agrónomo local**. No presentes resultados como certezas.

## 8. Qué NO hacer

- No agregues dependencias sin decir cuál y por qué. Prefiere pocas y conocidas.
- No refactorices código ajeno a la tarea.
- No cambies `CONTEXT.md` ni este archivo sin pedirlo; si una decisión cambia, propón el texto y espera confirmación.
- No dejes la tarea "casi lista": o está verde y comiteada, o reporta el bloqueo.
