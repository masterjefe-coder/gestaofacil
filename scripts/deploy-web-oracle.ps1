param(
  [string]$ServerHost = "147.15.59.187",
  [string]$User = "ubuntu",
  [string]$KeyPath = "C:\Projetos\oci_recuperacao",
  [string]$RemoteRoot = "/opt/apps/gestaofacil",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

$gitExe = if (Get-Command git -ErrorAction SilentlyContinue) {
  "git"
} elseif (Test-Path "C:\Program Files\Git\cmd\git.exe") {
  "C:\Program Files\Git\cmd\git.exe"
} else {
  throw "Git nao encontrado. Instale o Git ou ajuste o PATH."
}

if (-not (Test-Path $KeyPath)) {
  throw "Chave SSH nao encontrada em $KeyPath"
}

$repoStateLines = @(& $gitExe status --porcelain)
$repoState = ($repoStateLines -join "`n").Trim()
if ($repoState) {
  throw "Ha mudancas locais nao commitadas. Faca commit antes do deploy."
}

$remoteGitDir = "$RemoteRoot/repo.git"
$bootstrapCommand = "set -euo pipefail; mkdir -p '$RemoteRoot'; if ! command -v git >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y git; fi; if [ ! -d '$remoteGitDir/refs' ]; then rm -rf '$remoteGitDir'; git init --bare '$remoteGitDir'; fi"
& ssh -i $KeyPath -o StrictHostKeyChecking=accept-new "$User@$ServerHost" $bootstrapCommand
if ($LASTEXITCODE -ne 0) {
  throw "Bootstrap remoto do deploy web falhou."
}

$previousGitSshCommand = $env:GIT_SSH_COMMAND
$env:GIT_SSH_COMMAND = "ssh -i `"$KeyPath`" -o StrictHostKeyChecking=accept-new"
& $gitExe push --force "ssh://$User@$ServerHost$remoteGitDir" "HEAD:refs/heads/$Branch"
$pushExitCode = $LASTEXITCODE
if ($null -ne $previousGitSshCommand) {
  $env:GIT_SSH_COMMAND = $previousGitSshCommand
} else {
  Remove-Item Env:GIT_SSH_COMMAND -ErrorAction SilentlyContinue
}
if ($pushExitCode -ne 0) {
  throw "Push do codigo para a VM falhou."
}

$remoteCommand = "set -euo pipefail; APP_ROOT='$RemoteRoot'; REPO_DIR=`"`$APP_ROOT/repo`"; REPO_GIT_DIR='$remoteGitDir'; mkdir -p `"`$REPO_DIR`"; git --git-dir=`"`$REPO_GIT_DIR`" --work-tree=`"`$REPO_DIR`" checkout -f '$Branch'; git --git-dir=`"`$REPO_GIT_DIR`" --work-tree=`"`$REPO_DIR`" clean -fd; APP_ROOT='$RemoteRoot' REPO_DIR=`"`$REPO_DIR`" REPO_GIT_DIR=`"`$REPO_GIT_DIR`" BRANCH='$Branch' bash `"`$REPO_DIR/ops/oracle/setup-git-deploy-vm.sh`"; APP_ROOT='$RemoteRoot' REPO_DIR=`"`$REPO_DIR`" bash `"`$REPO_DIR/ops/oracle/deploy-web-vm.sh`""
& ssh -i $KeyPath -o StrictHostKeyChecking=accept-new "$User@$ServerHost" $remoteCommand
if ($LASTEXITCODE -ne 0) {
  throw "Deploy web falhou na VM."
}
