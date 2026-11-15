# Contrato `Farm` para backend

`Farm` describe el punto de análisis y, si se conoce, el terreno que el usuario dibujó o estimó. El cliente valida la forma con Zod (`farmSchema`) y la geometría con `validateTerrain`; el servidor debe validar de nuevo todo dato recibido.

## Ejemplos válidos

Punto seleccionado por búsqueda:

```json
{
  "centroid": { "lat": 4.8133, "lon": -75.6961 },
  "locationSource": "search",
  "placeLabel": "Pereira, Risaralda, Colombia",
  "terrain": { "kind": "point" }
}
```

Tamaño aproximado elegido manualmente (2.5 ha exactas, sin rango):

```json
{
  "centroid": { "lat": 4.8133, "lon": -75.6961 },
  "locationSource": "map",
  "placeLabel": "Vereda de Pereira",
  "terrain": { "kind": "approx_size", "areaHa": 2.5 }
}
```

Polígono de aproximadamente una hectárea. GeoJSON usa `[longitud, latitud]` y el último punto repite el primero:

```json
{
  "centroid": { "lat": 4.8133, "lon": -75.6961 },
  "locationSource": "gps",
  "placeLabel": "Finca cerca de Pereira",
  "accuracyM": 42,
  "terrain": {
    "kind": "polygon",
    "areaHa": 1,
    "ring": [
      [-75.6965507452, 4.8128508444],
      [-75.6956492548, 4.8128508444],
      [-75.6956492548, 4.8137491556],
      [-75.6965507452, 4.8137491556],
      [-75.6965507452, 4.8128508444]
    ]
  }
}
```

## Reglas de validación

- `centroid.lat` está entre -90 y 90; `centroid.lon`, entre -180 y 180. `locationSource` es `gps`, `search` o `map`; `accuracyM` solo corresponde a `gps`.
- `point` no afirma un área. `approx_size.areaHa` debe estar entre 0.01 y 10.000 ha. Si hay `areaRangeHa`, debe ser uno de los rangos admitidos y `areaHa` su punto medio; el área manual exacta no lleva rango. Sobre 1.000 ha se emite una advertencia.
- Un polígono es un anillo cerrado con al menos tres vértices, posiciones `[lon, lat]`, sin auto-intersecciones ni cruce del antimeridiano; se rechaza por encima de 85° de latitud. Área mínima 0.01 ha, máxima 10.000 ha y el área enviada debe concordar dentro del 1 %.
- El backend debe recomputar el área desde el anillo y no confiar en `areaHa`; debe calcular/usar el centroide para consultar NASA POWER. `point` y `approx_size` son vacíos de información sobre límites reales del lote, y el tamaño aproximado no se debe tratar como medición.

## NASA POWER y límites espaciales

El polígono y el área de `Farm` no cambian la resolución de los datos climáticos de NASA POWER. La documentación del servicio indica que POWER combina productos con distintas resoluciones; la meteorología tiene una malla nativa de 0.5° × 0.625° y la radiación solar de 1°. El endpoint diario mantiene la resolución del producto de origen. Mostrar siempre que el clima es regional y verificar la resolución concreta de cada parámetro antes de atribuirla al lote. Fuentes: [documentación de servicios](https://power.larc.nasa.gov/docs/services/), [metodología](https://power.larc.nasa.gov/docs/methodology/) y [fuentes meteorológicas](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/).

Como referencia de volumen: una lámina de 1 mm sobre 1 ha equivale a 10 m³ de agua (`0.001 m × 10,000 m²`). Es una conversión geométrica, no una estimación de disponibilidad o consumo del cultivo.

## Mensaje listo para Santi

> El frontend ya puede entregar un `Farm` validado en memoria: `centroid`, `locationSource`, `placeLabel` opcional, `accuracyM` opcional y `terrain` (`point`, `approx_size` o polígono GeoJSON). Al recibirlo, valida el contrato otra vez, recomputa el área del polígono y usa `farm.centroid` para NASA POWER. El área/contorno no aumenta la resolución climática: `point` y `approx_size` deben conservarse como incertidumbre y no como medición del lote. Contrato y ejemplos: `docs/farm-contract.md`.
