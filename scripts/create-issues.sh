#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) no está instalado." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: autentica GitHub CLI con 'gh auth login' antes de continuar." >&2
  exit 1
fi

ensure_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  if ! gh label list --limit 100 --json name --jq '.[].name' | grep -Fxq -- "$name"; then
    gh label create "$name" --color "$color" --description "$description"
  fi
}

ensure_label "track-A" "c5def5" "Pista A: motor, backend, datos y lógica"
ensure_label "track-B" "fbca04" "Pista B: experiencia, frontend, contenido y pitch"
ensure_label "track-C" "0e8a16" "Pista C: integración y entrega"
ensure_label "mvp" "d93f0b" "Tarea imprescindible para el MVP"

create_issue() {
  local id="$1"
  local name="$2"
  local track="$3"
  local priority="$4"
  local criterion="$5"
  local title="${id} · ${name}"
  local track_label="track-${track}"
  local body

  body=$(cat <<EOF
## Pista

Pista ${track}: ${track_label}

## Prioridad

${priority}

## Criterio de listo

${criterion}
EOF
)

  if gh issue list --state all --search "\"${title}\" in:title" --limit 100 --json title --jq '.[].title' | grep -Fxq -- "$title"; then
    echo "Omitido: ya existe '${title}'"
    return 0
  fi

  if [[ "$priority" == "MVP" ]]; then
    gh issue create --title "$title" --body "$body" --label "$track_label" --label "mvp"
  else
    gh issue create --title "$title" --body "$body" --label "$track_label"
  fi
  echo "Creado: ${title}"
}

while IFS='|' read -r id name track priority criterion; do
  [[ -z "$id" ]] && continue
  create_issue "$id" "$name" "$track" "$priority" "$criterion"
done <<'TASKS'
A1|indicators.ts|A|MVP|Tests con la fixture; cada indicador devuelve valor + cuántos datos faltaron
A2|detección de ventanas de campo vacío|A|Muy valioso|Función pura con tests; devuelve meses y razón
A3|scoring.ts|A|MVP|Cada puntaje trae su razón en texto; tests de casos extremos
A4|rotations.ts|A|MVP|Los 3 resultados salen con todos los campos llenos
A5|POST /api/analyze|A|MVP|Responde con el contrato AnalysisResponse; validación Zod; tests
A6|escenarios tempDelta/rainFactor|A|Extra|Test: +2 °C y −20 % lluvia cambian los puntajes de forma coherente
A7|datos opcionales precargados|A|Extra|Se integran como indicador extra con su propia nota de limitación
A8|cuadro de vacíos de información|A|Muy valioso|Texto consistente en todos los resultados
B1|data/crops.json|B|MVP|Validado con el esquema Zod Crop; test que lo carga
B2|página principal y diseño base|B|No clasificada en roadmap|Se ve bien en celular y escritorio
B3|mapa Leaflet|B|MVP|Click en mapa actualiza coordenadas
B4|formulario de prioridades|B|MVP|Produce un objeto UserPriorities válido
B5|gráficas de clima con Recharts|B|Muy valioso|Funcionan con mocks y luego con la API real
B6|tarjetas de rotación|B|MVP|Se ven con el mock; accesibles para no técnicos
B7|línea de tiempo anual|B|Muy valioso|Visualización clara por rotación
B8|deslizador de escenarios|B|Extra|Cambiar el slider actualiza resultados
B9|glosario y aviso de apoyo|B|Muy valioso|Textos revisados
B10|estados de carga y error|B|Muy valioso|Nunca se ve una pantalla en blanco
C1|conectar UI con /api/analyze|C|MVP|Flujo completo funciona de punta a punta
C2|revisión cruzada de PRs|C|No clasificada en roadmap|Sin violaciones de AGENTS.md
C3|prueba con 2–3 ubicaciones|C|Muy valioso|Resultados razonables y sin errores
C4|despliegue y dominio|C|MVP|URL pública estable, con datos precargados de respaldo
C5|README final|C|MVP|Cumple la Guía de presentación
C6|video demo|C|MVP|Dentro del límite de duración exigido
C7|formulario de envío|C|MVP|Enviado antes de la fecha límite
TASKS
