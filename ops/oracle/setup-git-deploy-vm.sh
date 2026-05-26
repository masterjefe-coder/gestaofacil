#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/apps/gestaofacil}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"
REPO_GIT_DIR="${REPO_GIT_DIR:-$APP_ROOT/repo.git}"
BRANCH="${BRANCH:-main}"

mkdir -p "$APP_ROOT/shared/bin" "$APP_ROOT/backups" "$APP_ROOT/runtime"

if ! command -v git >/dev/null 2>&1; then
  echo "git nao encontrado na VM" >&2
  exit 1
fi

if [ ! -f /etc/caddy/Caddyfile ]; then
  echo "Caddyfile principal nao encontrado em /etc/caddy/Caddyfile" >&2
  exit 1
fi

if [ ! -d "$REPO_GIT_DIR/refs" ]; then
  rm -rf "$REPO_GIT_DIR"
  git init --bare "$REPO_GIT_DIR"
fi

mkdir -p "$REPO_DIR"
git config --global --add safe.directory "$REPO_DIR" >/dev/null 2>&1 || true

if git --git-dir="$REPO_GIT_DIR" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git --git-dir="$REPO_GIT_DIR" --work-tree="$REPO_DIR" checkout -f "$BRANCH"
  git --git-dir="$REPO_GIT_DIR" --work-tree="$REPO_DIR" clean -fd
fi

if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi

sudo mkdir -p /etc/caddy/sites-enabled
if ! sudo grep -qF "import /etc/caddy/sites-enabled/*" /etc/caddy/Caddyfile; then
  tmpfile="$(mktemp)"
  {
    echo "import /etc/caddy/sites-enabled/*"
    echo
    sudo cat /etc/caddy/Caddyfile
  } > "$tmpfile"
  sudo cp "$tmpfile" /etc/caddy/Caddyfile
  rm -f "$tmpfile"
fi

sudo cp "$REPO_DIR/ops/oracle/gestaofacil-web.service" /etc/systemd/system/gestaofacil-web.service
sudo cp "$REPO_DIR/ops/oracle/gestaofacil.Caddyfile" /etc/caddy/sites-enabled/gestaofacil.Caddyfile

if [ -f "$REPO_DIR/ops/oracle/postgres-backup.service" ] && [ -f "$REPO_DIR/ops/oracle/postgres-backup.timer" ] && [ -f "$REPO_DIR/ops/oracle/postgres-backup.sh" ]; then
  sudo cp "$REPO_DIR/ops/oracle/postgres-backup.service" /etc/systemd/system/postgres-backup.service
  sudo cp "$REPO_DIR/ops/oracle/postgres-backup.timer" /etc/systemd/system/postgres-backup.timer
  sudo install -m 755 "$REPO_DIR/ops/oracle/postgres-backup.sh" "$APP_ROOT/shared/bin/postgres-backup.sh"
  sudo systemctl enable postgres-backup.timer >/dev/null 2>&1 || true
fi

sudo systemctl daemon-reload
sudo systemctl enable gestaofacil-web >/dev/null 2>&1 || true
sudo systemctl reload caddy >/dev/null 2>&1 || sudo systemctl restart caddy
