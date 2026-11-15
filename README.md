<div align="center">
  <img src="public/brand/heimdall-logo-cream.png" alt="Símbolo de Heimdall" width="88" />
  <h1>HEIMDALL</h1>
  <p><strong>Rotaciones de cultivo con contexto climático de NASA POWER</strong></p>
  <p><a href="https://byheimdall.earth">Abrir demo</a> · <a href="docs/api-analysis.md">Contrato y datos</a> · <a href="docs/crops-rubric.md">Rúbrica de cultivos</a></p>
  <img src="docs/brand/heimdall-social-preview.png" alt="Heimdall: decisiones agrícolas con datos climáticos" width="100%" />
  <br />
  <a href="https://github.com/Becherra/Proyecto-Haimdall/actions/workflows/ci.yml"><img src="https://github.com/Becherra/Proyecto-Haimdall/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
</div>

## Qué es

Heimdall ayuda a explorar alternativas de rotación a partir de la ubicación de una finca, las prioridades de quien la trabaja y el historial climático de NASA POWER. Presenta indicadores, compara tres estrategias y explica la evidencia, los beneficios, los vacíos y los riesgos de cada una. Está pensado para el Eje Cafetero colombiano y como prototipo del reto [Field Shift](https://www.spaceappschallenge.org/).

> **Apoyo a la decisión, no reemplazo.** Las recomendaciones y puntajes son preliminares; deben contrastarse con las condiciones de la finca y el conocimiento agronómico local.

## Recorrido

1. **Ubica la finca:** busca un lugar, usa el GPS o señala el terreno en el mapa.
2. **Describe el contexto:** indica el cultivo actual, disponibilidad de agua y prioridades; algunos datos del terreno son opcionales.
3. **Compara opciones:** revisa indicadores, tres estrategias de rotación, su evidencia y lo que aún falta validar.

## Datos y límites

| Fuente o dato | Uso en Heimdall | Límite que mostramos |
| --- | --- | --- |
| [NASA POWER](https://power.larc.nasa.gov/) diario, comunidad `AG` | Temperatura, precipitación, evaporación y humedad de zona radicular para indicadores climáticos | Es una celda climática regional; dibujar un lote no aumenta la resolución ni produce mediciones del terreno. |
| NASA SRTM precargado | Contexto de elevación y pendiente en cinco puntos piloto | Una lectura de referencia no representa todo el predio; fuera de cobertura puede faltar. |
| Catálogo de cultivos | Atributos usados para comparar alternativas | Los puntajes son relativos y preliminares; no son rendimientos ni datos locales de mercado, y no están validados por un agrónomo. |
| Escenarios “¿y si…?” | Explorar cambios uniformes sobre el historial | Son simulaciones sobre datos históricos, no pronósticos climáticos. |

Si faltan datos o evidencia, el análisis lo indica. Más detalles, parámetros y limitaciones están en [API de análisis](docs/api-analysis.md), [contrato de finca](docs/farm-contract.md), [rúbrica de cultivos](docs/crops-rubric.md) y [muestras SRTM](docs/srtm-samples.md).

## Ejecutar localmente

**Requisitos:** Node.js 20 o posterior y npm.

```bash
git clone https://github.com/Becherra/Proyecto-Haimdall.git
cd Proyecto-Haimdall
npm ci
```

Crea `.env.local` a partir de `.env.example` (PowerShell: `Copy-Item .env.example .env.local`). Define `GEOCODER_USER_AGENT` con un identificador de tu aplicación para las consultas de geocodificación. `NEXT_PUBLIC_USE_MOCKS=false` usa el flujo conectado; no se necesita una clave de NASA POWER.

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Para las comprobaciones del proyecto:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Documentación

- [Flujo de análisis en la interfaz](docs/frontend-analysis-flow.md)
- [Contrato de análisis, fuentes y limitaciones](docs/api-analysis.md)
- [Contrato de finca](docs/farm-contract.md)
- [Fuentes y estado del catálogo de cultivos](docs/crops-rubric.md)
- [Procedencia de las muestras de terreno](docs/srtm-samples.md)
- [Referencia visual](docs/design/DESIGN.md)

## English

Heimdall is an **agricultural decision-support prototype** for exploring crop rotations with historical NASA POWER climate data. Users select a farm location, provide priorities, and compare three rotation strategies with their supporting evidence, benefits, information gaps, and risks. The pilot focuses on Colombia's Coffee Region.

Results are preliminary: NASA POWER describes regional climate cells, crop scores are relative and not locally validated, and uniform climate scenarios are not forecasts. The interface is designed to show uncertainty and encourage local validation—not to prescribe a crop plan.

To run it, use Node.js 20+, then `npm ci`, create `.env.local` from `.env.example`, set an identifiable `GEOCODER_USER_AGENT`, and run `npm run dev`. NASA POWER requires no API key. See the Spanish documentation above for data sources, API contracts, and known limitations.

## Reconocimientos

Los datos climáticos proceden de [NASA POWER](https://power.larc.nasa.gov/); el mapa utiliza OpenStreetMap y las capas indicadas en la interfaz. La textura terrestre se basa en [NASA Blue Marble](https://svs.gsfc.nasa.gov/2915), acreditada en [su documentación](public/textures/README.md). Heimdall es un proyecto independiente y no implica respaldo de NASA.
