# Rúbrica de `data/crops.json` (BORRADOR)

> **Estado:** borrador preliminar para la demo. Los puntajes 0–5 son **calificaciones ordinales relativas entre estos 7 cultivos**, no mediciones. Ningún valor está validado por un agrónomo local. Antes de presentarlos como evidencia, hay que revisarlos.

## Cómo leer la escala

0 = nulo o mínimo, 5 = máximo dentro de este catálogo. Es relativa: un 5 en `droughtTolerance` significa "el más tolerante de los 7", no un umbral agronómico absoluto.

| Atributo | 5 significa | Qué la respalda |
| --- | --- | --- |
| `waterUse` | Muy alto consumo de agua | Rangos de lluvia de FAO EcoCrop y coeficientes de cultivo FAO donde se consultaron; el resto es juicio. |
| `nitrogenFixation` | Fijación de N muy alta | Rangos de kg N/ha de revisiones (Peoples, Carsky, UF/IFAS). Maíz y yuca: 0 (no fijan). |
| `erosionReduction` | Cobertura densa que frena la escorrentía | Ensayos de mucuna en Benín; el resto es juicio por tipo de cobertura. |
| `organicMatter` | Mucha biomasa que aporta al suelo | Biomasa t MS/ha de mucuna y crotalaria; el resto es juicio. |
| `forageValue` | Excelente como forraje | Solo juicio, sin fuente cuantitativa. |
| `marketPotential` | Mercado amplio y conocido | Solo juicio, **sin datos de mercado**. Pendiente: precios y área sembrada locales (UPRA, Agronet, FENALCE). |
| `heatTolerance` | Tolera mucho calor | Rangos de temperatura EcoCrop y FAO (maíz, soya, yuca, arveja); fríjol por literatura. |
| `droughtTolerance` | Tolera mucha sequía | Literatura cualitativa (yuca, crotalaria); mucuna tiene fuentes en conflicto. |
| `cycleDays` | Días de siembra a cosecha o corte | Cenicafé (maíz 145, fríjol 90), EcoCrop, FAO y estudios de biomasa. Es una cifra típica, no un dato local. |
| `sowingMonths` | Meses aptos | Marzo–abril y septiembre–octubre, de una fuente secundaria que **no** es Cenicafé ni FENALCE. Cenicafé señala febrero–marzo y julio–agosto como los periodos menos lluviosos y desaconseja sembrar fríjol o maíz en esos meses durante El Niño. |

## Fuentes consultadas y su estado

Las consulté por **búsqueda web y solo vi resúmenes**, no abrí las fichas completas. Hay que verificar cada cifra contra la fuente antes de citarla.

| Fuente | Respalda | Estado |
| --- | --- | --- |
| FAO EcoCrop, ids 238663 (maíz), 1150 (soya), 1420 (yuca) | Rangos de temperatura, lluvia y ciclo | Resumen de búsqueda; la tabla venía parcialmente ilegible. |
| FAO Land & Water, fichas de maíz, soya y arveja | Temperaturas óptimas, etapas y coeficientes | Resumen de búsqueda. |
| Peoples et al. 2009 (*Symbiosis*) y 2021 (*Plant and Soil*) | %Ndfa y kg N/ha de leguminosas | Resumen de búsqueda; no se leyó la tabla de 2009. |
| Carsky et al. 1998, vía revisión | Fijación de N de mucuna (<20 a >200 kg N/ha) | Citado de segunda mano. |
| UF/IFAS, ficha de sunn hemp | Biomasa y N de *C. juncea* | Resumen de búsqueda. |
| Estudio brasileño, *Pesq. Agropec. Trop.* 2020 | Biomasa máxima de crotalaria a los 135 días | Resumen de búsqueda. |
| El-Sharkawy y Cock 2012 | Tolerancia a sequía de la yuca | Resumen de búsqueda. |
| Cenicafé, publicaciones técnicas | Ciclo de maíz y fríjol intercalados con café; periodos menos lluviosos | Referencia puntual por confirmar. |

## Vacíos conocidos

- Sin datos de mercado: `marketPotential` es solo juicio.
- Sin tolerancia a heladas en el esquema (`Crop` no la tiene).
- No se verificó la idoneidad de cada cultivo a la altitud de Pereira (~1400 m); la soya y la arveja son las más dudosas.
- Calendario de siembra único para los 7 cultivos; falta un calendario real por cultivo y municipio.
- Fríjol: sin ficha EcoCrop consultada.
