# Frontend: finca → análisis

Esta nota resume el flujo que quedó conectado en la interfaz para que backend y frontend puedan continuar desde el mismo contrato. El contrato completo y sus límites están en [`api-analysis.md`](./api-analysis.md); sus esquemas Zod en `src/types/index.ts` son la fuente de verdad.

## Flujo de pantalla

1. La persona busca un lugar o usa su ubicación y ajusta el pin en el mapa.
2. Puede elegir solo el punto, un área aproximada o dibujar el contorno. En el dibujo, toca el mapa para añadir al menos tres vértices, puede arrastrarlos y debe pulsar **Terminar** para cerrar y validar el área. El botón de confirmación explica qué falta cuando está deshabilitado.
3. Al confirmar, la interfaz conserva un objeto `Farm` y muestra el formulario de prioridades: cultivo actual, disponibilidad de agua y cinco prioridades de 0 a 5. Altitud y pendiente son opcionales.
4. **Ver análisis de mi finca** envía la solicitud al endpoint del mismo proyecto. La pantalla del mapa se desmonta durante el análisis para no cubrir el formulario ni sus resultados.
5. El panel presenta el origen de los datos, periodo, indicadores, climatología mensual y tres rotaciones. Cada rotación incluye beneficios, evidencia, vacíos, riesgos y qué validar con una persona experta local.

## Llamada al backend

`src/services/analysis.ts` construye y valida el contrato `AnalysisRequest`, y hace `POST /api/analysis`. Envía `farm` (incluidos centroide, procedencia y terreno), prioridades y el periodo de referencia 2020–2022; también envía `lat` y `lon` del centroide por compatibilidad. No solicita `includeDailyRecords`, así que se mantiene la respuesta ligera. La respuesta se valida con `analysisResponseSchema` antes de mostrarla.

El route handler `src/app/api/analysis/route.ts` consulta NASA POWER y ejecuta el análisis del backend. La interfaz no calcula puntajes ni recomienda rotaciones. `src/lib/ui/monthlyClimateSummary.ts` solo agrupa el `monthlyClimate` ya recibido para dibujar el promedio por mes.

Los controles de escenario envían otra solicitud a `/api/analysis` con `scenario`; no representan pronósticos. Si se usa el modo mock, los escenarios quedan desactivados porque el mock es estático y no simula un recálculo.

## Probarlo

1. Ejecuta `npm run dev` y abre `http://localhost:3000`.
2. Busca Pereira, confirma el punto (o dibuja y termina un terreno), completa prioridades y pulsa **Ver análisis de mi finca**.
3. En DevTools → Network, verifica `POST /api/analysis`, su respuesta `200` y el campo `climate.source`. La UI lo rotula como NASA POWER en vivo (`live`), caché (`cache`) o muestra (`sample`). Para usar el mock del frontend, configura `NEXT_PUBLIC_USE_MOCKS=true` en `.env.local` y reinicia el servidor.

## Límites que deben conservarse

- Los valores NASA POWER describen una celda climática regional; dibujar un lote no mejora la resolución del clima.
- La respuesta de muestra sirve para avanzar la interfaz y debe identificarse como demostración. No presenta resultados simulados como observaciones en vivo.
- Las recomendaciones apoyan la decisión, no la reemplazan. Mantener visibles la evidencia, los vacíos de información y los riesgos que debe validar un experto local.
