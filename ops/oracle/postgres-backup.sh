#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/apps/gestaofacil}"
BACKUP_ENV="${BACKUP_ENV:-$APP_ROOT/shared/backup.env}"
BACKUP_DIR="${BACKUP_DIR:-$APP_ROOT/backups/postgres}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$BACKUP_ENV" ]]; then
  echo "backup.env ausente em $BACKUP_ENV" >&2
  exit 1
fi

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    "" | \#*)
      continue
      ;;
  esac
  export "$line"
done < "$BACKUP_ENV"

: "${DATABASE_URL:?DATABASE_URL ausente}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

FILE="$BACKUP_DIR/gestaofacil-postgres-$STAMP.dump"
LATEST="$BACKUP_DIR/latest.dump"
export FILE

pg_dump --format=custom --compress=9 --no-owner --no-privileges "$DATABASE_URL" > "$FILE"
ln -sfn "$(basename "$FILE")" "$LATEST"

find "$BACKUP_DIR" -type f -name '*.dump' -mtime +"$RETENTION_DAYS" -delete

if [[ -n "${R2_BUCKET:-}" && -n "${R2_ENDPOINT:-}" && -n "${R2_ACCESS_KEY_ID:-}" && -n "${R2_SECRET_ACCESS_KEY:-}" ]]; then
  python3 <<'PY'
import os
from pathlib import Path

import boto3
from botocore.config import Config

bucket = os.environ["R2_BUCKET"]
endpoint = os.environ["R2_ENDPOINT"]
key = os.environ["R2_ACCESS_KEY_ID"]
secret = os.environ["R2_SECRET_ACCESS_KEY"]
file_path = Path(os.environ["FILE"])
prefix = "postgres-backups/"
keep = 14

session = boto3.session.Session()
client = session.client(
    "s3",
    endpoint_url=endpoint,
    aws_access_key_id=key,
    aws_secret_access_key=secret,
    region_name="auto",
    config=Config(signature_version="s3v4"),
)

client.upload_file(str(file_path), bucket, f"{prefix}{file_path.name}")

objects = client.list_objects_v2(Bucket=bucket, Prefix=prefix).get("Contents", [])
objects = sorted(objects, key=lambda item: item["Key"])
for obj in objects[:-keep]:
    client.delete_object(Bucket=bucket, Key=obj["Key"])
PY
fi

echo "Backup concluido: $FILE"
