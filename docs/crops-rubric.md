# Rúbrica de `data/crops.json` (BORRADOR)

> **Estado:** borrador preliminar para la demo. Los puntajes 0–5 son **calificaciones ordinales relativas entre estos 12 cultivos**, no mediciones. Ningún valor está validado por un agrónomo local. Antes de presentarlos como evidencia, hay que revisarlos.

## Cómo leer la escala

0 = nulo o mínimo, 5 = máximo dentro de este catálogo. Es relativa: un 5 en `droughtTolerance` significa "el más tolerante de los 10", no un umbral agronómico absoluto.

| Atributo | 5 significa | Qué la respalda |
| --- | --- | --- |
| `waterUse` | Muy alto consumo de agua | Rangos de lluvia de FAO EcoCrop y coeficientes de cultivo FAO donde se consultaron; el resto es juicio. |
| `nitrogenFixation` | Fijación de N muy alta | Rangos de kg N/ha de revisiones (Peoples, Carsky, UF/IFAS). Maíz y yuca: 0 (no fijan). |
| `erosionReduction` | Cobertura densa que frena la escorrentía | Ensayos de mucuna en Benín; el resto es juicio por tipo de cobertura. |
| `organicMatter` | Mucha biomasa que aporta al suelo | Biomasa t MS/ha de mucuna y crotalaria; el resto es juicio. |
| `forageValue` | Excelente como forraje | Solo juicio, sin fuente cuantitativa. |
| `marketPotential` | Mercado amplio y conocido | Solo juicio, **sin datos de mercado**. Pendiente: precios y área sembrada locales (UPRA, Agronet, FENALCE). |
| `heatTolerance` | Tolera mucho calor | Rangos de temperatura EcoCrop y FAO (maíz, soya, yuca, arveja, papa, repollo); avena por Feedipedia; fríjol por literatura. |
| `droughtTolerance` | Tolera mucha sequía | Literatura cualitativa (yuca, crotalaria); mucuna tiene fuentes en conflicto. |
| `family` | (no es puntaje) Familia botánica en español | Taxonomía estándar: maíz y avena son gramíneas; fríjol, soya, arveja, mucuna y crotalaria, leguminosas; yuca, euforbiácea; papa, solanácea; repollo, crucífera. El motor la usa para penalizar relevos seguidos de la misma familia. |
| `perennial` | (no es puntaje) Cultivo permanente (café, plátano) | Decisión de diseño: ocupa el lote todo el año, no se rota ni tiene meses de siembra y **solo se ofrece como cultivo actual del agricultor, nunca como sugerencia** (sembrar uno es una inversión de años que esta herramienta no debe recomendar). |
| `intercropsWith` | (no es puntaje) Ids de permanentes con los que un anual se puede asociar en las calles | Solo maíz y fríjol, con café (Cenicafé, resumen de búsqueda, y FAO EcoCrop para fríjol) y con plátano (solo la ficha genérica Musa sp. de EcoCrop). Un permanente propone únicamente estos anuales. |
| `temperatureC` | (no es puntaje) Temperatura media diaria: rango en que crece bien (`goodMin`–`goodMax`) y límites (`limitMin`, `limitMax`) | Fichas FAO Land & Water archivadas (maíz, fríjol, soya, arveja, papa, repollo), Tropical Forages (mucuna), EcoCrop y Feedipedia (yuca), Feedipedia y ensayos de AGROSAVIA (avena), Feedipedia (crotalaria). Un extremo ausente significa que la fuente no lo da. |
| `frostToleranceC` | (no es puntaje) Helada corta más fría que soporta | Repollo (−6 °C, FAO) y crotalaria (−2 °C, Feedipedia). Los demás no tienen cifra en su fuente y el motor los trata como sin tolerancia documentada. |
| `cycleDays` | Días de siembra a cosecha o corte | Cenicafé (maíz 145, fríjol 90), EcoCrop, FAO y estudios de biomasa. Es una cifra típica, no un dato local. |
| `sowingMonths` | Meses aptos | Marzo–abril y septiembre–octubre, de una fuente secundaria que **no** es Cenicafé ni FENALCE. Cenicafé señala febrero–marzo y julio–agosto como los periodos menos lluviosos y desaconseja sembrar fríjol o maíz en esos meses durante El Niño. |

## Fuentes consultadas y su estado

Las de los 7 cultivos iniciales las consulté por **búsqueda web y solo vi resúmenes**, no abrí las fichas completas. Hay que verificar cada cifra contra la fuente antes de citarla. Las tres de la primera ampliación (papa, avena, repollo) sí se leyeron en texto completo; su estado lo dice la tabla.

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
| FAO Land & Water, fichas de papa y repollo | Temperatura óptima, ciclo, agua requerida, profundidad de raíz, rotación recomendada, heladas (solo repollo) | **Leídas completas** en la copia de web.archive.org (capturas de 2024): FAO retiró las páginas y hoy dan error 404. |
| FAO Land & Water, fichas de maíz, soya, fríjol y arveja | Temperaturas (óptimo, mínimo, máximo), sensibilidad a heladas | **Leída** la sección de clima de cada una en web.archive.org (capturas de 2023). |
| Tropical Forages, fichas de *Mucuna pruriens* y *Crotalaria juncea* | Temperatura óptima de mucuna (19–27 °C), heladas, lluvia, biomasa | **Leídas** las secciones de temperatura, humedad y materia seca. La de crotalaria no trae cifras de temperatura. |
| Feedipedia, ficha de sunn hemp (nodo 313) | Temperatura media de las zonas donde se cultiva la crotalaria, helada que soporta, lluvia mínima, N fijado | **Leída** por extracción automática; las cifras de India y Brasil no traen cita en la página. |
| Feedipedia, ficha de raíces de yuca (nodo 527) | Óptimo de temperatura, altitud, lluvia, tolerancia a sequía | **Leída** la parte de clima. |
| Feedipedia, ficha de avena forrajera (nodo 500) | Rango de temperatura y lluvia, altitud en el trópico, biomasa, uso como cobertura, valor nutritivo | **Leída** hasta la tabla de ensilaje; el final de la página no se revisó. |
| Campuzano-Duque et al. 2020, *Agronomía Mesoamericana* 31(3):581–595, AGROSAVIA | Días a cosecha de forraje verde de la avena Altoandina y altitud de los ensayos | **Leído** el texto; los cuadros son imágenes y no se leyeron. |
| FAO EcoCrop, Coffea arabica (id 749) | Temperatura, lluvia, altitud máxima, pH y ciclo del café; cultivos en callejones (fríjol, yuca, plátano) | **Leída completa** de la ficha (dos lecturas independientes coinciden). |
| FAO EcoCrop, Musa acuminata x balbisiana (id 7849) y Musa sp. (id 2483) | Temperatura, lluvia, altitud máxima y ciclo del plátano AAB; asociación con café joven y cultivos anuales; sensibilidad a granizo, viento y sequía | **Leídas completas.** Ojo: la ficha id 1506, que algunas búsquedas devuelven como banano, es abacá (*Musa textilis*) y no se usó. |
| Cayón et al. 2004, *Agronomía Colombiana* 22(1) | Ensayo del plátano Dominico-Hartón en Montenegro (Quindío), 1.310 m, 1.985 mm/año, densidades de 1.500 a 3.000 plantas/ha | **Solo el resumen**; el PDF completo no se pudo leer. |
| Cenicafé (agroclimatología del café; cultivos intercalados en establecimiento y renovación por zoca; coberturas nobles) y UPRA/Cenicafé (altitud del plátano) | Café entre 17 y 23 °C de media en la mayor parte de Colombia; fríjol y maíz intercalados el primer año; plátano Dominico-Hartón por debajo de 1.500–1.600 m | **Resumen de búsqueda: no se abrió ningún documento.** Desde este entorno los PDF de Cenicafé dieron error 404 o no resolvieron el dominio. Verificar cada cifra contra la fuente antes de citarla. |

## Vacíos conocidos

- Sin datos de mercado: `marketPotential` es solo juicio.
- Sin tolerancia a heladas en el esquema (`Crop` no la tiene).
- No se verificó la idoneidad de cada cultivo a la altitud de Pereira (~1400 m); la soya y la arveja son las más dudosas.
- Calendario de siembra único para los 10 cultivos anuales; falta un calendario real por cultivo y municipio. Para papa, avena y repollo no se encontró ninguna fuente de fechas de siembra en el Eje Cafetero: el boletín agroclimático de Agronet para Caldas trae un calendario de siembra y cosecha, pero el PDF no se pudo abrir.
- Papa, avena y repollo son de clima frío: sus fuentes hablan de zonas altas (la avena, sobre 2000 m) y no se verificó que se den a la altitud de Pereira (~1400 m). Sirven para fincas altas de la región, no para la zona cafetera media.
- Tolerancia a heladas: solo repollo (−6 °C por poco tiempo) y crotalaria (−2 °C) tienen cifra; las fichas de papa y avena no dicen nada.
- La aptitud térmica compara el rango del cultivo con la temperatura media de la celda de NASA POWER (unos 50 km). En montaña esa celda mezcla altitudes: la de Pereira está a 2138 m y promedia 16,3 °C, mientras la ciudad está cerca de 1400 m. La temperatura se corrige con la altitud del lote (la que declara el agricultor o una estimación de referencia de la zona, no una lectura de SRTM) usando un gradiente promedio de 0,6 °C por cada 100 m, también para mínimas, máximas y evaporación; ese gradiente es un supuesto.
- El rango bueno de la avena sale de los sitios de ensayo colombianos y el de la crotalaria de las zonas donde se cultiva: ninguno es un óptimo medido. El del maíz no tiene máximo porque su ficha no lo da.
- La familia botánica (`family`) solo permite una regla general: alternar familias corta ciclos de plagas. No hay datos de plagas ni enfermedades locales, y la regla no distingue plagas que atacan a varias familias.
- Fríjol: sin ficha EcoCrop consultada.
- Café y plátano (cultivos permanentes): no se verificó la altitud recomendada en Colombia (EcoCrop solo da un máximo absoluto de 2800 m para el café y 2400 m para el plátano; la fuente colombiana vista en resumen recomienda el plátano por debajo de unos 1.500–1.600 m). El rango de temperatura del café es el óptimo de EcoCrop (14–28 °C), mucho más ancho que el 17–23 °C de Cenicafé que describe dónde se cultiva. El mínimo bueno del plátano (21 °C) sale de un sitio de cultivo colombiano, porque el óptimo de EcoCrop (25–35 °C) describe tierras bajas.
- Asociación con un permanente: el puntaje promedia los dos cultivos como si compartieran el lote el mismo tiempo, pero el anual solo está el primer año (establecimiento o renovación por zoca); puede subestimar la asociación. No hay calendario para permanentes, ni datos de competencia, sombrío, renovación, plagas (nematodos, broca) ni de manejo de arvenses.
- La interfaz todavía no ofrece café ni plátano como opción de cultivo actual (hacen falta sus iconos en `PrioritiesSlides`); la API sí los acepta con `currentCropId: "cafe"` o `"platano"`.
