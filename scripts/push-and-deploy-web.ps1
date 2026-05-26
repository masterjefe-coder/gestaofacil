param(
  [string]$Remote = "origin",
  [string]$Branch = "main",
  [string]$KeyPath = "C:\Projetos\oci_recuperacao"
)

$ErrorActionPreference = "Stop"

$gitExe = if (Get-Command git -ErrorAction SilentlyContinue) {
  "git"
} elseif (Test-Path "C:\Program Files\Git\cmd\git.exe") {
  "C:\Program Files\Git\cmd\git.exe"
} else {
  throw "Git nao encontrado. Instale o Git ou ajuste o PATH."
}

& $gitExe push $Remote $Branch
if ($LASTEXITCODE -ne 0) {
  throw "Push para $Remote/$Branch falhou."
}

& powershell -ExecutionPolicy Bypass -File "$PSScriptRoot/deploy-web-oracle.ps1" -Branch $Branch -KeyPath $KeyPath
if ($LASTEXITCODE -ne 0) {
  throw "Deploy Oracle falhou."
}
