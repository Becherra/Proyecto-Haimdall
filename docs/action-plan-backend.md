# Plan inicial de ejecución — integración con Santi

## Contrato

`POST /api/analysis` acepta `cropProfile?: CropProfileSelection`, con los ids del catálogo existente. Ejemplo de perfil: `{ "cropId": "cafe", "cultivarId": "unknown", "stageId": "produccion" }`. Debe coincidir con `priorities.currentCropId`; un perfil inexistente o incompatible devuelve 400 antes de consultar fuentes. `unknown` conserva su significado de información desconocida.

Cada `rotations[]` contiene `actionPlan` (opcional en Zod para admitir respuestas antiguas). Se mantienen los estados del plan `ready | partial | insufficient`, de las acciones `ready | missing-data | insufficient-evidence`, y las etapas `understand | prepare | monitor | review`.

Se añaden campos opcionales a las acciones: `ruleId`, `instructions`, `risks`, `limitations`. El generador siempre los entrega. `evidence.reference` identifica página o sección. El id de acción combina alternativa, regla versionada y paso. No se modifican los puntajes.

El frontend debe mostrar las instrucciones solo para acciones `ready`, explicar `missingData` en las bloqueadas, mostrar `gaps` incluso si no hay acciones y tolerar etapas vacías. `partial` significa que hay algún paso utilizable, con trabajo o evidencia pendientes. `ready` describe respaldo y requisitos, nunca tarea completada ni resultado garantizado.

No existe persistencia ni `progress`, notas, fechas de ejecución o endpoints de seguimiento. Repetir el análisis genera el plan inicial. La comprobación del paso se explica en `verification`, pero no se recoge todavía. Las respuestas con `scenario` no neutral devuelven plan insuficiente: un escenario hipotético no activa instrucciones de campo.

## Fuente verificada y alcance

Se abrió el PDF original de Cenicafé, *Boletín Agrometeorológico Cafetero, edición El Niño 2026*, página 5, apartado «En la cosecha y poscosecha»: https://publicaciones.cenicafe.org/index.php/boletin_agrometeorologico/article/download/5106/5976 . Revisión: 2026-11-15. Se utilizan únicamente la observación de maduración y la selección de frutos maduros. No se usa su pronóstico como si siguiera vigente ni sus tratamientos o dosis. La verificación mediante descripción del fruto es una instrucción de registro del producto, no un protocolo de muestreo validado.

Regla `coffee-production-dry-observation-v1`: café declarado en producción, dentro del rectángulo piloto ya definido en `SOWING_CALENDAR_REGION`, y `currentSeason.status` seco o muy seco calculado por el backend con NASA POWER. Esta combinación es una regla conservadora de selección del producto, no un modelo agronómico validado. Activa observación, no atribuye efectos a ENSO ni confirma estrés en la finca. La madurez real sigue ausente: la decisión de cosecha queda bloqueada.

El catálogo versionado está en `data/action-plan-rules.json`, validado con Zod. No se consulta internet desde el generador puro. Cada salida conserva la publicación, página, ámbito, señal regional y declaración que activaron el paso. Variedad y síntomas no se interpretan ni producen diagnósticos; se valida su pertenencia al perfil.

## Límites deliberados

- Plátano: el capítulo AGROSAVIA `https://hdl.handle.net/20.500.12324/39751` no pudo abrirse en esta revisión. El catálogo previo contiene referencias, pero no se promovieron a acciones ejecutables sin revisar el original. Devuelve `insufficient`.
- Café en otras etapas, fuera de cobertura, sin perfil o sin señal seca reciente: plan insuficiente con explicación. Esto no indica que la finca esté libre de riesgos.
- La misma práctica del café actual puede aparecer en varias alternativas. Los ids son diferentes por alternativa, pero `ruleId` permite reconocerla. No es un itinerario completo para establecer los cultivos asociados; ese vacío se declara.
- IDEAM se consulta por una vía separada y todavía no alimenta este motor. No se recibe una alerta declarada por el cliente como evidencia oficial.
- No hay frecuencia inventada, dosis ni rendimiento prometido. Falta validación agronómica y de uso en campo.

## Comprobación

`tests/action-plan-generation.test.ts` verifica activación, bloqueo por madurez pendiente, ausencia de etapa o señal, fuera de cobertura, escenarios, plátano sin respaldo, determinismo y separación entre declaración y diagnóstico. `tests/action-plan-api.test.ts` comprueba respuesta, compatibilidad, invariancia de puntajes y rechazo antes de fetch. Todas las pruebas usan datos locales.

Para Santi: enviar el perfil junto a la solicitud actual y leer `response.rotations[i].actionPlan`. Probar primero un perfil desconocido (debe mostrar el vacío) y luego café en producción; las instrucciones solo aparecen si el clima reciente calculado activa la regla. No forzar una señal seca para la demo. El ejemplo JSON adjunto es reproducible con contexto sintético y está identificado como tal; no es una medición real.
