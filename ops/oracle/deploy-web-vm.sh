#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/apps/gestaofacil}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/shared/app.env}"
BUILD_DIR="$APP_ROOT/runtime/web-build"
LIVE_DIR="$APP_ROOT/web"
NORMALIZED_ENV_FILE="$APP_ROOT/runtime/app.normalized.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo de ambiente ausente: $ENV_FILE" >&2
  echo "Copie deploy/oracle/app.env.example para $ENV_FILE e preencha os segredos." >&2
  exit 1
fi

sed -i 's/\r$//' "$ENV_FILE"
rm -f "$NORMALIZED_ENV_FILE"

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    "")
      printf '\n' >> "$NORMALIZED_ENV_FILE"
      continue
      ;;
    \#*)
      printf '%s\n' "$line" >> "$NORMALIZED_ENV_FILE"
      continue
      ;;
  esac

  key="${line%%=*}"
  value="${line#*=}"
  if [ "${value#\"}" != "$value" ] && [ "${value%\"}" != "$value" ]; then
    value="${value#\"}"
    value="${value%\"}"
  fi
  printf '%s=%s\n' "$key" "$value" >> "$NORMALIZED_ENV_FILE"
done < "$ENV_FILE"

cp "$NORMALIZED_ENV_FILE" "$REPO_DIR/.env"

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    "" | \#*)
      continue
      ;;
  esac
  export "$line"
done < "$NORMALIZED_ENV_FILE"

APP_PORT="${PORT:-3002}"

cd "$REPO_DIR"
npm install --include=dev

DATABASE_URL_PSQL="${DATABASE_URL%%\?*}"
TABLE_COUNT="$(psql "$DATABASE_URL_PSQL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
MIGRATIONS_TABLE_PRESENT="$(psql "$DATABASE_URL_PSQL" -tAc "SELECT to_regclass('public._prisma_migrations') IS NOT NULL")"

if [ "$TABLE_COUNT" = "0" ] || [ "$MIGRATIONS_TABLE_PRESENT" = "t" ]; then
  npm run db:deploy
else
  echo "Banco ja restaurado sem baseline Prisma; pulando db:deploy neste bootstrap."
fi

npm run build

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/.next" "$LIVE_DIR"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete .next/standalone/ "$BUILD_DIR/"
  rsync -a --delete .next/static/ "$BUILD_DIR/.next/static/"
else
  cp -R .next/standalone/. "$BUILD_DIR/"
  cp -R .next/static "$BUILD_DIR/.next/"
fi

if [ -d public ]; then
  mkdir -p "$BUILD_DIR/public"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete public/ "$BUILD_DIR/public/"
  else
    rm -rf "$BUILD_DIR/public"
    mkdir -p "$BUILD_DIR/public"
    cp -R public/. "$BUILD_DIR/public/"
  fi
fi

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$BUILD_DIR/" "$LIVE_DIR/"
else
  rm -rf "$LIVE_DIR"
  mkdir -p "$LIVE_DIR"
  cp -R "$BUILD_DIR"/. "$LIVE_DIR/"
fi

sudo systemctl restart gestaofacil-web
sudo systemctl reload caddy >/dev/null 2>&1 || sudo systemctl restart caddy

sleep 2
curl -fsS "http://127.0.0.1:$APP_PORT/api/health" >/dev/null
