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
