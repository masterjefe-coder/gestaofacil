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
4. conectar canais externos de cobranca e emissao fiscal a integracoes reais
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
- a fila automatica agora ja gera lembretes operacionais com mensagem pronta e registro de envio
- a fila automatica agora ja abre WhatsApp e email com mensagem pronta
- o modulo fiscal inicial agora ja existe com fila de NFS-e e controle de status
- o billing agora ja empurra recebimentos pagos para o proximo passo fiscal
- o setup agora ja mostra quando a empresa ainda nao tem base suficiente para emissao
- o fiscal agora ja tem base para emissao rapida por nome ou CPF/CNPJ
- a integracao oficial da NFS-e Nacional agora ja tem client, envs, assinatura de DPS e tentativa de emissao pelo endpoint oficial
- o produto agora ja deixa claro o caminho assistido via portal oficial e o caminho automatico com certificado
- o proximo alvo mais forte agora e validar o leiaute DPS com um certificado real e ajustar os campos fiscais finos do primeiro municipio piloto

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
