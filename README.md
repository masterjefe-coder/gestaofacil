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

## Publico inicial

- prestadores de servico
- assistencia tecnica
- instaladores
- pequenas agencias
- consultores
- clinicas pequenas
- negocios locais com rotina comercial simples

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
- [ARCHITECTURE.md](./ARCHITECTURE.md): arquitetura sugerida
- [STATUS.md](./STATUS.md): estado atual resumido do projeto
- [HANDOFF-2026-05-18.md](./HANDOFF-2026-05-18.md): handoff operacional completo para retomada
- [NEXT-STEPS.md](./NEXT-STEPS.md): ponto de entrada rapido para continuar
- [CHECKLIST.md](./CHECKLIST.md): checklist objetiva do que ja esta pronto e do que falta
- [DECISIONS.md](./DECISIONS.md): decisoes tecnicas e de produto tomadas

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
- `AUTH_DEMO_EMAIL`
- `AUTH_DEMO_PASSWORD`
- `GESTAO_FACIL_DATA_MODE=database`

Variaveis para integrar a NFS-e Nacional:

- `NFSE_NATIONAL_ENABLED=true`
- `NFSE_NATIONAL_ENVIRONMENT=restricted` ou `production`
- `NFSE_NATIONAL_MUNICIPAL_CODE` com o codigo IBGE do municipio emissor
- `NFSE_NATIONAL_SERVICE_CODE` com o codigo nacional do servico usado no fluxo inicial
- `NFSE_NATIONAL_SERIES` com a serie DPS de 5 digitos usada pelo emitente
- `NFSE_NATIONAL_CERT_PFX_BASE64` com o certificado A1 em base64
- `NFSE_NATIONAL_CERT_PASSPHRASE` com a senha do certificado
- `NFSE_NATIONAL_TIMEOUT_MS` opcional

Observacao:

- os endpoints oficiais usados no projeto seguem a publicacao do Portal NFS-e para `SEFIN Nacional` e `Parâmetros Municipais`
- a conexao oficial no projeto hoje ja testa o endpoint de convenio municipal e prepara o client para `POST /nfse`, `GET /nfse/{chaveAcesso}` e `GET /dps/{id}`
- a tela fiscal agora tambem monta uma DPS assinada por certificado A1 e tenta emitir direto no ambiente nacional quando o setup do emitente e do cliente estiver completo

Checklist de deploy:

1. importar o repositorio na `Vercel`
2. deixar `Framework Preset` como `Next.js`
3. deixar `Output Directory` vazio
4. cadastrar as variaveis de ambiente
5. criar o banco no `Neon`
6. rodar `npm run db:push` com a `DATABASE_URL` de producao
7. abrir `/onboarding` para criar o primeiro usuario real do workspace

Observacao:

- sem `DATABASE_URL`, o app cai em modo local/demo
- o campo `passwordHash` do schema precisa existir no banco de producao, entao o passo `db:push` e obrigatorio
