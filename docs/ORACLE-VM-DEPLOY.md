# Oracle VM Deploy

## VM validada

- instancia: `vm-masterjefe`
- IP publico validado em `2026-05-26`: `147.15.59.187`
- usuario: `ubuntu`
- shape: `VM.Standard.A1.Flex`
- configuracao: `4 OCPU / 24 GB RAM`
- sistema: `Ubuntu 24.04 Minimal aarch64`

## Topologia atual

- proxy reverso: `Caddy`
- app web do Gestao Facil: `systemd`
- banco local: `PostgreSQL 16`
- stack Evolution API: `Docker`

Servicos ativos validados:

- `caddy.service`
- `docker.service`
- `postgresql@16-main.service`
- `gestaofacil-web.service`

## Caminhos importantes

- raiz do app: `/opt/apps/gestaofacil`
- runtime web: `/opt/apps/gestaofacil/web`
- checkout Git remoto: `/opt/apps/gestaofacil/repo`
- bare repo remoto: `/opt/apps/gestaofacil/repo.git`
- ambiente compartilhado: `/opt/apps/gestaofacil/shared/app.env`

## Publicacao atual

- app ouvindo localmente em `127.0.0.1:3002`
- `Caddy` publicando `https://www.gestaofacilsistemas.com.br`
- `Evolution API` local em `127.0.0.1:8081`

## Servico systemd do app

Arquivo validado:

- `/etc/systemd/system/gestaofacil-web.service`

Pontos principais:

- `WorkingDirectory=/opt/apps/gestaofacil/web`
- `EnvironmentFile=/opt/apps/gestaofacil/shared/app.env`
- `ExecStart=/usr/bin/env node server.js`
- `PORT=3002`
- `HOSTNAME=127.0.0.1`

## Fluxo oficial de deploy

O fluxo oficial deste projeto para a Oracle deve ser via `Git`.

Modelo adotado:

1. push do commit para o bare repo remoto em `/opt/apps/gestaofacil/repo.git`
2. checkout limpo em `/opt/apps/gestaofacil/repo`
3. setup idempotente do host com `ops/oracle/setup-git-deploy-vm.sh`
4. build na propria VM com `ops/oracle/deploy-web-vm.sh`
5. restart de `gestaofacil-web.service`
6. reload do `Caddy`

Esse fluxo evita o modelo pesado de empacotar e subir tudo do PC para a VM.
O codigo sobe por Git e o build acontece na Oracle.

Arquivos locais que sustentam esse fluxo:

- `scripts/deploy-web-oracle.ps1`
- `scripts/push-and-deploy-web.ps1`
- `ops/oracle/setup-git-deploy-vm.sh`
- `ops/oracle/deploy-web-vm.sh`
- `deploy/oracle/app.env.example`
- `deploy/oracle/oracle_vm.example.json`

## Banco e migrations

Situacao corrigida em `2026-05-26`:

- backup manual gerado em `/opt/apps/gestaofacil/backups/postgres/manual`
- migration `20260521195000_init` marcada como baseline
- migration `20260523170000_operational_foundations` aplicada manualmente por SQL
- migration `20260523170000_operational_foundations` marcada como aplicada em `_prisma_migrations`
- `prisma migrate status` passou a reportar `Database schema is up to date`

Antes de qualquer deploy novo, vale validar:

```bash
systemctl status gestaofacil-web --no-pager
journalctl -u gestaofacil-web -n 200 --no-pager
cd /opt/apps/gestaofacil/repo
npm run db:deploy
```

## Comandos uteis

```powershell
ssh -i C:\Projetos\oci_recuperacao ubuntu@147.15.59.187
```

```bash
systemctl status gestaofacil-web --no-pager
journalctl -u gestaofacil-web -n 200 --no-pager
docker ps
curl -I http://127.0.0.1:3002
curl -I https://www.gestaofacilsistemas.com.br
```
