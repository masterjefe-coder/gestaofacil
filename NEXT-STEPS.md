# Next Steps

## Leia primeiro

1. [STATUS.md](./STATUS.md)
2. [HANDOFF-2026-05-20.md](./HANDOFF-2026-05-20.md)
3. [prisma/schema.prisma](./prisma/schema.prisma)

## Estado atual em uma frase

O produto ja tem um core operacional forte entre clientes, orcamentos, cobrancas, fiscal e relatorios, com leitura executiva e exportacao encaixadas no fluxo.

## Proximo passo recomendado

Se esta frente estiver fechada, o proximo bloco real e aprofundar a camada analitica sem desmontar a operacao.

## Ordem recomendada

1. adicionar filtros de periodo aos relatorios
2. criar comparacao semanal e mensal de comercial, recebimento e fiscal
3. expor tendencias de conversao, recebimento e emissao
4. em paralelo, validar a emissao nacional com certificado real e municipio piloto
5. so depois decidir se vale abrir uma camada de BI mais ampla

Observacao:

- a central de relatorios ja existe em [app/dashboard/reports/page.tsx](./app/dashboard/reports/page.tsx)
- a exportacao em Excel ja existe em [app/api/reports/export/route.ts](./app/api/reports/export/route.ts)
- a versao de impressao em PDF ja existe em [app/dashboard/reports/print/page.tsx](./app/dashboard/reports/print/page.tsx)
- os filtros por modulo ja ficam persistidos para `customers`, `quotes`, `billing` e `fiscal`
- a proxima entrega de produto nao precisa abrir modulo novo; ela pode aprofundar a leitura historica da operacao atual

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
