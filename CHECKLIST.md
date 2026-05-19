# Checklist

## Produto

- [x] posicionamento definido
- [x] landing pronta
- [x] dashboard inicial pronto
- [x] setup de workspace e empresa
- [x] modulo de clientes
- [x] modulo de orcamentos
- [x] modulo de cobrancas
- [x] modulo minimo de pedidos na camada de dados
- [ ] fluxo de NFS-e

## Auth

- [x] login
- [x] logout
- [x] protecao do dashboard
- [x] `next-auth` configurado
- [x] sessao carregando contexto de workspace
- [x] onboarding do primeiro usuario/workspace
- [ ] usuarios reais no banco com schema aplicado no ambiente
- [x] adicao de segundo usuario no mesmo workspace
- [x] troca de papel, remocao e reset de senha no workspace

## Dados

- [x] schema Prisma
- [x] persistencia local em arquivo
- [x] repositores locais de customers
- [x] repositores locais de quotes
- [x] repositores locais de charges
- [x] setup local de workspace/company
- [x] caminho inicial de persistencia real de workspace/company
- [x] persistencia real inicial de customers
- [x] caminho inicial de persistencia real de quotes
- [x] caminho inicial de persistencia real de charges via orders
- [x] bootstrap demo compartilhado entre customers, quotes, orders e charges no banco
- [x] dashboard principal lendo agregacoes reais do workspace
- [x] `charges` com `dueDate` real no fluxo de formulario, API e repositorio
- [x] APIs principais protegidas por sessao autenticada
- [x] login por credenciais com usuario real do banco
- [x] gestao basica de membros no setup
- [x] priorizacao operacional de cobrancas por `dueDate`

## APIs

- [x] `/api/auth/[...nextauth]`
- [x] `/api/setup`
- [x] `/api/customers`
- [x] `/api/quotes`
- [x] `/api/charges`
- [x] `/api/health`

## Validacao

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npx prisma validate`
