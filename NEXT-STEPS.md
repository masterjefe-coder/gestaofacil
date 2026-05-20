# Next Steps

## Leia primeiro

1. [STATUS.md](./STATUS.md)
2. [HANDOFF-2026-05-20.md](./HANDOFF-2026-05-20.md)
3. [prisma/schema.prisma](./prisma/schema.prisma)

## Estado atual em uma frase

O produto ja tem um core operacional forte entre clientes, orcamentos, pedidos, cobrancas, fiscal e relatorios, com leitura executiva e exportacao encaixadas no fluxo.

O posicionamento comercial tambem ja esta mais claro, com trial de 14 dias, segmentos prioritarios e planos definidos para lancamento.

A base de assinatura por workspace tambem ja existe, faltando ligar a recorrencia real no Asaas e as regras finas de acesso por status.

## Proximo passo recomendado

O principal restante agora ja nao e base de produto, e sim validacao real das integracoes criticas em producao.

## Ordem recomendada

1. validar a primeira conta ou subconta Asaas criada pelo setup
2. validar a primeira cobranca real por workspace
3. validar webhook real do Asaas com baixa automatica
4. validar a primeira NFS-e real ponta a ponta
5. depois aprofundar analitica por periodo e tendencias

Observacao:

- a central de relatorios ja existe em [app/dashboard/reports/page.tsx](./app/dashboard/reports/page.tsx)
- a exportacao em Excel ja existe em [app/api/reports/export/route.ts](./app/api/reports/export/route.ts)
- a versao de impressao em PDF ja existe em [app/dashboard/reports/print/page.tsx](./app/dashboard/reports/print/page.tsx)
- o modulo de pedidos ja existe em [app/dashboard/orders/page.tsx](./app/dashboard/orders/page.tsx)
- a base comercial de precos, trial e segmentos agora esta em [PRICING.md](./PRICING.md)
- os filtros por modulo ja ficam persistidos para `customers`, `quotes`, `orders`, `billing` e `fiscal`
- testes minimos ja existem e podem rodar com `npm test`

## Regra importante

Nao abrir BI amplo nem refazer interface antes de validar filtros de periodo e tendencias basicas.

## Comandos uteis

```bash
npm run typecheck
npm run lint
npm run build
npm run db:generate
```

## Credenciais demo

- email: `demo@gestaofacil.local`
- senha: `gestao123`
