# Perfiles de cultivo y sanidad vegetal (piloto café y plátano)

Revisión de fuentes: 2026-11-15. Catálogo: `data/crop-profiles.json` (`schemaVersion: 1`).
Contrato: `src/types/cropProfile.ts`. Lógica: `src/lib/cropProfiles.ts` y `src/lib/cropHealthNotes.ts`.

Este módulo **no** está conectado a la puntuación climática ni a la capa ENSO. Solo describe el cultivo
que declara el agricultor y lo que dicen las fuentes, y marca lo que no sabemos.

## 1. Modelo de datos

| Entidad | Qué guarda | Regla de honestidad |
| --- | --- | --- |
| `CropProfile` | `cropId` (de `crops.json`), nombre científico, nombres comunes, ámbito | Un perfil por especie; café y plátano separados |
| `Cultivar` | variedad o clon, propagación, atributos, regiones, respuesta a cada amenaza | Regiones y respuestas pueden ser `undocumented` |
| `PlantingMaterial` | colino, cormo, plántula, vitroplanta | Solo los descritos por una fuente |
| `GrowthStage` | etiqueta sencilla + nombre técnico | Solo etapas con fuente |
| `ThreatProfile` | agentes, tipo, relevancia en Colombia, ámbito, síntomas, condiciones, norma, medidas | `requiresOfficialConfirmation` obligatorio si hay norma |
| `ManagementMeasure` | acción, etapas, condición, motivo, verificación, fuentes | No existe la categoría «química» |

- Toda afirmación es un `Claim` con al menos una `SourceRef` (`sourceId` + página o sección).
- Un dato ausente es `{ "status": "undocumented", "reason": "…" }`: una ausencia explícita, no un cero.
- `parseCropProfileCatalog` falla al cargar si hay citas a fuentes inexistentes, cultivos que no están en
  `crops.json`, ids repetidos o reservados (`unknown`, `other`, `none`), o etapas y amenazas inexistentes.

## 2. Flujo

`¿Qué cultivo tienes?` → (solo café y plátano) `¿Qué variedad tienes?` → (solo plátano) `¿Con qué semilla
sembraste?` → `¿En qué etapa está?` → `¿Has visto algún problema?` (opcional) → agua → prioridades.

- Todas las preguntas tienen «No sé»; la variedad también tiene «Otra variedad», con nombre opcional.
- El problema se puede marcar o describir con texto libre (máx. 280 caracteres). El texto se muestra tal
  cual y **no se interpreta**.
- El panel siempre dice «posible … (sin confirmar)» y «Esto no es un diagnóstico». Si la amenaza tiene
  norma (moko), pide confirmar con el ICA o el extensionista y no aplicar productos ni arrancar plantas.
- No usa clima, ubicación ni NASA para inferir enfermedades.

## 3. Fuentes consultadas

| id | Institución | Documento | Fecha | Respalda | Limitaciones / licencia |
| --- | --- | --- | --- | --- | --- |
| cenicafe-at476 | Cenicafé | Avance Técnico 476, guía de variedades ([doi](https://doi.org/10.38141/10779/0476)) | 2017-02 | Variedades, porte, roya, semilla certificada ICA | Leído completo; tabla 2 ambigua al extraer; ©FNC-Cenicafé |
| cenicafe-at566 | Cenicafé | Avance Técnico 566, Castillo 2.0 ([doi](https://doi.org/10.38141/10779/0566)) | 2024-08 | Castillo 2.0, roya y lluvias, almácigo | Leído completo; licencia no indicada |
| cenicafe-at570 | Cenicafé | Avance Técnico 570, razas de roya ([doi](https://doi.org/10.38141/10779/0570)) | 2024-12 | Roya en estratos de la planta | Leído completo; no describe síntomas |
| cenicafe-brocarta45 | Cenicafé | Brocarta 45, vuelos de la broca ([doi](https://doi.org/10.38141/10785/045)) | sin fecha (datos 2011) | Broca: daño, temperatura, repase | Umbrales de la zona central y del sur |
| cenicafe-at531 | Cenicafé | Avance Técnico 531, dispersión de la broca ([doi](https://doi.org/10.38141/10779/0531)) | 2021-09 | Broca y zoca | Solo pp. 1–3 |
| ica-alerta-moko-uraba | ICA, MADR, AUGURA | Alerta temprana: moko en banano y plátano | 2022 | Síntomas, transmisión y prevención del moko | Ámbito: Urabá; no se usan sus medidas químicas |
| ica-res-092770-2021 | ICA | Resolución 092770 de 2021 | 2021-03-17 | Que el moko tiene medidas oficiales | **No leída** (enlace 404); citada vía la alerta |
| agrosavia-semilla-dh-2023 | AGROSAVIA | Manual de semilla de Dominico Hartón, cap. I ([hdl](http://hdl.handle.net/20.500.12324/39751)) | 2023 | Material de siembra, viveros ICA, prueba de moko | CC BY-NC-SA 4.0 |
| agrosavia-semilla-llanos-2019 | AGROSAVIA | Semilla de plátano en los Llanos ([hdl](http://hdl.handle.net/20.500.12324/35061)) | 2019 | Hartón, etapas, vitroplantas, plagas en semilla | CC BY-NC-SA 4.0; datos de los Llanos |
| agrosavia-sigatoka-1989 | Repositorio AGROSAVIA | Sandoval, sigatokas en plátano ([hdl](http://hdl.handle.net/20.500.12324/19168)) | 1989 | Síntomas y ciclo de la sigatoka negra | Escaneado; antiguo; autor de empresa de agroquímicos |
| agrosavia-mp-*-2021 | AGROSAVIA | Modelo productivo de plátano: sigatokas, moko, picudo, fenología | 2021 | Importancia de cada amenaza; ciclo del Hartón | Pódcasts no escuchados: solo el resumen |
| agrosavia-almacigo-dh-1994 | AGROSAVIA | Plántulas de Dominico-Hartón en almácigo ([hdl](http://hdl.handle.net/20.500.12324/16640)) | 1994 | Grupo Musa AAB | Solo título y resumen |

## 4. Accesos estructurados verificados (2026-11-15)

| Fuente | Acceso | Verificado | Uso posible |
| --- | --- | --- | --- |
| Repositorio AGROSAVIA | API REST DSpace 9.1 (`repository.agrosavia.co/server/api`) y OAI-PMH (`/server/oai/request?verb=Identify`) | Sí: responden; búsqueda y metadatos de ítems funcionan | Buscar y citar documentos; los contenidos son PDF, audio o video |
| datos.gov.co (Socrata) | API de catálogo | Sí: AGROSAVIA publica análisis de suelos y foliares (CC BY-SA 4.0); **el ICA no publica datos de plagas ni enfermedades** (búsquedas «moko», «roya café», «sanidad vegetal»: 0) | Ninguno para sanidad por ahora |
| Cenicafé | Revista OJS (`publicaciones.cenicafe.org`) | Los PDF descargan; `biblioteca.cenicafe.org` no resolvió por DNS; no se probó su OAI | Solo PDF; no es una API |
| ICA | Sitio web y PDF | Solo PDF y páginas; no se encontró API de vigilancia fitosanitaria | Ninguno |

No se automatizó ninguna descarga para el producto. El pie de página del repositorio de AGROSAVIA dice
«Todos los derechos reservados», mientras cada ítem declara una licencia Creative Commons: antes de
consumir su API en el producto hay que confirmar sus términos de uso.

## 5. Qué no se pudo comprobar

- Síntomas visibles de la roya: ninguna fuente leída los describe, así que quedan como `undocumented`.
- El texto de la Resolución ICA 092770 de 2021 y su alcance nacional.
- Fusarium R4T: no se incluyó. AGROSAVIA (2019) dice que no estaba en Colombia y no se verificaron
  las declaraciones posteriores del ICA. Antes de incluirlo hay que leer la fuente oficial y ubicarlo solo donde la sitúe.
- Otros plátanos (Dominico, África, FHIA) y la Castillo 2.0 como semilla certificada por el ICA.
- Etapa de café «joven sin cosecha» (levante): no hay fuente leída, así que el agricultor usa «No sé».
- Medidas culturales verificadas contra la sigatoka negra y un método de monitoreo de picudos.

## 6. Propuesta de integración (siguiente paso, no implementada)

1. Añadir `cropProfile?: CropProfileSelection` a `analysisRequestSchema`, como campo opcional, en un commit
   aparte de `src/types/`. Es compatible: los clientes actuales no lo envían.
2. En `/api/analysis`, validar con `selectionErrors` y devolver `cropHealth: CropHealthNotes` aparte de
   `rotations`. **No** tocar `scoring.ts`: la sanidad no suma ni resta puntaje.
3. En resultados, una tarjeta «Sanidad de tu cultivo» con el mismo panel, en la sección de vacíos y
   riesgos a validar con un agrónomo. Coordinar con quien mantiene `ResultsView` y con la capa ENSO.
4. Cualquier cruce futuro con clima (por ejemplo, broca y temperatura) debe ser una afirmación con fuente
   y ámbito, mostrada como contexto, nunca como diagnóstico.

## 7. Revisión manual

1. `npm run dev`, elige una ubicación y pulsa «Siguiente».
2. Elige **Café**: aparecen variedad, etapa y problema. Prueba «No sé» en todo: avanza sin bloquear.
3. Marca **Caturra → Cafetal dando cosecha → Roya del cafeto**: debe decir «posible roya … (sin confirmar)»,
   «Caturra está documentada como susceptible» con enlace a Cenicafé, y listar «Lo que no sabemos».
4. Vuelve atrás, elige **Plátano → Dominico Hartón → Colino → Creciendo → Moko**: debe aparecer el aviso
   rojo de la Resolución ICA 092770 pidiendo confirmación.
5. Elige **Maíz**: no debe aparecer ninguna pregunta extra.
