# Fuentes del plan de acción · piloto Pereira (BORRADOR)

> **Estado:** inventario inicial para la Fase A. Lo que dice "por verificar" **no se ha comprobado**: nadie ha abierto la capa o la ficha para confirmar cobertura, escala, fechas ni licencia. Hasta entonces, ninguna acción del plan puede apoyarse en esa fuente.

Contrato de datos: `evidenceSchema`, `planActionSchema` y `actionPlanSchema` en `src/types/index.ts`. Regla: una acción solo es `ready` si trae evidencia de una fuente de esta tabla con estado **Usable**; si la fuente está **Por verificar**, la acción sale como `missing-data` o `insufficient-evidence`.

## Alcance del piloto

- **Lugar:** Pereira (Risaralda) y su entorno cafetero (centroide de referencia 4.8133, −75.6961).
- **Cultivos:** los que ya tienen ficha en `data/crops.json` y respaldo en `docs/crops-rubric.md`; se eligen 2 o 3 y **una** transición entre ellos.
- **Fuera del piloto:** cualquier otra zona o cultivo devuelve `actionPlan.status = "insufficient"` con sus vacíos.

## Tabla de fuentes

| Fuente | Tipo de evidencia | Variables | Escala / resolución | Estado | Limitación conocida |
| --- | --- | --- | --- | --- | --- |
| NASA POWER (diario) | `regional` | Temperatura, lluvia, evaporación, humedad de raíces, radiación | Malla de 0.5° × 0.625° (meteorología) y 1° (radiación), según `docs/farm-contract.md` | **Usable** (ya integrada) | No es medición del lote; el polígono no mejora la resolución |
| NASA SRTM GL1 v003 (muestras precargadas) | `estimated` | Altitud y pendiente | Muestras puntuales del Eje Cafetero en `data/samples/srtm-eje-cafetero.json` | **Usable** (precargada) | Solo cubre los puntos muestreados; no sustituye una medición en campo |
| Catálogo de cultivos (`data/crops.json`) | `published-practice` | Ciclos, meses de siembra, rangos de temperatura | Por cultivo; fuente por cultivo en `docs/crops-rubric.md` | **Usable con reservas** | Varias cifras salen de resúmenes de búsqueda, no de la ficha completa; ningún valor lo ha validado un agrónomo |
| Lo que declara el agricultor | `declared` | Riego, área, fecha prevista, maquinaria, mano de obra, semillas | La del propio lote | **Usable** (opcional, hay que pedirlo) | Es una declaración; se debe mostrar como tal |
| SoilGrids (ISRIC) | `estimated` | Textura, pH, carbono orgánico | 250 m, con incertidumbre | **Por verificar** | No reemplaza un análisis de suelo; solo contexto, **no activa acciones** |
| UPRA / SIGRA | `regional` | Aptitud y amenazas agrícolas | Por verificar por capa | **Por verificar** | Cobertura, escala y versión distintas según la capa; no depender de consultas en vivo en la demo |
| IGAC (geografía de suelos) | `regional` | Capas de suelos | Por verificar por capa | **Por verificar** | Puede no cubrir la ubicación |
| AGROSAVIA (AGRORAC y fichas) | `published-practice` | Prácticas por cultivo y zona | Por cultivo y zona | **Por verificar** | Sin API: cada regla se transcribe a mano con su cita |
| ICA | `published-practice` | Guías técnicas y normas sanitarias | Por cultivo | **Por verificar** | Igual que AGROSAVIA |
| Cenicafé | `published-practice` | Maíz y fríjol asociados con café; periodos menos lluviosos | Eje Cafetero | **Por verificar** (ya citada de segunda mano en `docs/crops-rubric.md`) | Falta abrir la publicación original |

## Qué falta para cerrar la Fase A

1. Elegir las 2 o 3 especies y la transición del piloto.
2. Por cada fuente "Por verificar": abrirla, anotar cobertura real en Pereira, escala, fecha y licencia, y pasar la fila a **Usable** o **Descartada**.
3. Por cada práctica técnica que se quiera convertir en regla, guardar la cita (documento, página, fecha) junto a la regla.
4. Acordar con Becerra la forma final de `evidenceSchema` y `actionPlanSchema` antes de que el backend genere planes.

## Qué no se hace en esta fase

- No se integran todas las capas satelitales: una fuente solo entra si cambia o explica una acción.
- No se agregan consultas en vivo a UPRA, IGAC ni SoilGrids; si se usan, van precargadas en `data/samples/`.
