# API de análisis (backend)

Contrato de `POST /api/analysis` para el frontend, datos de la NASA usados y límites conocidos. Los esquemas Zod viven en `src/types/index.ts` (`analysisRequestSchema`, `analysisResponseSchema`); si este documento y los esquemas difieren, mandan los esquemas.

La herramienta es **apoyo a la decisión**: cada rotación trae por qué se sugiere, evidencia, beneficios, vacíos de información y riesgos a validar con un agrónomo local. Ningún resultado es una certeza.

## Solicitud

`POST /api/analysis` con cuerpo JSON:

```json
{
  "lat": 4.8133,
  "lon": -75.6961,
  "startYear": 2020,
  "endYear": 2022,
  "priorities": {
    "waterSaving": 3, "extraIncome": 3, "soilImprovement": 3, "erosionReduction": 3, "lowRisk": 3,
    "currentCropId": "maiz",
    "waterAvailability": "medium"
  },
  "farm": { "centroid": { "lat": 4.8133, "lon": -75.6961 }, "locationSource": "search", "terrain": { "kind": "point" } },
  "scenario": { "tempDeltaC": 2, "rainFactor": 0.8 }
}
```

| Campo | Obligatorio | Detalle |
| --- | --- | --- |
| `lat`, `lon` | Sí | Se usan solo si no llega `farm`. |
| `startYear`, `endYear` | Sí | Desde 1981 hasta el año pasado; máximo 15 años. La interfaz pide los últimos 15 años completos (hoy 2011–2025): una serie corta no muestra cómo cambia la lluvia de un año a otro. |
| `priorities` | Sí | Cinco valores de 0 a 5: `waterSaving`, `extraIncome`, `soilImprovement`, `erosionReduction`, `lowRisk`. |
| `priorities.currentCropId` | No | Cultivo actual. Por defecto `maiz`. Ids válidos: `maiz`, `frijol`, `soya`, `arveja`, `mucuna`, `crotalaria`, `yuca`, `papa`, `avena`, `repollo`. |
| `priorities.waterAvailability` | No | `low`, `medium` o `high`. |
| `priorities.elevationMeters`, `priorities.slopePercent` | No | Altitud (m s. n. m.) y pendiente (%) que declara el agricultor. Tienen prioridad sobre la lectura SRTM precargada. |
| `farm` | No | Contrato de `docs/farm-contract.md`. Se valida de nuevo en el servidor, el área del polígono se recalcula y el clima se consulta en `farm.centroid`. |
| `scenario` | No | Escenario "¿y si…?": `tempDeltaC` entre −2 y 5 °C, `rainFactor` entre 0.5 y 1.5 (0.8 = 20 % menos lluvia). |
| `includeDailyRecords` | No | `true` para recibir los registros diarios en `climate.records`. Por defecto no se envían. |

## Respuesta (200)

```json
{
  "climate": { "source": "live", "daysAnalyzed": 1096, "firstDate": "20200101", "lastDate": "20221231", "cellElevationMeters": 2138.33, "missingByParameter": { "T2M": 0 } },
  "monthlyClimate": [{ "year": 2020, "month": 1, "meanTemperatureC": 16.44, "minTemperatureC": 12.78, "maxTemperatureC": 21.35, "precipitationMm": 54.23, "evaporationMm": 106.28, "potentialEvaporationMm": 99.11, "rootZoneWetness": 0.82, "missingByParameter": {} }],
  "indicators": { "waterDeficitMm": 48.39, "heatStressDays": 0, "frostRiskDays": 0, "extremeRainThresholdMm": 17.45, "meanRootZoneWetness": 0.8, "meanTemperatureC": 20.64, "cellMeanTemperatureC": 16.27, "cellElevationMeters": 2138.33, "siteElevationMeters": 1411, "slopePercent": 18, "terrainSource": "srtm-sample", "waterBalanceMethod": "potential", "missingByParameter": {} },
  "rotations": [{
    "rotation": { "id": "legume", "name": "Maíz → Soya", "cropIds": ["maiz", "soya"], "description": "…" },
    "score": 2.6,
    "whySuggested": "…", "evidence": ["…"], "benefits": ["…"], "informationGaps": ["…"], "risks": ["…"], "validateWithLocalExpert": ["…"],
    "calendar": { "months": [{ "offset": 0, "month": 3, "cropId": "maiz", "dry": false, "risk": null }], "fallowMonths": 3, "vulnerableMonths": 2 }
  }],
  "dataSources": [{ "id": "power-t2m", "name": "Temperatura media a 2 m (T2M)", "provider": "NASA POWER", "use": "…", "url": "https://power.larc.nasa.gov/" }],
  "scenario": { "tempDeltaC": 2, "rainFactor": 0.8 }
}
```

Las cifras del ejemplo salen de una respuesta real para Pereira 2020–2022 sin escenario (se redondearon para leerlas mejor). Esa respuesta pesa unos 36 KB.

- **`climate`**: resumen de la serie. `source` es `live` (NASA respondió), `cache` (misma consulta ya hecha en este proceso) o `sample` (NASA no respondió y se usó la muestra precargada).
- **`monthlyClimate`**: un elemento por mes de la serie; es lo que deben usar las gráficas.
- **`indicators`**: `waterDeficitMm` es lluvia − evaporación media mensual (negativo = déficit). `heatStressDays` y `frostRiskDays` son totales de la serie, no por año. `meanTemperatureC` ya viene corregida por altitud cuando se conoce la del lote; `cellMeanTemperatureC` es la de la celda sin corregir.
- **`rotations`**: siempre tres y en este orden: `baseline` (el cultivo actual solo), `legume` (con una leguminosa) y `cover-drought` (cobertura + cultivo tolerante a sequía). `score` va de 0 a 5.
- **`rotations[].calendar`**: un ciclo completo de la rotación mes a mes; puede durar más de 12 meses. `cropId: null` es campo vacío. `risk` es `bare-soil-rain` (campo vacío en mes lluvioso), `water-stress` (cultivo poco tolerante a sequía en mes seco) o `null`. Solo llega dentro del Eje Cafetero, donde vale el calendario de siembra del catálogo.
- **`indicators` de sequía**: `longestDrySpellDays` es la racha más larga de días seguidos con menos de 1 mm de lluvia; `meanAnnualDrySpellDays` es el promedio de la racha máxima de cada año; `worstYear` es el año con el balance hídrico medio mensual más bajo (solo con 5 años completos o más). El peor año agrega una penalización pequeña a los cultivos de baja tolerancia a sequía, solo por lo que se suma a la sequía del promedio.
- **`currentSeason`**: los últimos días (hasta 90) de NASA POWER frente al mismo tramo del calendario en la serie. NASA publica con unos días de retraso, así que `lastDate` queda unos días antes de hoy. `status` es `much-drier`, `drier`, `normal`, `wetter` o `much-wetter` según el % de la lluvia normal (cortes en `config.ts`, heurística de diseño). Es una lectura reciente y **preliminar**, no un pronóstico. Falta si NASA no entregó los últimos días, si hay menos de 80 % de días con dato o si la serie no tiene 5 años con dato en esa época; en el primer caso cada rotación lo declara como vacío.
- **`dataSources`**: qué dato se usó, de quién es y para qué.
- **`scenario`**: solo si se pidió. `monthlyClimate`, `indicators` y `rotations` ya lo reflejan.

Para desarrollar sin backend, `mockAnalysisResponse` (`src/mocks`) cumple el mismo esquema.

## Errores

Siempre `{ "error": "mensaje en español" }`, sin trazas internas.

| Código | Cuándo |
| --- | --- |
| 400 | JSON inválido, parámetros fuera del esquema, años fuera de rango, cultivo que no está en el catálogo, `farm` con geometría inválida o escenario fuera de sus límites. |
| 502 | NASA POWER no respondió y no hay muestra precargada para ese sitio. |

## Datos de la NASA usados

Todo el clima viene de **NASA POWER**, API diaria por punto (`https://power.larc.nasa.gov/`), comunidad `AG`. El valor `-999` es dato faltante: se limpia y se cuenta en `missingByParameter`.

| Parámetro | Para qué se usa |
| --- | --- |
| `T2M` | Temperatura media del sitio, aptitud térmica de cada cultivo, evaporación potencial. |
| `T2M_MIN` | Días con riesgo de helada, evaporación potencial. |
| `T2M_MAX` | Días de estrés por calor, evaporación potencial. |
| `PRECTOTCORR` | Balance hídrico, meses secos y lluviosos, umbral de lluvia extrema. |
| `EVLAND` | Resumen mensual de evaporación. El balance hídrico usa la evaporación potencial estimada con Hargreaves–Samani. |
| `GWETROOT` | Humedad de la zona de raíces: media del sitio y, por cada cultivo, el rango en sus meses de siembra, con aviso de los meses de siembra en que el suelo queda por debajo de lo normal (menos del 97 % de la media anual). Se muestra como evidencia y riesgo; no cambia el puntaje: varía poco (0,75–0,85 en el Eje Cafetero), sigue a la lluvia y es un proxy de ~50 km. |
| `ALLSKY_SFC_SW_DWN` | Se descarga, pero todavía no interviene en indicadores ni puntajes. |
| Altitud de la celda | Corregir la temperatura de la celda a la altitud del lote. |

Lo que **no** es dato de la NASA POWER: el catálogo de cultivos (`data/crops.json`, con sus fuentes en `docs/crops-rubric.md`). Las altitudes y pendientes precargadas (`data/samples/srtm-eje-cafetero.json`) son lecturas del ráster NASA SRTMGL1 v003 en cinco puntos piloto (ver `docs/srtm-samples.md`): valen para el punto, no para todo el lote.

### Muestras precargadas

Si NASA POWER no responde, hay respaldo para Pereira (cubre también Santa Rosa de Cabal), Manizales y Armenia, con los años 2011–2025. Son respuestas reales de la API guardadas sin modificar en `data/samples/`; se regeneran con `node scripts/build-power-samples.mjs`. Si se piden más años de los que tiene la muestra, la respuesta lo declara como vacío ("Se pidieron N años de clima y la serie trae M"), igual que declara que los datos son una muestra guardada.

## Límites conocidos

- **Resolución del clima.** Pereira, Manizales y Santa Rosa de Cabal caen en la misma celda de NASA POWER y reciben temperatura y lluvia idénticas; entre esos sitios solo cambia la corrección por altitud. Dibujar el lote no mejora esa resolución.
- **Terreno.** Solo cinco puntos del Eje Cafetero tienen altitud y pendiente precargadas (lecturas SRTM del punto, no del lote). Fuera de ellos no hay corrección por altitud salvo que el agricultor la declare.
- **Catálogo.** Diez cultivos anuales y dos permanentes (café y plátano). Los permanentes solo se aceptan como cultivo actual (`currentCropId: "cafe"` o `"platano"`): sus alternativas son asociarles fríjol o maíz en las calles mientras son jóvenes, sin calendario de rotación, y nunca se sugieren como punto de partida. No hay pastos ni otros permanentes. Los puntajes 0–5 son preliminares y no los ha validado un agrónomo. Los meses de siembra son los mismos para todos los cultivos y no tienen fuente propia para papa, avena y repollo.
- **Calendario.** Es ilustrativo: usa meses de siembra y ciclos típicos, no las fechas reales del agricultor.
- **Escenarios.** Son un cambio uniforme sobre la serie histórica, no una proyección climática; la humedad del suelo no se recalcula.
- **Clima reciente.** Solo lluvia y temperatura de NASA POWER de los últimos días; no hay pronóstico. IMERG, SMAP y NDVI recientes no están integrados.
- **Sin datos de suelo, plagas, precios ni costos.** Tampoco se integraron NDVI, SMAP ni GAEZ.

## Uso de inteligencia artificial

El backend (lógica de `src/lib/`, endpoint, tests y este documento) se desarrolló con asistencia de Claude Code (Anthropic). El equipo debe completar aquí cualquier otra herramienta de IA usada en el resto del proyecto antes de la entrega.
