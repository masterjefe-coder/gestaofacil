# Architecture

## Objetivo tecnico

Construir uma base SaaS leve, barata de operar e preparada para evoluir sem virar monolito desorganizado.

## Principios

- comecar simples
- separar bem dominio comercial, cobranca e fiscal
- priorizar velocidade de entrega
- evitar dependencias caras no inicio
- preparar multi-tenant desde o dia 1

## Stack sugerida

Frontend e app:

- Next.js
- React
- TypeScript

Backend:

- Next.js route handlers ou server actions no inicio
- Postgres
- ORM como Prisma ou Drizzle

Infra:

- VM dedicada, container ou hospedagem equivalente
- Supabase ou Postgres gerenciado
- object storage apenas se necessario

Integracoes:

- NFS-e padrao nacional
- parceiro de Pix / link de pagamento
- servico de e-mail transacional

IA:

- chamada sob demanda
- foco em resumo, sugestao e preenchimento

## Dominios principais

### Identity

- users
- workspaces
- memberships

### Company

- company profile
- fiscal settings
- billing settings

### CRM / Sales

- leads
- customers
- opportunities
- quotes

### Operations

- orders
- service items
- notes

### Billing

- charges
- payment links
- payment status
- reminders

### Fiscal

- nfse drafts
- nfse issued
- fiscal errors
- audit trail

### AI support

- conversation summaries
- quote suggestions
- service description helpers

## Data model inicial

Entidades sugeridas:

- User
- Workspace
- Company
- Customer
- ServiceCatalogItem
- Opportunity
- Quote
- QuoteItem
- Order
- Charge
- PaymentEvent
- NfseDocument
- AuditEvent

## Fluxo de integracao

### Cobranca

1. quote aprovado
2. order criado
3. charge criada
4. link ou Pix gerado
5. status atualizado por webhook ou confirmacao manual

### NFS-e

1. order concluido ou pago
2. dados consolidados do customer e service
3. documento enviado ao provedor ou API nacional
4. retorno persistido
5. erro mostrado com mensagem clara

## Estrategia de custo

- evitar processamento pesado no MVP
- evitar integrações demais no inicio
- usar IA apenas quando houver acao explicita ou alto valor
- limitar automacoes mais caras aos planos superiores

## Estrategia de evolucao

Fase 1:

- app unico
- banco unico
- modulos acoplados de forma organizada

Fase 2:

- extrair servicos de cobranca e fiscal se necessario
- adicionar filas para rotinas assincronas

Fase 3:

- observabilidade melhor
- automacoes mais amplas
- camada maior de integracoes
