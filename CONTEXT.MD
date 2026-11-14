# CONTEXT.md — Proyecto Heimdall · NASA Space Apps 2026

## 1. Datos del equipo

- **Equipo:** Heimdall (1 integrante: Steven)
- **Evento local:** Medellín (participación virtual)
- **Reto:** Desplazamiento de campo: Adaptando granjas con datos de la NASA
- **Perfil del dev:** Estudiante de Ingeniería de Sistemas (UTP, Pereira). Fuerte en C y Python, experiencia con Next.js/TypeScript/Tailwind, HTML/JS. Habla español, estilo directo.
- **Restricción:** Solo herramientas gratuitas (sin planes pagos de IA). Se rota entre Claude web, Codex, Cursor y Antigravity según cuota.

## 2. Objetivo del producto

Herramienta de **apoyo a la decisión** (no reemplaza al agricultor ni al agrónomo) que:

1. Toma la ubicación del agricultor y sus prioridades.
2. Trae datos históricos NASA del lugar.
3. Calcula indicadores de clima, agua y estrés.
4. Compara **mínimo 3 estrategias de rotación** (la actual + 2 alternativas).
5. Para cada una explica: **por qué se sugiere, qué evidencia la respalda, beneficios, vacíos de información y riesgos que requieren validación local.**

**Regla de oro:** la honestidad sobre la incertidumbre es parte del entregable. Siempre mostrar vacíos y qué debe validar un experto local.

## 3. Criterios de evaluación (lo que pesa)

Impacto · Creatividad · Uso real y claro de datos NASA · Relevancia al reto · Presentación (video/pitch).
Prioridad: **demo funcional con datos reales + buen video**, no código enorme.

## 4. Stack (decidido)

| Capa                   | Herramienta                                                       | Nota                                     |
| ---------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| Frontend               | Next.js + TypeScript + Tailwind                                   | Ya lo domina (proyecto Lunes)            |
| Mapa                   | Leaflet + OpenStreetMap                                           | Sin API key                              |
| Gráficas               | Recharts                                                          | Series de lluvia/temperatura             |
| Datos clima            | **NASA POWER API**                                                | Gratis, sin autenticación                |
| Datos extra (opcional) | MODIS NDVI / SMAP precargados                                     | Muestras de zona piloto en JSON estático |
| Lógica IA              | Motor de puntuación por reglas + explicación en lenguaje sencillo | Explicable, sin caja negra               |
| Deploy                 | Vercel o Firebase Hosting + dominio GoDaddy gratis                | Solo al final                            |
| Control de versiones   | Git + GitHub, commits pequeños                                    | Desde el minuto uno                      |

Meteomatics (opcional): solo si sobra tiempo, para pronóstico/datos finos. Pide tarjeta para verificar.

## 5. Datos NASA

### NASA POWER (columna vertebral)

Endpoint de ejemplo (Pereira, 2015–2024):

```
https://power.larc.nasa.gov/api/temporal/daily/point
  ?parameters=T2M,T2M_MIN,T2M_MAX,PRECTOTCORR,ALLSKY_SFC_SW_DWN,EVLAND,GWETROOT
  &community=AG
  &latitude=4.8133&longitude=-75.6961
  &start=20150101&end=20241231
  &format=JSON
```

| Parámetro               | Significado                     | Uso                                       |
| ----------------------- | ------------------------------- | ----------------------------------------- |
| T2M / T2M_MIN / T2M_MAX | Temperatura a 2 m               | Estrés térmico, riesgo de heladas         |
| PRECTOTCORR             | Precipitación corregida         | Estacionalidad, sequías, lluvias extremas |
| EVLAND                  | Evaporación terrestre           | Demanda de agua                           |
| GWETROOT                | Humedad de zona radicular (0–1) | Proxy de humedad del suelo                |
| ALLSKY_SFC_SW_DWN       | Radiación solar                 | Potencial de crecimiento                  |

Ojo: el valor `-999` significa dato faltante. Filtrarlo siempre.

### Opcionales (precargados, no en vivo)

- **MODIS/Landsat NDVI:** estrés/vigor vegetal.
- **SMAP:** humedad del suelo (resolución gruesa, aclarar limitación).
- **SRTM:** elevación y pendiente (riesgo de erosión).

Estrategia: descargar muestras de zona piloto (Eje Cafetero) y guardarlas en `/data/`. No depender de APIs pesadas en vivo durante la demo.

## 6. Indicadores calculados

- **Déficit hídrico mensual:** lluvia − evaporación.
- **Estacionalidad:** meses húmedos vs secos (detectar ventanas de campo vacío).
- **Estrés térmico:** días sobre umbral de temperatura máxima.
- **Riesgo de helada:** días con T2M_MIN bajo umbral (relevante en zonas altas).
- **Lluvia extrema:** percentil 95 de precipitación diaria (riesgo de erosión).
- **Humedad de suelo:** media y anomalía mensual (GWETROOT).

## 7. Prioridades del agricultor (entradas del usuario)

Sliders o selección: ahorrar agua · ingresos extra · mejorar suelo · reducir erosión · bajo riesgo/mercado conocido.
Restricciones opcionales: disponibilidad de agua, equipo, preferencia de mercado.

## 8. Rotaciones a comparar (versión inicial)

1. **Actual (línea base):** la que declara el agricultor (por defecto: monocultivo/maíz–descanso).
2. **Con leguminosa fijadora de N:** maíz → frijol/soya/arveja → maíz.
3. **Cobertura + tolerante a sequía:** cultivo principal + abono verde (mucuna/crotalaria) + cultivo de raíz profunda o resistente.

Cada cultivo en `/data/crops.json` con atributos 0–5: uso de agua, fijación de N, reducción de erosión, materia orgánica, valor forraje, potencial de mercado, tolerancia a calor, tolerancia a sequía, ciclo (días), meses de siembra aptos.

## 9. Lógica de puntuación (explicable)

```
score_rotación = Σ (peso_prioridad_i × puntaje_criterio_i) − penalizaciones_riesgo
```

- Los pesos vienen de las prioridades del usuario.
- Los puntajes de criterio combinan atributos del cultivo con indicadores climáticos del sitio (ej.: déficit hídrico alto penaliza cultivos de alto uso de agua).
- Cada puntaje devuelve una **razón en texto** ("Suma +2 en agua porque el déficit en jul–ago es alto y este cultivo tolera sequía").
- Salida por rotación: puntaje, por qué, evidencia (qué dato NASA), beneficios, **vacíos de información**, **riesgos / validar con agrónomo local**.

## 10. Estructura sugerida del repo

```
heimdall/
├─ CONTEXT.md
├─ README.md
├─ data/
│  ├─ crops.json
│  └─ samples/            # NDVI/SMAP precargados
├─ src/
│  ├─ app/                # páginas Next.js
│  ├─ components/         # Mapa, Prioridades, TarjetaRotacion, Graficas
│  ├─ lib/
│  │  ├─ nasaPower.ts     # fetch + limpieza de datos
│  │  ├─ indicators.ts    # déficit, heladas, estrés térmico...
│  │  └─ scoring.ts       # motor de puntuación explicable
│  └─ types/
└─ docs/                  # guion del pitch, capturas
```

## 11. Plan de trabajo (solo dev)

| Bloque               | Meta                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Antes de empezar** | Leer Guía de presentación y Guía de evaluación. Probar NASA POWER con Pereira. Crear repo + este archivo. Entrar a Space Apps Connect. |
| **Día 1 mañana**     | Next.js base, mapa Leaflet, fetch de NASA POWER funcionando                                                                            |
| **Día 1 tarde**      | `indicators.ts` + gráficas de clima                                                                                                    |
| **Día 1 noche**      | `crops.json` + `scoring.ts` con 3 rotaciones                                                                                           |
| **Día 2 mañana**     | UI de prioridades, tarjetas de rotación con evidencia/vacíos/riesgos                                                                   |
| **Día 2 tarde**      | Deslizador de escenarios (+calor, −lluvia), pulido, deploy                                                                             |
| **Últimas 4–5 h**    | Video demo, descripción del proyecto, envío. **No tocar código nuevo.**                                                                |

## 12. Reglas para trabajar con las IAs

1. Siempre pegar este `CONTEXT.md` al iniciar un chat nuevo.
2. Una tarea por prompt, pequeña y con criterio de "listo".
3. Commit después de cada tarea que funcione.
4. Si una herramienta se queda sin cuota, pasar a otra con el mismo contexto.
5. Reparto sugerido: **Claude web** = arquitectura, lógica de puntuación, `crops.json`, textos y pitch. **Cursor/Codex/Antigravity** = implementación y bugs.
6. No inventar datos. Todo número mostrado debe venir de NASA o de `crops.json` con fuente.

## 13. Decisiones tomadas

- [x] Herramienta web con mapa y comparador de rotaciones.
- [x] NASA POWER como fuente principal en vivo.
- [x] Puntuación por reglas explicable, sin entrenar modelos.
- [x] Zona piloto: Eje Cafetero (Pereira).
- [ ] Cultivo base de la rotación "actual" por defecto.
- [ ] Lista final de cultivos en `crops.json`.
- [ ] Qué datos opcionales (NDVI/SMAP) alcanzan a integrarse.

## 14. Entregables finales (confirmar en la Guía de presentación)

- [ ] Proyecto/enlace desplegado
- [ ] Video demo
- [ ] Descripción del proyecto
- [ ] Lista de datos NASA usados y cómo
- [ ] Mención de herramientas de IA usadas (transparencia)

## 15. Mensaje clave del pitch

"Una herramienta que convierte datos de la NASA en opciones de rotación comprensibles para el agricultor, mostrando evidencia, beneficios, vacíos de datos y qué debe validar un experto local. Apoya la decisión; no la reemplaza."
