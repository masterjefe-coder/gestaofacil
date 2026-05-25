#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/apps/gestaofacil}"
APP_DB_NAME="${APP_DB_NAME:-gestaofacil}"
APP_DB_USER="${APP_DB_USER:-gestaofacil}"
APP_DB_PASSWORD="${APP_DB_PASSWORD:-}"

export DEBIAN_FRONTEND=noninteractive

sudo apt-get update
sudo apt-get install -y curl ca-certificates gnupg postgresql postgresql-contrib postgresql-client

sudo systemctl enable postgresql
sudo systemctl start postgresql

sudo sed -i "s/^#\\?listen_addresses.*/listen_addresses = '127.0.0.1'/" /etc/postgresql/*/main/postgresql.conf

if ! sudo grep -q "127.0.0.1/32" /etc/postgresql/*/main/pg_hba.conf; then
  echo "host all all 127.0.0.1/32 scram-sha-256" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf >/dev/null
fi

sudo systemctl restart postgresql

sudo mkdir -p "$APP_ROOT/backups/postgres" "$APP_ROOT/shared/bin"
sudo chown -R ubuntu:ubuntu "$APP_ROOT/backups" "$APP_ROOT/shared"

if [ -n "$APP_DB_PASSWORD" ]; then
  sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$APP_DB_USER') THEN
    CREATE ROLE $APP_DB_USER LOGIN PASSWORD '$APP_DB_PASSWORD';
  ELSE
    ALTER ROLE $APP_DB_USER WITH LOGIN PASSWORD '$APP_DB_PASSWORD';
  END IF;
END
\$\$;
SQL

  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$APP_DB_NAME'" | grep -q 1; then
    sudo -u postgres createdb --owner="$APP_DB_USER" "$APP_DB_NAME"
  fi
fi

echo "Postgres pronto."
sudo systemctl status postgresql --no-pager | head -n 20 || true
