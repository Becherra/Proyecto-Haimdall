# Guion de audio para grabar con tu voz

Cada fila es una frase **fija** (no cambia con los datos). Si grabas el archivo, la app reproduce tu voz;
si no existe, la lee con la voz en español del celular.

- Formato: `.mp3`, un archivo por frase.
- Nombre: exactamente el `id` de la tabla + `.mp3` (por ejemplo `clima-water.mp3`).
- Carpeta: `public/audio/`.
- Lee la frase tal cual está escrita, con calma y sin música de fondo.

Las frases que dependen de los datos de cada finca (por qué se sugiere una rotación, beneficios, riesgos, vacíos de información,
cuántos días de calor hubo, qué meses llueve más) **no se pueden grabar de antemano**: siempre las lee la voz del celular.

| id | Texto a leer |
| --- | --- |
| `seccion-por-que` | ¿Por qué? |
| `seccion-datos` | Datos que lo respaldan |
| `seccion-bueno` | Lo bueno |
| `seccion-cuidado` | Cuidado con |
| `seccion-no-sabemos` | Lo que no sabemos |
| `seccion-tecnico` | Pregunta a un técnico |
| `texto-datos-nasa` | Usamos datos de la NASA de los últimos años en tu zona: lluvia, temperatura y humedad de la tierra. |
| `clima-water` | ¿Alcanza el agua? Compara la lluvia que cae con el agua que se pierde por el calor y el viento. Si se pierde más de la que cae, a los cultivos les puede faltar agua. |
| `clima-heat` | ¿Hace mucho calor? Cuenta los días en que el calor fue tan fuerte que puede dañar los cultivos. |
| `clima-frost` | ¿Hay heladas? Cuenta los días en que hizo tanto frío que el hielo puede quemar las plantas. |
| `clima-rain` | ¿Llueve muy fuerte? Dice cuánta lluvia en un solo día se considera muy fuerte. Esas lluvias pueden arrastrar la tierra. |
| `clima-temperature` | ¿Qué tan cálido es? Es el promedio de la temperatura de todo el día y toda la noche. |
| `clima-roots` | ¿Está húmeda la tierra? Es qué tan mojada está la tierra donde llegan las raíces. Se mide por satélite para toda la zona, no solo para tu terreno. |
| `clima-calendario-lluvia` | Calendario de lluvia. Las gotas muestran cuánto suele llover cada mes. Una gota es poca lluvia y tres gotas es mucha lluvia. Sirve para saber cuándo sembrar. |
