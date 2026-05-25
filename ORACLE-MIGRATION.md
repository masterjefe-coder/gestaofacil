# Oracle Migration

## Objetivo

Consolidar a operacao do `Gestao Facil` na VM Oracle compartilhada com o `GarimpeAI`, mantendo uma trilha segura para migrar primeiro a `Evolution API` e, se fizer sentido, depois o app `Next.js`.

## Estado atual em 2026-05-25

- app publico principal hoje: `Vercel`
- banco principal hoje: `Neon`
- `Evolution API` hoje: `AWS Lightsail` em `http://3.91.115.172:8081`
- destino novo consolidado: `VM Oracle 147.15.59.187`
- raiz remota preparada para este projeto: `/opt/apps/gestaofacil`

## Estrutura prevista na Oracle

```text
/opt/apps/gestaofacil/
  repo.git/
  repo/
  shared/
    app.env
    backup.env
    bin/
  runtime/
    web-build/
  web/
  backups/
    postgres/
  evolution/
    docker-compose.yml
    .env
```

## Artefatos locais

- `deploy/oracle/oracle_vm.json`
- `deploy/oracle/app.env.example`
- `deploy/oracle/evolution.env.example`
- `deploy/oracle/backup.env.example`
- `ops/oracle/setup-base-vm.sh`
- `ops/oracle/setup-git-deploy-vm.sh`
- `ops/oracle/setup-postgres-vm.sh`
- `ops/oracle/deploy-web-vm.sh`
- `ops/oracle/setup-evolution-vm.sh`
- `ops/oracle/deploy-evolution-vm.sh`
- `ops/oracle/postgres-backup.sh`
- `ops/oracle/postgres-backup.service`
- `ops/oracle/postgres-backup.timer`
- `ops/oracle/restore-postgres-vm.sh`
- `ops/oracle/gestaofacil-web.service`
- `ops/oracle/gestaofacil.Caddyfile`
- `scripts/oracle_vm.py`
- `scripts/deploy-web-oracle.ps1`
- `scripts/push-and-deploy-web.ps1`
- `scripts/deploy-evolution-oracle.ps1`
- `scripts/migrate-neon-to-oracle.ps1`

## Arquitetura alvo 100% Oracle

- `Next.js` via `systemd` em `gestaofacil-web.service`
- `Postgres` local, escutando apenas em `127.0.0.1`
- `Evolution API` via `Docker Compose`
- `Caddy` como proxy reverso e TLS
- `Gestao Facil` publicado localmente em `127.0.0.1:3002`, preservando a `3000` para o `GarimpeAI`
- backup diario de banco em `/opt/apps/gestaofacil/backups/postgres`
- opcionalmente replicado para `R2`

## App Next.js na Oracle

O app agora ficou preparado para build `standalone` em `next.config.ts`.

Fluxo previsto:

1. preencher `/opt/apps/gestaofacil/shared/app.env`
2. enviar o commit para a VM com `scripts/deploy-web-oracle.ps1`
3. o deploy remoto executa:
4. `npm ci`
5. `npm run db:deploy`
6. `npm run build`
7. sincroniza `.next/standalone`, `.next/static` e `public/`
8. reinicia `gestaofacil-web`
9. recarrega `caddy`

Observacao importante:

- a VM Oracle compartilha o `Caddy` com o `GarimpeAI`
- por isso o projeto usa um snippet proprio em `/etc/caddy/sites-enabled/gestaofacil.Caddyfile`
- o script de setup so injeta um `import /etc/caddy/sites-enabled/*` no `Caddyfile` principal se isso ainda nao existir

## Evolution API na Oracle

Fluxo previsto:

1. preencher `/opt/apps/gestaofacil/evolution/.env`
2. rodar `powershell -ExecutionPolicy Bypass -File scripts/deploy-evolution-oracle.ps1`
3. o setup instala `Docker` e `Docker Compose Plugin` se necessario
4. copia `docker-compose.yml`
5. sobe a stack com `docker compose up -d`

## Banco local na Oracle

Fluxo previsto:

1. rodar `bash ops/oracle/setup-postgres-vm.sh`
2. criar `shared/app.env` com `DATABASE_URL` local
3. criar `shared/backup.env`
4. habilitar o backup diario via `postgres-backup.timer`
5. migrar os dados atuais do `Neon` com `scripts/migrate-neon-to-oracle.ps1`

## Sequencia recomendada de migracao

1. configurar `Postgres` local da Oracle
2. migrar o banco atual do `Neon` para a Oracle
3. preencher `shared/app.env` com a nova `DATABASE_URL` local
4. fazer o primeiro deploy do app na Oracle
5. validar o app por IP ou host temporario antes da virada de DNS
6. subir a `Evolution API` na Oracle
7. importar ou recriar a instancia WhatsApp conforme a estrategia escolhida
8. trocar `EVOLUTION_API_BASE_URL` para `http://127.0.0.1:8081`
9. virar o DNS de `gestaofacilsistemas.com.br` para a Oracle
10. monitorar app, banco, webhooks e mensagens reais

## Pendencias operacionais mais importantes

Antes da virada final ainda faltam duas decisoes:

- se a `Evolution API` vai subir limpa ou com migracao dos dados atuais da AWS
- em que janela sera feita a troca de DNS do dominio principal para a Oracle
