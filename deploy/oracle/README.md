# Oracle Deploy

## Objetivo

Centralizar os arquivos de referencia para a operacao do `Gestao Facil` na VM Oracle.

## Arquivos

- `oracle_vm.example.json`: parametros basicos da VM validada
- `app.env.example`: referencia minima do ambiente compartilhado em `/opt/apps/gestaofacil/shared/app.env`

## Fluxo adotado

O deploy oficial da Oracle e `Git-first`:

1. push do commit para o bare repo remoto
2. checkout limpo na VM
3. build na propria VM
4. restart do servico web

Scripts locais:

- `scripts/deploy-web-oracle.ps1`
- `scripts/push-and-deploy-web.ps1`
- `scripts/setup-oci-cli.ps1`

Scripts remotos:

- `ops/oracle/setup-git-deploy-vm.sh`
- `ops/oracle/deploy-web-vm.sh`
