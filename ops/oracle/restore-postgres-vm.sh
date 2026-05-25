#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Uso: bash ops/oracle/restore-postgres-vm.sh /caminho/arquivo.dump [database_url]" >&2
  exit 1
fi

DUMP_FILE="$1"
DATABASE_URL="${2:-${DATABASE_URL:-}}"

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL ausente para restauracao." >&2
  exit 1
fi

pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$DUMP_FILE"
