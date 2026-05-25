param(
  [string]$ServerHost = "147.15.59.187",
  [string]$User = "ubuntu",
  [string]$KeyPath = "C:\Projetos\ssh-key-2026-05-25.key",
  [string]$RemoteRoot = "/opt/apps/gestaofacil"
)

$ErrorActionPreference = "Stop"
$remoteEvolutionDir = "$RemoteRoot/evolution"

& ssh -i $KeyPath -o StrictHostKeyChecking=accept-new "$User@$ServerHost" "APP_ROOT='$RemoteRoot' EVOLUTION_DIR='$remoteEvolutionDir' bash -s" < "ops/oracle/setup-evolution-vm.sh"
if ($LASTEXITCODE -ne 0) {
  throw "Setup base da Evolution na Oracle falhou."
}

& ssh -i $KeyPath -o StrictHostKeyChecking=accept-new "$User@$ServerHost" "mkdir -p '$remoteEvolutionDir'"
if ($LASTEXITCODE -ne 0) {
  throw "Criação da pasta remota da Evolution falhou."
}

& scp -i $KeyPath -o StrictHostKeyChecking=accept-new "deploy/evolution/docker-compose.yml" "$User@$ServerHost`:$remoteEvolutionDir/docker-compose.yml"
if ($LASTEXITCODE -ne 0) {
  throw "Envio do docker-compose da Evolution falhou."
}

& scp -i $KeyPath -o StrictHostKeyChecking=accept-new "deploy/oracle/evolution.env.example" "$User@$ServerHost`:$remoteEvolutionDir/.env.example"
if ($LASTEXITCODE -ne 0) {
  throw "Envio do exemplo de ambiente da Evolution falhou."
}

& ssh -i $KeyPath -o StrictHostKeyChecking=accept-new "$User@$ServerHost" "APP_ROOT='$RemoteRoot' EVOLUTION_DIR='$remoteEvolutionDir' bash -s" < "ops/oracle/deploy-evolution-vm.sh"
if ($LASTEXITCODE -ne 0) {
  throw "Deploy da Evolution na Oracle falhou."
}
