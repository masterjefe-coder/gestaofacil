# Next Steps

## Leia primeiro

1. [STATUS.md](./STATUS.md)
2. [HANDOFF-2026-05-18.md](./HANDOFF-2026-05-18.md)
3. [prisma/schema.prisma](./prisma/schema.prisma)

## Estado atual em uma frase

O produto ja tem login, dashboard protegido, setup, clientes, orcamentos e cobrancas com fallback local, e `setup` + `quotes` + `customers` ja tem caminho funcional para banco real.

## Proximo passo recomendado

Consolidar a persistencia real usando Prisma, sem refazer a interface.

## Ordem recomendada

1. manter fallback local enquanto o banco nao estiver configurado
2. executar `prisma db push` no ambiente com banco para aplicar `passwordHash`
3. aproximar agenda e insights do dashboard do futuro fluxo de `NFS-e`
4. transformar a fila automatica de follow-up em automacoes reais de lembrete e notificacao
5. expandir auditoria para pedidos e futuras operacoes fiscais

Observacao:

- o passo `1` ja foi iniciado em [lib/data-mode.ts](./lib/data-mode.ts)
- `setup` e `quotes` ja comecaram a ser ligados ao banco
- `customers` agora ja estao ligados ao banco com bootstrap inicial do demo
- `quotes`, `orders` e `charges` agora compartilham bootstrap demo coerente em banco
- o dashboard principal agora ja le agregacoes reais
- `charges` agora ja registram data real de vencimento
- a autorizacao por workspace ja foi encaixada no modo `database`
- o onboarding real de primeiro usuario/workspace ja existe
- o workspace ja aceita colaboracao com mais de um usuario
- o ciclo basico de equipe ja cobre papel, senha e remocao
- `dueDate` ja entrou na prioridade operacional do dashboard e das cobrancas
- a auditoria minima de equipe e setup ja entrou no produto
- a fila de cobrancas agora ja permite agir rapido em atraso, vencimento do dia e reagendamento
- a auditoria de cobrancas ja entra no modo `database`
- o historico de follow-up financeiro agora ja fica persistido por cobranca
- SLA, proximo contato e fila automatica de follow-up financeiro agora ja existem
- o proximo alvo mais forte agora e ligar essa fila a automacoes reais de lembrete

## Regra importante

Nao mexer no visual antes de fechar persistencia real.

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
