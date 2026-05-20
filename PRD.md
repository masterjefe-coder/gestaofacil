# Product Requirements Document

## Product name

Gestao Facil

## Category

Sistema comercial e operacional leve para pequenos negocios de servico.

## One-line positioning

Venda pelo WhatsApp, cobre por Pix e emita nota sem retrabalho.

## Target user

Primario:

- dono de pequeno negocio de servico
- operador comercial de empresa pequena
- negocio local que vende pelo WhatsApp

Secundario:

- assistente administrativo
- financeiro enxuto
- socio operacional

Segmentos com melhor encaixe inicial:

- clinicas de estetica
- psicologos e terapeutas
- fisioterapia e nutricao
- mecanicas e auto centers
- eletricistas e instaladores
- assistencia tecnica
- consultorias e agencias
- imobiliarias de locacao e administracao

## Problem statement

Pequenos negocios de servico operam vendas de forma fragmentada:

- contato no WhatsApp
- orcamento em PDF ou texto solto
- status da venda em planilhas ou memoria
- cobranca separada
- recebimento acompanhado manualmente
- nota emitida depois com retrabalho

Esse fluxo reduz conversao, atrasa recebimentos e aumenta erros.

## Product vision

Unificar venda, cobranca, recebimento e emissao de NFS-e em uma experiencia simples, leve e guiada.

## MVP objective

Permitir que um pequeno negocio:

1. cadastre clientes
2. monte e envie orcamentos
3. converta orcamentos em vendas
4. gere cobrancas
5. acompanhe pagamentos
6. emita NFS-e sem redigitar dados

## Core workflow

1. criar ou importar cliente
2. registrar conversa ou oportunidade
3. gerar orcamento
4. aprovar orcamento
5. converter em pedido ou servico
6. gerar cobranca Pix ou link
7. marcar recebido automaticamente ou manualmente
8. emitir NFS-e
9. arquivar historico para reutilizacao futura

## Functional requirements

### 1. Authentication and account

- usuario pode criar conta
- usuario pode entrar e sair com seguranca
- cada conta comeca com um workspace simples

### 2. Company setup

- usuario cadastra dados da empresa
- usuario define dados fiscais basicos
- usuario define politica de cobranca e recebimento

### 3. Customer management

- cadastrar cliente pessoa fisica ou juridica
- editar e arquivar cliente
- visualizar historico de vendas, cobrancas e notas

### 4. Catalog and pricing

- cadastrar servicos principais
- salvar descricoes frequentes
- salvar valores padrao

### 5. Commercial pipeline

- criar oportunidade
- anexar observacoes
- registrar etapa da venda
- gerar orcamento a partir da oportunidade

### 6. Quote management

- criar orcamento
- enviar por link
- registrar aprovacao
- converter em venda sem redigitar dados

### 7. Orders / jobs

- criar pedido ou ordem de servico a partir do orcamento
- acompanhar status basico
- marcar entregue ou concluido

### 8. Billing and collections

- gerar cobranca por Pix ou link de pagamento
- registrar vencimento
- acompanhar status: pendente, pago, vencido, cancelado
- disparar lembretes simples

### 9. NFS-e

- emitir NFS-e a partir da venda concluida
- reaproveitar cliente, servico e valor
- armazenar historico de emissao
- registrar falhas de emissao com instrucoes claras

### 10. Dashboard

- mostrar vendas recentes
- mostrar cobrancas pendentes
- mostrar recebimentos
- mostrar itens prontos para nota
- mostrar clientes sem follow-up

### 11. AI assistance

No MVP, IA deve ser utilitaria:

- sugerir descricao de servico
- resumir atendimento
- sugerir proximo passo comercial

## Non-functional requirements

- interface simples e rapida
- mobile-first para uso operacional
- desktop forte para administracao
- trilha clara de auditoria
- onboarding curto
- baixo custo operacional
- arquitetura SaaS multi-tenant desde o inicio
- trial de 14 dias sem cartao no fluxo comercial inicial

## Integrations

Obrigatorias no conceito:

- NFS-e padrao nacional
- meio de cobranca com Pix ou link

Desejaveis depois:

- WhatsApp API
- bancos
- automacao de marketing

## Success metrics

Produto:

- tempo medio para criar primeiro orcamento
- taxa de conversao de orcamento em venda
- percentual de cobrancas pagas no prazo
- percentual de vendas que viram nota sem retrabalho
- usuarios ativos semanalmente

Negocio:

- primeiro grupo de clientes pagantes
- churn baixo nos primeiros 90 dias
- baixo volume de suporte por cliente
- CAC compativel com ticket do produto

## Risks

- escopo crescer para ERP generico
- integracao fiscal consumir mais esforco que o fluxo comercial
- excesso de IA sem ganho pratico
- depender de segmentos muito diferentes entre si

## Product principles

- simplicidade vence completude
- fluxo vence modulo isolado
- automacao so entra se economizar tempo real
- fiscal complementa vendas, nao substitui a proposta central
