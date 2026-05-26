# Gestao Facil

Sistema comercial simples para pequenos negocios de servico venderem, cobrarem e emitirem NFS-e sem retrabalho.

## Tese do produto

O Gestao Facil nao sera um ERP completo e nem um emissor fiscal puro.

Ele sera um sistema comercial WhatsApp-first para pequenos negocios que precisam:

- organizar clientes e oportunidades
- gerar orcamentos rapidamente
- converter orcamentos em vendas
- cobrar por Pix ou link de pagamento
- acompanhar recebimentos
- emitir NFS-e no fim do fluxo
- reativar clientes e reduzir esquecimento comercial

## Posicionamento

Frase principal:

`Venda pelo WhatsApp, cobre por Pix e emita nota sem retrabalho.`

Frase secundaria:

`O sistema comercial simples para pequenos negocios que vendem servicos.`

## Trial e planos

- trial de `14 dias gratis`
- sem cartao no inicio do teste
- modelo de preco fixo por plano, sem cobrar por faturamento
- referencia comercial atual em [PRICING.md](./PRICING.md)

## Publico inicial

- clinicas de estetica
- psicologos, terapeutas e profissionais de saude sem operacao clinica complexa
- fisioterapia e nutricao
- mecanicas e auto centers
- eletricistas e instaladores
- assistencia tecnica
- consultorias e agencias
- imobiliarias de locacao e administracao

## O que nao somos

- ERP completo
- sistema contabil
- plataforma para industria
- estoque avancado
- emissor universal de todos os documentos fiscais

## Documentos principais

- [VISION.md](./VISION.md): proposta de valor e tese central
- [PRD.md](./PRD.md): escopo do produto e requisitos
- [MVP-BACKLOG.md](./MVP-BACKLOG.md): backlog inicial do MVP
- [ROADMAP-90D.md](./ROADMAP-90D.md): plano de 30, 60 e 90 dias
- [PRICING.md](./PRICING.md): trial, planos, segmentos e racional comercial
- [ARCHITECTURE.md](./ARCHITECTURE.md): arquitetura sugerida
- [STATUS.md](./STATUS.md): estado atual resumido do projeto
- [HANDOFF-2026-05-20.md](./HANDOFF-2026-05-20.md): handoff operacional mais recente para continuar do ponto atual
- [HANDOFF-2026-05-18.md](./HANDOFF-2026-05-18.md): handoff historico da primeira virada do projeto
- [AWS-VM-ACCESS.md](./AWS-VM-ACCESS.md): copia local do acesso da VM AWS compartilhada com o `Bot-Trader`
- [docs/OCI-SSH-RECOVERY.md](./docs/OCI-SSH-RECOVERY.md): acesso atual, chaves de recuperacao e procedimento minimo da VM Oracle
- [docs/ORACLE-VM-DEPLOY.md](./docs/ORACLE-VM-DEPLOY.md): topologia atual, runtime da VM Oracle e fluxo oficial de deploy via Git
- [docs/NEW-PC-SETUP.md](./docs/NEW-PC-SETUP.md): checklist para colocar outro PC pronto para SSH, OCI CLI e deploy via Git
- [deploy/oracle/README.md](./deploy/oracle/README.md): ponto de entrada rapido para os arquivos de deploy Oracle
- [ORACLE-MIGRATION.md](./ORACLE-MIGRATION.md): consolidacao da migracao operacional e alinhamento de banco na Oracle
- [ORACLE-VM-ACCESS.md](./ORACLE-VM-ACCESS.md): resumo do acesso atual reutilizavel da VM Oracle
- [deploy/evolution/README.md](./deploy/evolution/README.md): stack reproduzivel da Evolution API para a Lightsail
- [NEXT-STEPS.md](./NEXT-STEPS.md): ponto de entrada rapido para continuar
- [CHECKLIST.md](./CHECKLIST.md): checklist objetiva do que ja esta pronto e do que falta
- [DECISIONS.md](./DECISIONS.md): decisoes tecnicas e de produto tomadas

## Estado atual do MVP

Hoje o produto ja cobre o fluxo operacional principal:

- clientes com leitura comercial e sinais de relacionamento
- orcamentos com follow-up e conversao
- pedidos com fila operacional explicita entre aprovacao, execucao e conclusao
- cobrancas com fila automatica, lembretes e leitura de WhatsApp
- fiscal com fila inicial de NFS-e, rascunho e emissao assistida ou automatica quando o municipio permitir
- relatorios operacionais em tela, Excel e PDF
- base de assinatura SaaS por workspace com trial de 14 dias, plano preferido e status inicial

Se formos alem desta frente, o proximo passo de produto ja entra em camada analitica mais pesada:

- historico por periodo
- comparacao semanal e mensal
- tendencias de conversao, recebimento e fiscal

## Prioridade inicial

O primeiro foco do produto e:

1. vendas
2. cobranca
3. recebimento
4. NFS-e no fluxo

Nao comecar por modulos secundarios.

## Pergunta guia

Toda decisao de produto deve responder:

`Isso ajuda o pequeno negocio a vender, cobrar ou emitir com menos trabalho?`

## Producao

Stack recomendada:

- `Vercel` para o app `Next.js`
- `Neon` para `Postgres`

Variaveis de ambiente minimas na Vercel:

- `DATABASE_URL`
- `AUTH_SECRET`
- `WORKSPACE_SECRET_KEY` para criptografar segredos salvos por workspace, como chaves de recebimento
- `GESTAO_FACIL_DATA_MODE=database`
- `HEALTHCHECK_TOKEN` opcional para expor diagnostico detalhado em `/api/health` sem sessao autenticada

Pre-flight recomendado antes de qualquer deploy:

```bash
npm run readiness
```

Se quiser tratar qualquer alerta como bloqueador:

```bash
npm run readiness -- --strict
```

Observacoes de seguranca:

- `AUTH_DEMO_EMAIL` e `AUTH_DEMO_PASSWORD` devem ficar restritos ao modo local/demo e nao devem ser divulgados como acesso de producao
- `GESTAO_FACIL_ENABLE_PUBLIC_DEMO=true` deve ser usado apenas quando voce quiser liberar o login demo de forma intencional
- `ASAAS_WEBHOOK_AUTH_TOKEN` e `EVOLUTION_WEBHOOK_SECRET` precisam estar configurados para habilitar os webhooks; sem isso, as rotas ficam fechadas

Variaveis para integrar a Evolution API:

- `EVOLUTION_API_BASE_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_API_INSTANCE`
- `EVOLUTION_API_TIMEOUT_MS` opcional

Variaveis para integrar o Asaas:

- `ASAAS_API_KEY`
- `ASAAS_ENVIRONMENT=production` ou `sandbox`
- `ASAAS_WEBHOOK_AUTH_TOKEN`
- `ASAAS_ALLOW_ROOT_ACCOUNT_FALLBACK=true` apenas enquanto nem todo workspace tiver conta propria
- `ASAAS_PLATFORM_WALLET_ID` opcional para split futuro
- `ASAAS_PLATFORM_SPLIT_PERCENT` opcional para split futuro
- `ASAAS_PLATFORM_SPLIT_FIXED_VALUE` opcional para split futuro
- `APP_BASE_URL` com a URL publica do app para webhooks

Variaveis para convite por email:

- `RESEND_API_KEY` para envio transacional de convites
- `EMAIL_FROM` com o remetente autenticado no provedor

Variaveis para integrar a NFS-e Nacional:

- `NFSE_PROVIDER=auto`, `national` ou `joinville`
- `NFSE_NATIONAL_ENABLED=true`
- `NFSE_NATIONAL_ENVIRONMENT=restricted` ou `production`
- `NFSE_NATIONAL_MUNICIPAL_CODE` com o codigo IBGE do municipio emissor
- `NFSE_NATIONAL_SERVICE_CODE` com o codigo nacional do servico usado no fluxo inicial
- `NFSE_NATIONAL_SERIES` com a serie DPS de 5 digitos usada pelo emitente
- `NFSE_NATIONAL_CERT_PFX_BASE64` com o certificado A1 em base64, ou `NFSE_NATIONAL_CERT_PFX_PATH` apontando para o arquivo `.pfx`
- `NFSE_NATIONAL_CERT_PASSPHRASE` com a senha do certificado
- `NFSE_NATIONAL_TIMEOUT_MS` opcional

Variaveis para o provider municipal de Joinville:

- `NFSE_JOINVILLE_ENABLED=true`
- `NFSE_JOINVILLE_ENVIRONMENT=production` ou `homologation`
- `NFSE_JOINVILLE_MUNICIPAL_REGISTRATION` com a inscricao municipal do emitente
- `NFSE_JOINVILLE_RPS_SERIES=3000` para envio via webservice
- `NFSE_JOINVILLE_CERT_PFX_BASE64` ou `NFSE_JOINVILLE_CERT_PFX_PATH`
- `NFSE_JOINVILLE_CERT_PASSPHRASE`
- `NFSE_JOINVILLE_TIMEOUT_MS` opcional

Observacao:

- os endpoints oficiais usados no projeto seguem a publicacao do Portal NFS-e para `SEFIN Nacional` e `Parâmetros Municipais`
- a conexao oficial no projeto hoje ja testa o endpoint de convenio municipal e prepara o client para `POST /nfse`, `GET /nfse/{chaveAcesso}` e `GET /dps/{id}`
- a tela fiscal agora tambem monta uma DPS assinada por certificado A1 e tenta emitir direto no ambiente nacional quando o setup do emitente e do cliente estiver completo
- a emissao automatica agora so fica disponivel quando o municipio do estabelecimento estiver com `AderenteEmissorNacional = Sim` na base oficial publica da NFS-e
- para `Joinville/SC`, o projeto agora tambem suporta o caminho municipal `NF-em`, com webservice proprio da prefeitura, usado quando `NFSE_PROVIDER=joinville` ou `auto` com provider municipal habilitado
- no ambiente atual validado em `2026-05-24`, `JOINVILLE/SC` ainda aparece com `Conveniado Ativo`, mas `AderenteEmissorNacional = Nao`; por isso a emissao automatica segue bloqueada por regra municipal e nao por falha do app
- clientes sem certificado podem continuar no fluxo de emissao assistida, abrindo o portal oficial da NFS-e a partir do painel fiscal

Checklist de deploy:

1. importar o repositorio na `Vercel`
2. deixar `Framework Preset` como `Next.js`
3. deixar `Output Directory` vazio
4. cadastrar as variaveis de ambiente
5. criar o banco no `Neon`
6. preferir `npm run db:deploy` com as migrations versionadas; usar `npm run db:push` apenas em ambiente de desenvolvimento controlado
7. rodar `npm run readiness` para validar ambiente e integrações
8. abrir `/onboarding` para criar o primeiro usuario real do workspace

Observacao:

- sem `DATABASE_URL`, o app cai em modo local/demo
- mesmo no modo local, o login demo publico agora exige `GESTAO_FACIL_ENABLE_PUBLIC_DEMO=true`
- o banco agora deve evoluir por migrations versionadas em `prisma/migrations`
- configure `WORKSPACE_SECRET_KEY` antes de conectar contas externas persistidas no banco
