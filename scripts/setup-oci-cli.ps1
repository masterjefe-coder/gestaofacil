param(
  [string]$UserOcid,
  [string]$TenancyOcid,
  [string]$Fingerprint,
  [string]$Region = "sa-saopaulo-1",
  [string]$KeyFile = "C:\Projetos\oci-api\oci_api_key.pem",
  [string]$ConfigPath = "$env:USERPROFILE\.oci\config"
)

$ErrorActionPreference = "Stop"

if (-not $UserOcid -or -not $TenancyOcid -or -not $Fingerprint) {
  throw "Informe UserOcid, TenancyOcid e Fingerprint."
}

if (-not (Test-Path $KeyFile)) {
  throw "Arquivo de chave privada da OCI nao encontrado em $KeyFile"
}

$configDir = Split-Path -Parent $ConfigPath
New-Item -ItemType Directory -Force -Path $configDir | Out-Null

$content = @"
[DEFAULT]
user=$UserOcid
fingerprint=$Fingerprint
tenancy=$TenancyOcid
region=$Region
key_file=$KeyFile
"@

Set-Content -LiteralPath $ConfigPath -Value $content -NoNewline
Write-Host "Configuracao gravada em $ConfigPath"
