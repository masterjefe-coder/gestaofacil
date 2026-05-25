#!/usr/bin/env bash
set -euo pipefail

if ! command -v apt-get >/dev/null 2>&1; then
  echo "apt-get nao encontrado; esta VM nao parece ser Ubuntu/Debian." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y git rsync curl unzip ca-certificates gnupg

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v caddy >/dev/null 2>&1; then
  sudo apt-get install -y caddy
fi

if command -v corepack >/dev/null 2>&1; then
  sudo corepack enable >/dev/null 2>&1 || true
fi

sudo mkdir -p /etc/caddy/sites-enabled
sudo systemctl enable caddy >/dev/null 2>&1 || true
