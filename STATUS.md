# Status

## Data

2026-05-20

## O que ja foi feito

- documentacao central do produto criada
- projeto Next.js inicializado na raiz
- landing page alinhada ao novo posicionamento do Gestao Facil
- landing page agora ja comunica trial de 14 dias, planos e segmentos com melhor encaixe
- pagina publica de planos agora existe em `/planos`
- onboarding agora ja nasce com trial de 14 dias e plano preferido por workspace
- dashboard conceitual criado com shell reutilizavel
- navegacao lateral inicial do workspace criada
- modulos conceituais de clientes, orcamentos e cobrancas criados
- dominio mock mais realista criado em `lib/mock-data.ts`
- persistencia local do workspace criada em `data/demo-workspace.json`
- CRUD inicial de clientes implementado com server actions
- rota `GET/POST /api/customers` criada
- CRUD inicial de orcamentos implementado com server actions
- rota `GET/POST /api/quotes` criada
- CRUD inicial de cobrancas implementado com server actions
- rota `GET/POST /api/charges` criada
- cobrancas podem nascer de orcamentos aprovados
- setup inicial de workspace e empresa implementado
- rota `GET/POST /api/setup` criada
- sidebar agora usa dados reais do workspace local
- autenticacao migrada para Auth.js via `next-auth` estavel
- login em `/login`, logout pelo dashboard e rota `/api/auth/[...nextauth]` adicionados
- dashboard protegido por sessao server-side com `getServerSession`
- decisao de modo `local` vs `database` centralizada em `lib/data-mode.ts`
- bootstrap do workspace demo no banco criado em `lib/demo-workspace-bootstrap.ts`
- `setup` e `quotes` ja estao preparados para modo `database`
- entidade minima de `orders` criada no app
- fluxo `quote -> order -> charge` preparado para modo local e banco
- repositório de `customers` ligado ao Prisma com bootstrap inicial do demo
- `customers` agora preservam `segment`, `status` e `note` no banco
- listagem de `customers` em modo banco agora calcula `openAmount` a partir de cobrancas e reaproveita historico de venda paga
- bootstrap compartilhado do fluxo demo agora semeia `customers`, `quotes`, `orders` e `charges` no banco
- `quotes` e `charges` agora preservam melhor o contexto operacional da UI mesmo em modo `database`
- dashboard principal agora calcula `stats`, `pipeline` e `agenda` a partir dos dados reais do workspace
- `charges` agora aceitam `dueDate` real no formulario, API, modo local e modo `database`
- sessao do `next-auth` agora carrega `userId`, `workspaceId` e `workspaceRole`
- APIs de `customers`, `quotes`, `charges` e `setup` agora exigem sessao autenticada
- repositórios em modo `database` passaram a resolver `workspaceId` pela sessao atual
- onboarding real em `/onboarding` agora cria `user`, `workspace`, `company` e `membership`
- login por credenciais agora aceita usuarios reais do banco alem do acesso demo
- `setup` agora lista membros do workspace e permite adicionar novos usuarios com papel
- `OWNER` e `ADMIN` passaram a controlar setup e gestao de equipe
- equipe do workspace agora permite trocar papel, redefinir senha e remover membro
- regras de seguranca evitam remover o ultimo `OWNER` ou deixar o workspace sem dono
- `dueDate` agora ordena cobrancas por prioridade real e influencia agenda e indicadores do dashboard
- auditoria minima agora registra alteracoes de setup, criacao e remocao de membro, troca de papel e reset de senha
- dashboard, orcamentos e cobrancas lendo da fonte central do workspace
- cobrancas agora aceitam acoes operacionais rapidas para marcar hoje, reagendar ou dar baixa
- cobrancas em modo `database` agora registram auditoria em criacao, atualizacao e remocao
- cobrancas agora carregam historico de follow-up financeiro com canal, retorno e observacao
- o painel de cobrancas agora permite registrar novos contatos financeiros por item
- o follow-up financeiro agora calcula SLA, proximo contato e prioridade automatica por cobranca
- dashboard e cobrancas agora usam a mesma fila automatica de follow-up financeiro
- cobrancas agora geram fila de lembretes operacionais com canal sugerido e mensagem pronta
- o painel financeiro agora registra envio de lembrete direto da automacao operacional
- a fila automatica agora abre WhatsApp e email com mensagem pronta a partir de cada lembrete
- modulo fiscal inicial em `/dashboard/fiscal` agora organiza rascunhos, prontas, emitidas e erros
- a fila fiscal agora nasce de recebimentos confirmados e permite criar rascunho de NFS-e
- cobrancas pagas agora ja mostram o proximo passo fiscal direto no painel financeiro
- o setup e o fiscal agora expoem prontidao fiscal da empresa antes da emissao
- o fiscal agora ja aceita emissao rapida por nome ou CPF/CNPJ para cliente cadastrado
- o fiscal agora ja conhece o ambiente oficial da NFS-e Nacional com configuracao por ambiente, assinatura de DPS e teste de conectividade
- o produto agora ja separa emissao assistida via portal oficial e emissao automatica com certificado
- a emissao automatica agora consulta a base oficial publica de municipios aderentes e so libera emissao quando o estabelecimento estiver com `AderenteEmissorNacional = Sim`
- o teste oficial da NFS-e Nacional agora ja avancou alem de certificado e schema, chegando ate regras de negocio reais do emitente e do municipio
- dashboard, clientes, orcamentos, cobrancas e fiscal agora ja persistem foco de fila por modulo
- central de relatorios em `/dashboard/reports` agora consolida resumo executivo, comercial, financeiro, clientes e fiscal
- exportacao em `Excel` agora sai por `/api/reports/export`
- versao pronta para impressao em `PDF` agora existe em `/dashboard/reports/print`
- modulo de pedidos agora ja existe em `/dashboard/orders` com fila operacional explicita
- API de pedidos agora existe em `/api/orders`
- Asaas agora ja aceita conta por workspace, subconta guiada e fallback temporario da conta raiz
- o setup agora ja guia a equipe entre criar conta de recebimento no Asaas ou conectar uma conta existente
- o racional comercial de trial, segmentos e planos agora ja esta consolidado em documentacao e site
- a base de assinatura SaaS agora ja existe por workspace, com plano, ciclo, status e referencia pronta para recorrencia futura
- testes automatizados minimos agora ja existem para utilitarios criticos
- endpoint `/api/health` criado
- schema Prisma inicial criado em `prisma/schema.prisma`
- `.env.example` e scripts de banco adicionados
- estrutura visual preparada para evoluir o MVP
- `typecheck`, `lint`, `build` e `prisma validate` validados com sucesso

## Rotas atuais

- `/`
- `/login`
- `/planos`
- `/onboarding`
- `/dashboard`
- `/dashboard/customers`
- `/dashboard/quotes`
- `/dashboard/orders`
- `/dashboard/billing`
- `/dashboard/fiscal`
- `/dashboard/reports`
- `/dashboard/reports/print`
- `/dashboard/setup`
- `/api/customers`
- `/api/quotes`
- `/api/charges`
- `/api/orders`
- `/api/setup`
- `/api/auth/[...nextauth]`
- `/api/health`
- `/api/reports/export`

## Decisao de produto consolidada

Gestao Facil sera um sistema comercial WhatsApp-first para pequenos negocios de servico, focado em:

- clientes
- orcamentos
- cobrancas
- recebimentos
- NFS-e no fluxo

## Proximo bloco recomendado

1. validar Asaas real por workspace com conta ou subconta do cliente
2. validar webhook real do Asaas com recebimento real
3. validar a emissao nacional com certificado real e municipio piloto
4. validar operacao real de WhatsApp em rotina
5. so depois aprofundar analitica por periodo e tendencias

## Observacoes tecnicas

- o banco ja esta modelado, mas ainda nao conectado a um ambiente real de producao
- ainda nao ha integracoes externas fechadas ponta a ponta
- a autenticacao atual usa Auth.js com provider de credenciais demo e login real por banco quando configurado
- o dashboard principal ja nao depende de pipeline e agenda mockados
- o produto agora ja tem um modulo explicito de pedidos entre orcamento e cobranca
- cobrancas ja podem carregar data real alem do texto operacional
- o contexto de workspace ja nasce da sessao no modo `database`
- o app ja consegue criar o primeiro usuario real e seu workspace inicial
- o mesmo workspace ja aceita mais de um usuario real com papel definido
- o ciclo basico de gestao de equipe ja esta operacional no `setup`
- o `setup` agora ja mostra trilha recente de auditoria para operacoes sensiveis
- `charges` agora usam `orders` como base estrutural
- a automacao atual abre canais externos com mensagem pronta, mas ainda nao confirma entrega real por integracao
- o Asaas por workspace agora ja esta pronto estruturalmente, mas ainda depende da primeira validacao real ponta a ponta
- o bloco fiscal atual agora ja prepara DPS assinada, assina, envia ao endpoint oficial correto e bloqueia a emissao automatica quando o municipio do estabelecimento nao estiver habilitado no Emissor Nacional
- a emissao real final ainda depende da habilitacao oficial do municipio e da coerencia cadastral do estabelecimento do CNPJ na base nacional
- a camada de relatorios atual ainda trabalha em snapshot operacional; historico por periodo e tendencias ainda nao entraram
- o workspace local serve como ambiente de produto enquanto o banco real nao entra
