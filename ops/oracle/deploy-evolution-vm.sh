#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/apps/gestaofacil}"
EVOLUTION_DIR="${EVOLUTION_DIR:-$APP_ROOT/evolution}"
ENV_FILE="${ENV_FILE:-$EVOLUTION_DIR/.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo de ambiente ausente: $ENV_FILE" >&2
  echo "Copie deploy/oracle/evolution.env.example para $ENV_FILE e preencha os segredos." >&2
  exit 1
fi

sed -i 's/\r$//' "$ENV_FILE"

cd "$EVOLUTION_DIR"
docker compose up -d
sleep 5
curl -fsS http://127.0.0.1:8081 >/dev/null
