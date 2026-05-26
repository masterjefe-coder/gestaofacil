# Oracle Migration

## Objetivo

Registrar a consolidacao operacional do `Gestao Facil` na VM Oracle e o que precisa existir para repetir isso com seguranca.

## Estado validado em 2026-05-26

- VM Oracle principal: `147.15.59.187`
- usuario SSH: `ubuntu`
- app publicado pelo `Caddy`
- runtime web em `systemd`
- banco local em `PostgreSQL 16`
- Evolution API local em `Docker`

## Estrutura remota observada

```text
/opt/apps/gestaofacil/
  repo.git/
  repo/
  shared/
    app.env
  runtime/
    app.normalized.env
    web-build/
  web/
  backups/
    postgres/
      manual/
```

## Migrations de banco

Em `2026-05-26` foi necessario alinhar o schema de producao com as migrations do projeto.

Passos executados:

1. backup manual do banco
2. baseline da migration `20260521195000_init`
3. aplicacao manual do SQL de `20260523170000_operational_foundations`
4. marcacao dessa migration como aplicada
5. validacao com `prisma migrate status`

Resultado final:

- `prisma migrate status` passou a indicar que o schema esta atualizado
- o historico de erro sobre a tabela `BackgroundJob` deixou de ser um descompasso conhecido entre codigo e banco

## Padrao daqui para frente

Para novas mudancas:

1. versionar as migrations em `prisma/migrations`
2. publicar o commit na VM Oracle por Git
3. rodar `npm run db:deploy` no deploy remoto
4. validar logs e healthcheck

## Documentos relacionados

- `docs/ORACLE-VM-DEPLOY.md`
- `docs/OCI-SSH-RECOVERY.md`
- `docs/NEW-PC-SETUP.md`
