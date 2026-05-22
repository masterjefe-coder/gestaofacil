# Roadmap de Reaproveitamento do Pacote do Bob

Este documento registra o que vale reaproveitar das ideias adicionadas pelo Bob, em que ordem, e sob quais condicoes.

Objetivo:
- Evoluir o projeto com criterio
- Reintroduzir apenas o que aumentar qualidade real
- Evitar novos pacotes paralelos sem aderencia ao app atual

## Principios

- Toda nova frente precisa entrar integrada ao schema, testes e fluxos reais do produto.
- Nada volta em lote gigante. Reintroduzir por fatias pequenas e verificaveis.
- Primeiro vem estabilidade operacional. Depois observabilidade, automacao e sofisticacao.
- Cada frente precisa sair com build, lint, typecheck e testes relevantes verdes.

## Prioridade 1: Manter e evoluir o que ja ficou

Estas frentes ja provaram valor e devem ser aprofundadas primeiro.

- Webhook hardening
  - Ja aproveitado: comparacao timing-safe, rate limit local e validacao de timestamp
  - Proximo passo: adicionar testes aderentes ao comportamento real das rotas

- Resiliencia das integracoes externas
  - Ja aproveitado: retry, circuit breaker, logs estruturados e idempotency key
  - Proximo passo: revisar limites, telemetria e cobertura de erro por provedor

- Security headers
  - Ja aproveitado no `next.config.ts`
  - Proximo passo: revisar CSP com base no que o frontend realmente consome

## Prioridade 2: Reintroduzir com alto ROI

Essas ideias fazem muito sentido para um produto forte, mas precisam voltar do zero certo.

- Observabilidade enxuta
  - Reintroduzir apenas depois da base estar estavel
  - Comecar com request id, logs estruturados e metricas simples
  - OpenTelemetry so depois, em rollout pequeno

- Rate limit distribuido com Redis
  - Voltar apenas quando houver necessidade operacional real
  - Deve substituir, nao duplicar, o rate limit local
  - Precisa de estrategia clara para headers, fallback e ambientes sem Redis

- CI/CD unificado
  - Ja implementado: workflow unico em `.github/workflows/ci.yml`
  - Cobertura atual: lint, typecheck, testes e build
  - Proximo passo: adicionar protecoes de branch e, se fizer sentido, status checks obrigatorios

- Testes de integracao das rotas criticas
  - Webhooks
  - Health
  - Setup de integracoes
  - Rotas de exportacao

## Prioridade 3: Reintroduzir quando o dominio pedir

Valem a pena, mas sao mais sensiveis a modelagem e precisam nascer junto da regra de negocio.

- Fila de jobs
  - Boa para webhook retry, notificacoes e tarefas assincronas
  - Deve voltar com backend real de fila, persistencia e monitoramento

- Soft delete
  - So reintroduzir junto de decisao explicita de produto e schema
  - Exige filtros consistentes, repositorios ajustados e estrategia de recuperacao

- Optimistic locking
  - Boa opcao para edicao concorrente de pedidos, cobrancas e orcamentos
  - Precisa nascer junto da UX e do schema final

- Validacao centralizada
  - Boa ideia, mas precisa espelhar o dominio real do projeto
  - O erro do pacote anterior foi criar schemas paralelos ao app

## Prioridade 4: UI utilitaria

Esses componentes podem voltar, mas so quando houver uso real em tela.

- Toast provider
- Confirmation dialog
- Loading spinner
- Progress bar
- Skeletons
- Error boundary

Condicoes para voltar:
- uso em paginas reais
- estilo aderente ao design atual
- acessibilidade validada
- sem inflar `globals.css` com classes mortas

## O que nao deve voltar como veio

- Migracao grande de banco fora do schema oficial
- Schema alternativo paralelo
- Suites de teste inventadas sem aderencia ao app real
- Workflows duplicados
- Documentos de implementacao vendendo como pronto o que era rascunho
- Utilitarios genericos baseados em `any` e introspeccao fragil

## Forma correta de reintroduzir qualquer frente

1. Definir o problema real que a frente resolve.
2. Mapear impacto em schema, runtime, UX e operacao.
3. Implementar em lote pequeno.
4. Validar com testes aderentes ao comportamento real.
5. So depois ampliar cobertura e sofisticacao.

## Ordem recomendada das proximas levas

1. Adicionar testes aderentes para webhooks e health.
2. Melhorar observabilidade basica com logs e correlacao.
3. Reintroduzir rate limit distribuido apenas se houver necessidade.
4. Avaliar fila de jobs para webhooks e tarefas assincronas.
5. Tratar soft delete e locking apenas junto de uma revisao de schema.
6. Endurecer governanca de merge com branch protection e checks obrigatorios.

## Status atual das frentes mais recentes

- CI unico: concluido
- Testes aderentes de webhook: concluido na primeira camada
- Correlacao basica com `x-request-id`: concluido nas rotas criticas
- Governanca de PR no repositorio: concluido com `CODEOWNERS`, template de PR e guia de branch protection

## Proxima melhor leva

- Expandir observabilidade util para operacao
  - padronizar `x-request-id` tambem em outras rotas sensiveis
  - melhorar logs de erro nas integracoes sem expor dado sensivel
  - avaliar um endpoint/admin view simples para diagnostico operacional antes de pensar em OpenTelemetry
