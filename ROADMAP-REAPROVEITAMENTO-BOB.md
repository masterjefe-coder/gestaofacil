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
- Diagnostics/admin view operacional: concluido com endpoint, painel no setup, resumo na home, shell e navegacao contextual
- Telemetria de retry/circuit breaker por provedor: concluido na camada operacional atual
- CSP e security headers: revisados para uma politica mais restrita e aderente ao app atual

## Status consolidado do reaproveitamento

- Concluido
  - Webhook hardening com validacao, rate limit local, timestamp e testes aderentes
  - Correlacao com `x-request-id` nas rotas criticas e nas integracoes externas
  - Logs estruturados com sanitizacao de erro externo
  - Resumo operacional no dashboard, shell, sidebar e modulos com deep links de acao
  - Testes aderentes das rotas criticas de webhook, health, setup, exportacao e integracoes operacionais
  - CI unico com job `quality`
  - Security headers base e CSP revisada

- Parcialmente concluido
  - Resiliencia das integracoes externas
    - Retry, circuit breaker, idempotency key e telemetria operacional por provedor ja entraram
    - Ainda falta calibracao fina de limites por ambiente e por provedor com dados reais de producao
  - Observabilidade enxuta
    - Request id, logs estruturados, endpoint de diagnostico e view admin ja entraram
    - Ainda faltam metricas mais formais e eventualmente rollout pequeno de OpenTelemetry
  - Rate limit distribuido
    - Ja existe modo distribuido persistido com fallback local, headers coerentes e diagnostico operacional
    - Ainda falta trocar o backend por Redis quando houver necessidade real de multi-instancia pesada
  - Fila de jobs
    - Ja existe persistencia de jobs, leasing, retry basico, dedupe e visibilidade operacional
    - Ainda falta worker dedicado, observabilidade de execucao e backend de fila mais forte se o volume crescer
  - Soft delete
    - Schema, repositorios centrais e leituras operacionais criticas ja consideram `deletedAt`
    - Ainda falta estrategia explicita de restauracao e propagacao total para todos os read models restantes
  - Validacao centralizada
    - Rotas criticas e actions principais ja usam parsing compartilhado aderente ao dominio real
    - Ainda falta ampliar isso para toda superficie restante do produto
  - Governanca de merge
    - Workflow, `quality`, `CODEOWNERS` e template estao no lugar
    - Ainda depende de o repositorio manter branch protection e status checks exigidos no GitHub

- Pendente
  - Optimistic locking para edicao concorrente
  - UI utilitaria apenas onde houver uso real, acessibilidade e aderencia visual

## Proximas levas mais fortes

1. Calibrar resiliência por provedor com limites reais de produção
   - revisar `maxAttempts`, timeout, abertura e recuperação de breaker por integração
   - separar melhor falha transitória de falha funcional de provedor
2. Decidir se já existe necessidade operacional real de rate limit distribuído
   - se sim, substituir a estratégia local em vez de duplicar
3. Avaliar fila de jobs para webhooks e tarefas assíncronas
   - próximo passo real: worker dedicado, reconciliação e processamento desacoplado contínuo
4. Fechar optimistic locking e restauração de soft delete junto de revisão explícita de UX e schema
