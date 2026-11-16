# Fuentes del plan de acción · piloto Pereira

> **Estado:** inventario actualizado frente al producto (2026-11-15). Las fuentes de clima (NASA POWER), topografía (NASA SRTM en vivo y precargado), pronóstico hidrográfico (IDEAM) y perfiles fitosanitarios de café y plátano (Cenicafé, AGROSAVIA e ICA en `data/crop-profiles.json`) ya fueron verificadas e integradas. Las capas que aún dicen **Por verificar** no se han comprobado para Pereira: hasta entonces, ninguna acción `ready` del plan puede apoyarse en ellas.

Contrato de datos: `evidenceSchema`, `planActionSchema` y `actionPlanSchema` en `src/types/index.ts`. Regla: una acción solo es `ready` si trae evidencia de una fuente de esta tabla con estado **Usable**; si la fuente está **Por verificar**, la acción sale como `missing-data` o `insufficient-evidence`.

## Alcance del piloto

- **Lugar:** Pereira (Risaralda) y su entorno cafetero (centroide de referencia 4.8133, −75.6961).
- **Cultivos:** los que ya tienen ficha en `data/crops.json` (respaldo en `docs/crops-rubric.md`) y los permanentes con perfil sanitario verificable en `data/crop-profiles.json` (`cafe` y `platano`, ver `docs/crop-profiles.md`).
- **Fuera del piloto:** cualquier otra zona o cultivo sin fuentes verificadas devuelve `actionPlan.status = "insufficient"` con sus vacíos.

## Tabla de fuentes

| Fuente | Tipo de evidencia | Variables | Escala / resolución | Estado | Limitación conocida |
| --- | --- | --- | --- | --- | --- |
| NASA POWER (diario y últimos 90 días) | `regional` | Temperatura (`T2M`, `T2M_MIN`, `T2M_MAX`), lluvia (`PRECTOTCORR`), evaporación (`EVLAND` y Hargreaves–Samani), humedad radicular (`GWETROOT`), radiación (`ALLSKY_SFC_SW_DWN`), erosividad (Fournier) y ventanas de siembra | Malla de 0.5° × 0.625° (meteorología) y 1° (radiación), según `docs/farm-contract.md` | **Usable** (integrada en vivo + muestras 2011–2025) | No es medición del lote; el polígono no mejora la resolución; `GWETROOT` es un proxy regional |
| NASA SRTM GL1 v003 (en vivo y muestras precargadas) | `estimated` | Altitud media, pendiente de Horn y rango de pendiente del lote (`srtm-live` vía OpenTopoData) o lectura del punto piloto (`srtm-sample`) | ~30 m (1 arco-segundo) en vivo sobre hasta 100 puntos del lote; respaldo puntual en `data/samples/srtm-eje-cafetero.json` | **Usable** (integrada en vivo + respaldo precargado) | La malla de 30 m suaviza taludes y no ve terrazas ni zanjas; la muestra precargada solo vale para el punto piloto (~9 km) |
| IDEAM (pronóstico de sequía por zona hidrográfica) | `regional` | Categorías de sequía (`none`, `D0`–`D4`) e índice agregado a 3, 6, 9 y 12 meses (`PRONOSTICO_SEQUIA` en ArcGIS FeatureServer) | Zona hidrográfica (`nomzh`) | **Usable** (integrada en `GET /api/drought` y `EnsoContextCard`) | Es una señal hidrográfica regional; no confirma falta de agua ni daño en el lote |
| Catálogo de cultivos (`data/crops.json`) | `published-practice` | Atributos 0–5, ciclos, meses de siembra, familias y rangos térmicos de 12 cultivos | Por cultivo; fuente por cultivo en `docs/crops-rubric.md` | **Usable con reservas** | Varias cifras provienen de resúmenes y los puntajes 0–5 son ordinales preliminares sin validación de un agrónomo local |
| Perfiles y sanidad de café y plátano (`data/crop-profiles.json`) | `published-practice` | Variedades, material de siembra, etapas, amenazas (roya, broca, moko, sigatoka negra, picudo) y medidas culturales con cita por afirmación | Colombia / Eje Cafetero / ámbito declarado en cada `Claim` (ver `docs/crop-profiles.md`) | **Usable** (verificada para café y plátano) | No es diagnóstico ni incluye control químico; síntomas de roya quedan `undocumented` en las fuentes leídas |
| Cenicafé (OJS `publicaciones.cenicafe.org`) | `published-practice` | Variedades de café, roya, broca y zoca (AT 476, 531, 566, 570 y Brocarta 45); asociación de maíz y fríjol en café joven | Zona cafetera de Colombia | **Usable en café** (PDF verificados en `docs/crop-profiles.md`); **Por verificar** la cita primaria de maíz/fríjol intercalados en `crops-rubric.md` | Solo PDF sin API; `biblioteca.cenicafe.org` no resolvió por DNS |
| AGROSAVIA (Repositorio DSpace 9.1 y `datos.gov.co`) | `published-practice` | Semilla, etapas y sanidad de plátano Dominico Hartón y Hartón (manuales 2019, 2021, 2023) | API REST (`/server/api`) y OAI-PMH verificados; ítems CC BY-NC-SA 4.0 | **Usable en plátano** (`data/crop-profiles.json`); **Por verificar** fichas para los demás cultivos anuales | Contenidos en PDF/audio; confirmar términos del repositorio antes de automatizar descargas |
| ICA (Alerta temprana de moko y Res. 092770/2021) | `published-practice` | Síntomas, prevención y exigencia de confirmación oficial del moko en plátano y banano | Nacional / Urabá (cartilla ICA-MADR-AUGURA 2022) | **Usable para alerta y remisión oficial de moko**; **Por verificar** el PDF íntegro de la Res. 092770/2021 (enlace 404) y otros cultivos | Sin API de vigilancia fitosanitaria en `datos.gov.co` |
| Lo que declara el agricultor | `declared` | Cultivo actual, variedad, semilla, etapa, problema observado, agua disponible, altitud y pendiente | La del propio lote | **Usable** (integrada en el flujo de preguntas) | Es una declaración del usuario; se reporta siempre como tal y sin interpretar texto libre |
| SoilGrids (ISRIC) | `estimated` | Textura, pH, carbono orgánico | 250 m, con incertidumbre | **Por verificar** | No reemplaza un análisis de suelo; solo contexto, **no activa acciones** |
| UPRA / SIGRA | `regional` | Aptitud y amenazas agrícolas | Por verificar por capa | **Por verificar** | Cobertura, escala y versión distintas según la capa; no depender de consultas en vivo en la demo |
| IGAC (geografía de suelos) | `regional` | Capas de suelos | Por verificar por capa | **Por verificar** | Puede no cubrir la ubicación |

## Qué falta para cerrar la generación de `actionPlan`

1. Conectar `cropProfile?: CropProfileSelection` y las fuentes ya verificadas (NASA POWER, SRTM, Cenicafé, AGROSAVIA, ICA) al generador de `actionPlan` en `/api/analysis`.
2. Abrir en fuente primaria el documento de Cenicafé sobre ciclos y ventanas de maíz/fríjol intercalados y el texto completo de la Resolución ICA 092770 de 2021.
3. Si se incorporan reglas de AGROSAVIA o ICA para cultivos anuales (maíz, fríjol, yuca, papa), registrar documento, página y fecha junto a cada regla antes de marcar acciones como `ready`.
4. Si se decide usar contexto de SoilGrids, UPRA o IGAC para Pereira, precargarlo en `data/samples/` tras verificar licencia y cobertura.
