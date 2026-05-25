param(
  [string]$ServerHost = "147.15.59.187",
  [string]$User = "ubuntu",
  [string]$KeyPath = "C:\Projetos\ssh-key-2026-05-25.key",
  [string]$RemoteRoot = "/opt/apps/gestaofacil",
  [string]$LocalDatabaseUrl = "",
  [string]$RemoteDatabaseUrl = "postgresql://gestaofacil@127.0.0.1:5432/gestaofacil"
)

$ErrorActionPreference = "Stop"

if (-not $LocalDatabaseUrl) {
  throw "Informe -LocalDatabaseUrl com a URL atual do banco de origem."
}

$dumpFile = Join-Path $env:TEMP "gestaofacil-neon-migration.dump"
$remoteDumpFile = "$RemoteRoot/backups/postgres/gestaofacil-neon-migration.dump"

& pg_dump --format=custom --compress=9 --no-owner --no-privileges --file $dumpFile $LocalDatabaseUrl
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump do banco atual falhou."
}

& scp -i $KeyPath -o StrictHostKeyChecking=accept-new $dumpFile "$User@$ServerHost`:$remoteDumpFile"
if ($LASTEXITCODE -ne 0) {
  throw "Upload do dump para a Oracle falhou."
}

& scp -i $KeyPath -o StrictHostKeyChecking=accept-new "ops/oracle/restore-postgres-vm.sh" "$User@$ServerHost`:$RemoteRoot/shared/bin/restore-postgres-vm.sh"
if ($LASTEXITCODE -ne 0) {
  throw "Upload do script de restauracao falhou."
}

& ssh -i $KeyPath -o StrictHostKeyChecking=accept-new "$User@$ServerHost" "chmod +x '$RemoteRoot/shared/bin/restore-postgres-vm.sh' && DATABASE_URL='$RemoteDatabaseUrl' bash '$RemoteRoot/shared/bin/restore-postgres-vm.sh' '$remoteDumpFile'"
if ($LASTEXITCODE -ne 0) {
  throw "Restauracao do dump na Oracle falhou."
}
