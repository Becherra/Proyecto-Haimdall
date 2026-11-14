# ROADMAP.md — Heimdall · NASA Space Apps 2026

Equipo: **Steven** y **Santi**. Ambos pueden hacer cualquier cosa, así que el reparto es por **pista (track)**, no por habilidad.
Mañana, al empezar, cada uno elige pista (ver sección 4). Las pistas pueden intercambiarse a mitad del hackatón si uno termina antes.

---

## 1. Estado actual (base ya construida)

- [x] Reto elegido: _Desplazamiento de campo: Adaptando granjas con datos de la NASA_
- [x] `CONTEXT.md` (fuente de verdad) y `AGENTS.md` (reglas para IAs)
- [x] Next.js + TypeScript estricto + Tailwind + ESLint + Vitest + Zod
- [x] Cliente NASA POWER (`src/lib/nasaPower.ts`): validación Zod, caché en memoria, limpieza de `-999`, conteo de faltantes
- [x] Fixture real de Pereira con 7 parámetros verificados
- [x] Ruta `GET /api/climate?lat=&lon=&startYear=&endYear=`
- [x] Commit `e0922d9`

## 2. Fase 1 — Cimientos del equipo (hacer UNA persona, antes de dividirse)

Dueño: quien tenga la sesión de Codex abierta (Steven).

- [ ] **F1.1** Contratos de datos en `src/types/` (Zod como fuente de verdad)
- [ ] **F1.2** Cliente NASA POWER endurecido (timeout, reintentos, fallback a muestra precargada, límites de parámetros)
- [ ] **F1.3** Tests de la ruta `/api/climate`
- [ ] **F1.4** GitHub Actions: typecheck + lint + test en cada PR
- [ ] **F1.5** Sección "Trabajo en equipo" en `AGENTS.md` + plantilla de PR
- [ ] **F1.6** Mocks en `src/mocks/` para que el frontend avance sin backend
- [ ] **F1.7** Configurar GitHub: invitar a Santi, proteger `main`, crear tablero Projects, crear Issues desde este roadmap

**Listo cuando:** `main` está en verde, Santi clonó el repo y corre `npm run dev` sin errores.

## 3. Fases de trabajo paralelo

### Pista A — "Motor" (backend, datos y lógica)

| ID  | Tarea                                                                                                                                                                                                       | Criterio de listo                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A1  | `lib/indicators.ts`: agregación mensual, déficit hídrico (lluvia − evaporación), días de estrés térmico, riesgo de helada, percentil 95 de lluvia extrema, humedad de suelo media/anomalía                  | Tests con la fixture; cada indicador devuelve valor + cuántos datos faltaron |
| A2  | Detección de **ventanas de campo vacío** y temporadas de mayor vulnerabilidad (a partir de estacionalidad)                                                                                                  | Función pura con tests; devuelve meses y razón                               |
| A3  | `lib/scoring.ts`: motor de puntuación explicable (pesos de prioridades × criterios de cultivo − penalizaciones)                                                                                             | Cada puntaje trae su razón en texto; tests de casos extremos                 |
| A4  | `lib/rotations.ts`: definición de 3+ rotaciones (actual, leguminosa, cobertura/tolerante a sequía) y generación de `RotationResult` completo (por qué, evidencia, beneficios, vacíos, riesgos, qué validar) | Los 3 resultados salen con todos los campos llenos                           |
| A5  | Ruta `POST /api/analyze` que une clima → indicadores → rotaciones                                                                                                                                           | Responde con el contrato `AnalysisResponse`; validación Zod; tests           |
| A6  | Escenarios: parámetros `tempDelta` y `rainFactor` que ajustan los datos antes de calcular                                                                                                                   | Test: +2 °C y −20 % lluvia cambian los puntajes de forma coherente           |
| A7  | Datos opcionales precargados en `data/samples/`: SRTM (pendiente/elevación), NDVI MODIS o SMAP de la zona piloto, con script de preparación documentado                                                     | Se integran como indicador extra con su propia nota de limitación            |
| A8  | Cuadro de **vacíos de información** por rotación (qué no sabemos: tipo de suelo real, precios de mercado, plagas locales)                                                                                   | Texto consistente en todos los resultados                                    |

### Pista B — "Experiencia" (frontend, contenido y pitch)

| ID  | Tarea                                                                                                                                                                                                             | Criterio de listo                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| B1  | `data/crops.json`: ~12 cultivos del Eje Cafetero con atributos 0–5 (agua, fijación de N, erosión, materia orgánica, forraje, mercado, tolerancia calor/sequía, ciclo, meses de siembra) y **fuente** de cada dato | Validado con el esquema Zod `Crop`; test que lo carga |
| B2  | Página principal y diseño base (paleta, tipografía, layout móvil primero)                                                                                                                                         | Se ve bien en celular y escritorio                    |
| B3  | Mapa Leaflet: el agricultor marca su finca; guarda lat/lon                                                                                                                                                        | Click en mapa actualiza coordenadas                   |
| B4  | Formulario de prioridades (agua, ingresos, suelo, erosión, riesgo) + restricciones + cultivo actual                                                                                                               | Produce un objeto `UserPriorities` válido             |
| B5  | Gráficas de clima con Recharts (lluvia vs evaporación, temperatura, humedad de suelo)                                                                                                                             | Funcionan con mocks y luego con la API real           |
| B6  | Tarjetas de rotación: puntaje, por qué, evidencia, beneficios, **vacíos**, **riesgos / validar con experto local**                                                                                                | Se ven con el mock; accesibles para no técnicos       |
| B7  | Línea de tiempo anual: meses de campo vacío y de mayor vulnerabilidad                                                                                                                                             | Visualización clara por rotación                      |
| B8  | Deslizador de escenarios (calor / lluvia) conectado a `/api/analyze`                                                                                                                                              | Cambiar el slider actualiza resultados                |
| B9  | Glosario en lenguaje sencillo (evapotranspiración, NDVI, déficit hídrico) y aviso permanente "apoyo, no reemplazo"                                                                                                | Textos revisados                                      |
| B10 | Estados de carga, error y "sin conexión → usando datos de muestra"                                                                                                                                                | Nunca se ve una pantalla en blanco                    |

### Pista C — Integración y entrega (la hacen ambos juntos)

| ID  | Tarea                                                                      | Criterio de listo                                      |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------ |
| C1  | Conectar UI con `/api/analyze` real (reemplazar mocks)                     | Flujo completo funciona de punta a punta               |
| C2  | Revisión cruzada de PRs con una IA como revisora                           | Sin violaciones de `AGENTS.md`                         |
| C3  | Prueba con 2–3 ubicaciones distintas (Pereira, otra región, una zona fría) | Resultados razonables y sin errores                    |
| C4  | Despliegue (Vercel o Firebase) + dominio GoDaddy                           | URL pública estable, con datos precargados de respaldo |
| C5  | README final: qué datos NASA se usan, cómo, limitaciones, uso de IA        | Cumple la Guía de presentación                         |
| C6  | Video demo (guion + grabación + edición)                                   | Dentro del límite de duración exigido                  |
| C7  | Formulario de envío del proyecto                                           | Enviado **antes** de la fecha límite                   |

## 4. Cómo se dividen mañana (decidir en 10 minutos)

Opciones:

1. **Steven = A, Santi = B.** Es la más limpia: cero choque de archivos.
2. **Santi = A, Steven = B.** Igual de válida; elijan según a quién le dé más curiosidad cada pista.
3. **Intercambio a mitad:** al terminar A5 y B6, se cruzan para revisarse el código y que ambos entiendan todo el sistema (clave para defender el proyecto).

Reglas: dependencia principal = F1 completa. B puede avanzar con mocks mientras A termina A1–A5.

## 5. Orden de prioridad si falta tiempo

**Imprescindible (MVP):** A1, A3, A4, A5, B1, B3, B4, B6, C1, C4, C5, C6, C7.
**Muy valioso:** A2, A8, B5, B7, B9, B10, C3.
**Extra de lucimiento:** A6/B8 (escenarios), A7 (NDVI/SMAP/SRTM).

## 6. Cadencia de trabajo

- Sincronización de 10 min al iniciar cada bloque: qué hice, qué haré, qué necesito.
- Una rama por tarea, PR pequeño, revisión cruzada, _Squash and merge_.
- Últimas 4–5 horas: **congelar funcionalidades**; solo pulido, video y envío.
