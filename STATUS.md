# Status

## Data

2026-05-18

## O que ja foi feito

- documentacao central do produto criada
- projeto Next.js inicializado na raiz
- landing page alinhada ao novo posicionamento do Gestao Facil
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
- `dueDate` agora ordena cobrancas por prioridade real e influencia agenda/indicadores do dashboard
- auditoria minima agora registra alteracoes de setup, criacao/remocao de membro, troca de papel e reset de senha
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
- cobrancas pagas agora já mostram o próximo passo fiscal direto no painel financeiro
- o setup e o fiscal agora expõem prontidão fiscal da empresa antes da emissão
- o fiscal agora já aceita emissão rápida por nome ou CPF/CNPJ para cliente cadastrado
- o fiscal agora já conhece o ambiente oficial da NFS-e Nacional com configuração por ambiente, assinatura de DPS e teste de conectividade
- o produto agora já separa emissão assistida via portal oficial e emissão automática com certificado
- a emissão automática agora consulta a base oficial pública de municípios aderentes e só libera emissão quando o estabelecimento estiver com `AderenteEmissorNacional = Sim`
- o teste oficial da NFS-e Nacional agora já avançou além de certificado e schema, chegando até regras de negócio reais do emitente e do município
- endpoint `/api/health` criado
- schema Prisma inicial criado em `prisma/schema.prisma`
- `.env.example` e scripts de banco adicionados
- estrutura visual preparada para evoluir o MVP
- `typecheck`, `lint`, `build` e `prisma validate` validados com sucesso

## Rotas atuais

- `/`
- `/dashboard`
- `/dashboard/customers`
- `/dashboard/quotes`
- `/dashboard/billing`
- `/dashboard/setup`
- `/login`
- `/api/customers`
- `/api/quotes`
- `/api/charges`
- `/api/setup`
- `/api/auth/[...nextauth]`
- `/api/health`

## Decisao de produto consolidada

Gestao Facil sera um sistema comercial WhatsApp-first para pequenos negocios de servico, focado em:

- clientes
- orcamentos
- cobrancas
- recebimentos
- NFS-e no fluxo

## Proximo bloco recomendado

1. conectar a auth atual a usuarios reais no banco quando for a hora
2. conectar o setup de workspace/empresa ao banco real quando houver `DATABASE_URL`
3. executar `prisma db push` no ambiente com banco para materializar `passwordHash`
4. preparar auditoria minima para mudancas de equipe, setup e cobranca
5. comecar a transformar cobrancas atrasadas em gatilhos de follow-up mais acionaveis

## Observacoes tecnicas

- o banco ja esta modelado, mas ainda nao conectado a um ambiente real
- ainda nao ha integracoes externas
- a autenticacao atual usa Auth.js com provider de credenciais demo
- a UI atual ja tem leitura e escrita local para clientes
- a UI atual ja tem leitura e escrita local para orcamentos
- a UI atual ja tem leitura e escrita local para cobrancas
- a UI atual ja tem leitura e escrita local para setup de workspace e empresa
- `setup` e `quotes` ja tem caminho de persistencia para banco
- `customers` ja tem caminho funcional de persistencia para banco
- `quotes`, `orders` e `charges` agora compartilham bootstrap demo coerente em banco
- o dashboard principal ja nao depende de pipeline e agenda mockados
- cobrancas ja podem carregar data real alem do texto operacional
- o contexto de workspace ja nasce da sessao no modo `database`
- o app ja consegue criar o primeiro usuario real e seu workspace inicial
- o mesmo workspace ja aceita mais de um usuario real com papel definido
- o ciclo basico de gestao de equipe ja esta operacional no `setup`
- cobrancas com data real ja sobem e descem na fila conforme urgencia
- o `setup` agora ja mostra trilha recente de auditoria para operacoes sensiveis
- `charges` agora usam `orders` como base estrutural
- a fila financeira agora permite acao rapida direto do painel de cobrancas
- a auditoria de cobrancas depende do modo `database`, mas ja esta encaixada no fluxo
- o historico de follow-up financeiro agora persiste no metadata da cobranca sem exigir migration imediata
- a cadencia de follow-up agora nasce do vencimento e do ultimo retorno do cliente
- a automacao atual abre canais externos com mensagem pronta, mas ainda nao confirma entrega real por integracao
- o bloco fiscal atual agora ja prepara DPS assinada, assina, envia ao endpoint oficial correto e bloqueia a emissão automática quando o município do estabelecimento não estiver habilitado no Emissor Nacional
- a emissão real final ainda depende da habilitação oficial do município e da coerência cadastral do estabelecimento do CNPJ na base nacional
- o workspace local serve como ambiente de produto enquanto o banco real nao entra
