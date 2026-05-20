# Decisions

## 2026-05-18

### Produto

- Gestao Facil nao sera ERP completo.
- Gestao Facil nao sera emissor fiscal puro.
- O produto sera um sistema comercial WhatsApp-first para pequenos negocios de servico.
- O foco inicial e: clientes, orcamentos, cobrancas, recebimentos e NFS-e no fluxo.

### Stack

- `Next.js` como base do app
- `Prisma` como modelagem e futura persistencia real
- fallback local em JSON enquanto o banco real nao entra

### Auth

- seguir com `Auth.js` via `next-auth` estavel
- nao migrar para Supabase Auth agora
- motivo: melhor encaixe com `Next.js` + `Prisma` e menos acoplamento de plataforma

### Prioridade tecnica

- primeiro persistencia real
- depois pedidos
- depois NFS-e

### O que evitar

- refazer layout cedo demais
- expandir modulos secundarios
- tentar virar ERP antes de validar o fluxo comercial

## 2026-05-20

### Produto

- a frente operacional principal agora inclui leitura executiva e exportacao, nao apenas execucao transacional
- relatorios entram como camada de leitura do proprio fluxo comercial, financeiro e fiscal, nao como modulo de BI separado
- o proximo salto de produto, se formos alem desta frente, passa a ser analitica por periodo e tendencias
- o produto passa a assumir trial de `14 dias gratis` sem cartao como padrao comercial
- os planos consolidados para lancamento ficam em `Essencial`, `Profissional` e `Operacao`
- a precificacao deve seguir valor fixo por plano, sem cobrar por faturamento no lancamento
- o encaixe comercial inicial fica mais forte para servicos com NFS-e e rotina comercial/financeira, nao para software clinico profundo

### Escopo imediato

- manter a central de relatorios como snapshot operacional com `tela + Excel + PDF`
- deixar historico por periodo, comparacao semanal/mensal e tendencias como proximo bloco
- seguir validando a NFS-e real em paralelo, sem misturar isso com uma expansao grande de interface

### O que evitar

- abrir um modulo de BI amplo antes de validar os recortes analiticos basicos
- tratar a camada de relatorios como algo separado da operacao do dia
