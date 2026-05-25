param(
  [string]$Remote = "origin",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

& git push $Remote $Branch
if ($LASTEXITCODE -ne 0) {
  throw "Push para $Remote/$Branch falhou."
}

& powershell -ExecutionPolicy Bypass -File "$PSScriptRoot/deploy-web-oracle.ps1" -Branch $Branch
if ($LASTEXITCODE -ne 0) {
  throw "Deploy Oracle falhou."
}
