import Image from "next/image";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  connectWorkspaceAsaasAccountAction,
  connectEvolutionInstanceAction,
  createEvolutionInstanceAction,
  createWorkspaceMemberAction,
  disconnectWorkspaceAsaasAccountAction,
  removeWorkspaceMemberAction,
  resetWorkspaceMemberPasswordAction,
  updateWorkspaceMemberRoleAction,
  updateWorkspaceSetupAction,
} from "@/app/dashboard/setup/actions";
import { listAuditEntries } from "@/lib/audit-repository";
import { listWorkspaceAuditEntriesByType } from "@/lib/audit-repository";
import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/auth-session";
import { getWorkspaceSetup } from "@/lib/workspace-settings-repository";
import {
  fetchEvolutionInstances,
  getEvolutionConnectionState,
  getEvolutionIntegrationStatus,
  probeEvolutionApi,
} from "@/lib/evolution-api";
import { listWorkspaceMembers } from "@/lib/workspace-membership-repository";
import { isLocalDataMode } from "@/lib/data-mode";
import { getAsaasIntegrationStatus } from "@/lib/asaas";
import { getWorkspaceAsaasConnection } from "@/lib/asaas-workspace";
import { getNfseNationalMunicipalityStatus } from "@/lib/nfse-national-municipal-status";
import { getFiscalSetupReadiness } from "@/lib/nfse-repository";
import { getNfseEmissionModeSummary, getNfseNationalIntegrationStatus } from "@/lib/nfse-national-provider";

type SetupPageProps = {
  searchParams?: Promise<{
    evolutionMessage?: string;
    evolutionOk?: string;
    evolutionPairingCode?: string;
    evolutionQrCode?: string;
    asaasConnected?: string;
    asaasDisconnected?: string;
    asaasError?: string;
    teamCreated?: string;
    teamUpdated?: string;
    teamRemoved?: string;
    teamPasswordReset?: string;
    teamError?: string;
  }>;
};

function getEvolutionStateLabel(value: string | undefined) {
  switch (value) {
    case "open":
      return "conectada";
    case "connecting":
      return "aguardando pareamento";
    case "close":
      return "desconectada";
    default:
      return value || "desconhecido";
  }
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const [setup, members, auditEntries, evolutionAuditEntries, context, params, fiscalReadiness, evolutionProbe, evolutionInstances, workspaceAsaas] = await Promise.all([
    getWorkspaceSetup(),
    listWorkspaceMembers(),
    listAuditEntries(8),
    listWorkspaceAuditEntriesByType("evolution", 8),
    getCurrentWorkspaceContext(),
    searchParams,
    getFiscalSetupReadiness(),
    probeEvolutionApi(),
    fetchEvolutionInstances().catch(() => []),
    getWorkspaceAsaasConnection(),
  ]);
  const teamCreated = params?.teamCreated === "1";
  const teamUpdated = params?.teamUpdated === "1";
  const teamRemoved = params?.teamRemoved === "1";
  const teamPasswordReset = params?.teamPasswordReset === "1";
  const teamError = params?.teamError;
  const evolutionMessage = params?.evolutionMessage;
  const evolutionOk = params?.evolutionOk === "1";
  const evolutionPairingCode = params?.evolutionPairingCode;
  const evolutionQrCode = params?.evolutionQrCode;
  const asaasConnected = params?.asaasConnected === "1";
  const asaasDisconnected = params?.asaasDisconnected === "1";
  const asaasError = params?.asaasError;
  const canManage = isLocalDataMode() || canManageWorkspace(context.workspaceRole);
  const emissionModes = getNfseEmissionModeSummary();
  const nfseIntegration = getNfseNationalIntegrationStatus();
  const evolutionIntegration = getEvolutionIntegrationStatus();
  const asaasIntegration = getAsaasIntegrationStatus();
  const municipalityStatus = await getNfseNationalMunicipalityStatus(setup.city || "", setup.state || "");
  const selectedEvolutionInstanceName = evolutionIntegration.instance || evolutionInstances[0]?.instanceName || "";
  const selectedEvolutionInstanceState = selectedEvolutionInstanceName
    ? await getEvolutionConnectionState(selectedEvolutionInstanceName).catch(() => null)
    : null;

  return (
    <DashboardShell
      currentPath="/dashboard/setup"
      eyebrow="Setup"
      title="O sistema precisa conhecer a empresa para vender, cobrar e emitir melhor."
      description="Aqui nasce a identidade do workspace, a configuração da empresa e a base para futuras automações de cobrança e NFS-e."
      actions={
        <Link href="/dashboard" className="secondary-link">
          Voltar ao dashboard
        </Link>
      }
    >
      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Workspace e empresa</span>
            <h2>Defina a identidade operacional do negócio</h2>
          </div>
        </div>

        {!fiscalReadiness.ready ? (
          <div className="auth-hint fiscal-warning">
            <strong>Fiscal ainda não pronto</strong>
            <span>{fiscalReadiness.helper}</span>
          </div>
        ) : null}

        {canManage ? (
          <form action={updateWorkspaceSetupAction} className="inline-form">
            <label>
              <span>Nome do workspace</span>
              <input name="name" type="text" defaultValue={setup.name} required />
            </label>
            <label>
              <span>Slug</span>
              <input name="slug" type="text" defaultValue={setup.slug} required />
            </label>
            <label className="form-span-2">
              <span>Nicho</span>
              <input name="niche" type="text" defaultValue={setup.niche} />
            </label>
            <label className="form-span-2">
              <span>Razão social</span>
              <input name="legalName" type="text" defaultValue={setup.legalName} />
            </label>
            <label className="form-span-2">
              <span>Nome fantasia</span>
              <input name="tradeName" type="text" defaultValue={setup.tradeName} required />
            </label>
            <label>
              <span>Documento</span>
              <input name="document" type="text" defaultValue={setup.document} required />
            </label>
            <label>
              <span>Cidade</span>
              <input name="city" type="text" defaultValue={setup.city} />
            </label>
            <label>
              <span>UF</span>
              <input name="state" type="text" defaultValue={setup.state} />
            </label>
            <label className="form-span-2">
              <span>Descrição padrão de serviços</span>
              <input
                name="serviceDescription"
                type="text"
                defaultValue={setup.serviceDescription}
              />
            </label>
            <label>
              <span>Código IBGE detectado</span>
              <input value={setup.municipalCode || ""} type="text" readOnly />
            </label>
            <label>
              <span>Código padrão do serviço</span>
              <input
                name="defaultFiscalServiceCode"
                type="text"
                defaultValue={setup.defaultFiscalServiceCode || ""}
                placeholder="Ex.: 17.02"
              />
            </label>
            <label className="form-span-2">
              <span>Chave Pix padrão</span>
              <input name="defaultPixKey" type="text" defaultValue={setup.defaultPixKey} />
            </label>
            <label className="form-span-2">
              <span>Mensagem padrão de cobrança</span>
              <input
                name="defaultPaymentMessage"
                type="text"
                defaultValue={setup.defaultPaymentMessage}
              />
            </label>
            <button type="submit" className="primary-link form-submit">
              Salvar configurações
            </button>
          </form>
        ) : (
          <div className="auth-hint">
            <strong>Acesso de leitura</strong>
            <span>Somente owner ou admin podem alterar o setup e convidar novos usuários.</span>
          </div>
        )}
      </section>

      <section className="section-split">
        <article className="split-panel">
          <span className="section-label">Emissão assistida</span>
          <h2>Clientes sem certificado ainda conseguem emitir</h2>
          <p>{emissionModes.assisted.helper}</p>
        </article>

        <article className={nfseIntegration.ready ? "split-panel success" : "split-panel"}>
          <span className="section-label">Emissão automática</span>
          <h2>Certificado ativa a API oficial da NFS-e Nacional</h2>
          <p>{emissionModes.automatic.helper}</p>
        </article>
      </section>

      <section className="section-split">
        <article className={evolutionIntegration.enabled ? "split-panel success" : "split-panel"}>
          <span className="section-label">WhatsApp server-side</span>
          <h2>Evolution API como base das automações comerciais</h2>
          <p>{evolutionIntegration.helper}</p>
        </article>

        <article className={asaasIntegration.enabled ? "split-panel success" : "split-panel"}>
          <span className="section-label">Cobranca externa</span>
          <h2>Asaas como provedor de Pix e link de pagamento</h2>
          <p>{asaasIntegration.helper}</p>
        </article>
      </section>

      <section className="section-split">
        <article className={evolutionProbe.reachable ? "split-panel success" : "split-panel"}>
          <span className="section-label">Saúde da integração</span>
          <h2>Status do endpoint configurado</h2>
          <p>{evolutionProbe.summary}</p>
        </article>

        <article className={asaasIntegration.webhookConfigured ? "split-panel success" : "split-panel"}>
          <span className="section-label">Webhook Asaas</span>
          <h2>Baixa automatica por evento de pagamento</h2>
          <p>
            {asaasIntegration.webhookConfigured
              ? "Webhook pronto para receber PAYMENT_RECEIVED e PAYMENT_CONFIRMED."
              : "Defina token e URL publica para receber eventos do Asaas com seguranca."}
          </p>
        </article>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Canal WhatsApp</span>
            <h2>Criar e operar a instância principal da Evolution</h2>
          </div>
        </div>

        {evolutionMessage ? (
          <div className={evolutionOk ? "auth-hint" : "auth-hint fiscal-warning"}>
            <strong>{evolutionOk ? "Operação concluída" : "Operação com falha"}</strong>
            <span>{evolutionMessage}</span>
          </div>
        ) : null}

        {evolutionPairingCode ? (
          <div className="auth-hint">
            <strong>Código de pareamento</strong>
            <span>{evolutionPairingCode}</span>
            <small className="muted-text">Use este código no aparelho se preferir pareamento numérico.</small>
          </div>
        ) : null}

        {evolutionQrCode ? (
          <div className="auth-hint">
            <strong>QR para conectar o WhatsApp</strong>
            <span>Escaneie este QR com o aparelho que será usado na operação.</span>
            <Image
              src={evolutionQrCode}
              alt="QR code para pareamento da instância Evolution"
              width={280}
              height={280}
              unoptimized
              style={{ width: "100%", maxWidth: 280, height: "auto" }}
            />
          </div>
        ) : null}

        {canManage ? (
          <form action={createEvolutionInstanceAction} className="inline-form">
            <label>
              <span>Nome da instância</span>
              <input
                name="instanceName"
                type="text"
                defaultValue={setup.slug}
                placeholder="Ex.: gestao-facil-demo"
                required
              />
            </label>
            <label>
              <span>Número opcional</span>
              <input
                name="instanceNumber"
                type="text"
                placeholder="Ex.: 5511999998888"
              />
            </label>
            <button type="submit" className="primary-link form-submit">
              Criar instância
            </button>
          </form>
        ) : null}

        {selectedEvolutionInstanceName ? (
          <div className="auth-hint">
            <strong>Instância alvo</strong>
            <span>
              {selectedEvolutionInstanceName}
              {selectedEvolutionInstanceState?.instance?.state
                ? ` · estado ${getEvolutionStateLabel(selectedEvolutionInstanceState.instance.state)}`
                : ""}
            </span>
          </div>
        ) : null}

        {canManage && selectedEvolutionInstanceName ? (
          <form action={connectEvolutionInstanceAction} className="card-action">
            <input type="hidden" name="instanceName" value={selectedEvolutionInstanceName} />
            <button type="submit" className="secondary-link">
              Gerar pareamento
            </button>
          </form>
        ) : null}

        <div className="data-table">
          <div className="data-table-head">
            <span>Instância</span>
            <span>Status</span>
            <span>Dono</span>
            <span>Webhook</span>
          </div>
          {evolutionInstances.length > 0 ? evolutionInstances.map((instance) => (
            <article key={instance.instanceName} className="data-table-row">
              <div>
                <strong>{instance.instanceName}</strong>
                <small>{instance.profileName || instance.integration || "Sem perfil conectado ainda"}</small>
              </div>
              <span>{getEvolutionStateLabel(instance.status)}</span>
              <span>{instance.owner || "Aguardando conexão"}</span>
              <span>{instance.webhookUrl || evolutionIntegration.webhookUrl || "Sem webhook visível"}</span>
            </article>
          )) : (
            <article className="data-table-row">
              <span>Nenhuma instância encontrada</span>
              <span>Configure env + API</span>
              <span>-</span>
              <span>-</span>
            </article>
          )}
        </div>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Gateway de cobrança</span>
            <h2>Asaas no fluxo de recebimento e baixa automática</h2>
          </div>
        </div>

        <div className={asaasIntegration.enabled ? "auth-hint" : "auth-hint fiscal-warning"}>
          <strong>{asaasIntegration.enabled ? "Asaas configurado" : "Asaas ainda incompleto"}</strong>
          <span>{asaasIntegration.helper}</span>
          <small className="muted-text">
            Ambiente: {asaasIntegration.environment === "production" ? "produção" : "sandbox"}.
          </small>
          <small className="muted-text">
            Modo atual do workspace: {workspaceAsaas.mode === "workspace"
              ? "conta própria ou subconta conectada"
              : workspaceAsaas.mode === "root_fallback"
                ? "fallback da conta raiz"
                : "sem integração ativa"}.
          </small>
        </div>

        <div className={asaasIntegration.webhookConfigured ? "auth-hint" : "auth-hint fiscal-warning"}>
          <strong>{asaasIntegration.webhookConfigured ? "Webhook pronto para configurar no Asaas" : "Webhook ainda incompleto"}</strong>
          <span>
            {asaasIntegration.webhookUrl
              ? `URL esperada: ${asaasIntegration.webhookUrl}`
              : "Defina APP_BASE_URL ou mantenha uma URL pública derivável para expor o endpoint do webhook."}
          </span>
          <small className="muted-text">
            Header validado: `asaas-access-token`.
            {asaasIntegration.webhookTokenConfigured
              ? " Token já configurado localmente."
              : " Falta definir ASAAS_WEBHOOK_AUTH_TOKEN no ambiente."}
          </small>
          <small className="muted-text">
            Eventos recomendados: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_UPDATED` e `PAYMENT_DELETED`.
          </small>
        </div>

        {asaasConnected ? (
          <div className="auth-hint">
            <strong>Conta Asaas conectada</strong>
            <span>O workspace passa a emitir cobranças pela própria conta ou subconta configurada.</span>
          </div>
        ) : null}
        {asaasDisconnected ? (
          <div className="auth-hint fiscal-warning">
            <strong>Conta Asaas desconectada</strong>
            <span>O workspace voltou ao comportamento sem conta própria configurada.</span>
          </div>
        ) : null}
        {asaasError ? (
          <div className="auth-hint fiscal-warning">
            <strong>Falha na configuração Asaas</strong>
            <span>{asaasError}</span>
          </div>
        ) : null}

        {canManage ? (
          <form action={connectWorkspaceAsaasAccountAction} className="inline-form">
            <label className="form-span-2">
              <span>API key da conta ou subconta do workspace</span>
              <input
                name="asaasApiKey"
                type="password"
                placeholder={workspaceAsaas.mode === "workspace" ? "Preencha apenas para trocar a chave atual" : "Cole a API key da conta do cliente"}
                required={workspaceAsaas.mode !== "workspace"}
              />
            </label>
            <label>
              <span>ID da conta Asaas</span>
              <input
                name="asaasAccountId"
                type="text"
                defaultValue={setup.asaasAccountId || ""}
                placeholder="Opcional por enquanto"
              />
            </label>
            <label>
              <span>WalletId detectado</span>
              <input value={setup.asaasWalletId || workspaceAsaas.walletId || ""} type="text" readOnly />
            </label>
            <label className="form-span-2">
              <span>Split de plataforma</span>
              <div className="checkbox-row">
                <input
                  id="asaas-split-enabled"
                  name="asaasSplitEnabled"
                  type="checkbox"
                  defaultChecked={Boolean(setup.asaasSplitEnabled)}
                />
                <span>Deixar a estrutura pronta para split futuro. Por enquanto, mantenha desligado se não houver taxa.</span>
              </div>
            </label>
            <button type="submit" className="primary-link form-submit">
              Conectar conta própria
            </button>
          </form>
        ) : null}

        {canManage && workspaceAsaas.mode === "workspace" ? (
          <form action={disconnectWorkspaceAsaasAccountAction} className="card-action">
            <button type="submit" className="ghost-button">
              Desconectar conta própria
            </button>
          </form>
        ) : null}

        <div className="auth-hint">
          <strong>Estrutura recomendada</strong>
          <span>
            O melhor modelo é cada workspace cobrar pela própria conta ou subconta Asaas. O fallback da conta raiz só deve ser usado enquanto a configuração individual ainda não existir.
          </span>
        </div>
      </section>

      {municipalityStatus ? (
        <section className="data-panel">
          <div className="card-header">
            <div>
              <span className="section-label">Município emissor</span>
              <h2>Status oficial do emissor nacional para o estabelecimento</h2>
            </div>
          </div>

          <div className={municipalityStatus.aderenteEmissorNacional ? "auth-hint" : "auth-hint fiscal-warning"}>
            <strong>
              {municipalityStatus.aderenteEmissorNacional
                ? "Município habilitado para emissão pública automática"
                : "Seu município de estabelecimento ainda não possui convênio ativo para emissão pública no Emissor Nacional"}
            </strong>
            <span>
              {municipalityStatus.city}/{municipalityStatus.state}: convênio {municipalityStatus.statusConvenio.toLowerCase()}.
              {` Ambiente nacional: ${municipalityStatus.aderenteAmbienteNacional ? "sim" : "não"}.`}
              {` Emissor nacional: ${municipalityStatus.aderenteEmissorNacional ? "sim" : "não"}.`}
            </span>
            <small className="muted-text">
              Base oficial consultada em tempo de execução.
              {municipalityStatus.publication ? ` Publicação: ${municipalityStatus.publication}.` : ""}
              {municipalityStatus.startDate ? ` Vigência: ${municipalityStatus.startDate}.` : ""}
            </small>
            <small className="muted-text">
              Fonte oficial:{" "}
              <Link href={municipalityStatus.sourceUrl} target="_blank" rel="noreferrer">
                planilha pública de municípios aderentes
              </Link>
            </small>
          </div>
        </section>
      ) : null}

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Equipe do workspace</span>
            <h2>Adicionar operador, financeiro ou apoio comercial no mesmo ambiente</h2>
          </div>
        </div>

        {teamCreated ? <p className="auth-hint">Usuário adicionado ao workspace com sucesso.</p> : null}
        {teamUpdated ? <p className="auth-hint">Papel do usuário atualizado com sucesso.</p> : null}
        {teamRemoved ? <p className="auth-hint">Usuário removido do workspace com sucesso.</p> : null}
        {teamPasswordReset ? <p className="auth-hint">Senha do usuário redefinida com sucesso.</p> : null}
        {teamError ? <p className="auth-error">{teamError}</p> : null}

        {isLocalDataMode() ? (
          <div className="auth-hint">
            <strong>Modo local ativo</strong>
            <span>Com `DATABASE_URL`, esta área passa a criar usuários reais no mesmo workspace.</span>
          </div>
        ) : !canManage ? (
          <div className="auth-hint">
            <strong>Gestão restrita</strong>
            <span>Seu papel atual permite consultar a equipe, mas não adicionar novos usuários.</span>
          </div>
        ) : (
          <form action={createWorkspaceMemberAction} className="inline-form">
            <label>
              <span>Nome do usuário</span>
              <input name="memberName" type="text" placeholder="Ex.: Julia Financeiro" required />
            </label>
            <label>
              <span>Email</span>
              <input name="memberEmail" type="email" placeholder="julia@empresa.com.br" required />
            </label>
            <label>
              <span>Senha inicial</span>
              <input
                name="memberPassword"
                type="password"
                placeholder="Mínimo de 8 caracteres"
                minLength={8}
                required
              />
            </label>
            <label>
              <span>Papel</span>
              <select name="memberRole" defaultValue="MEMBER">
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
                <option value="OWNER">Owner</option>
              </select>
            </label>
            <button type="submit" className="primary-link form-submit">
              Adicionar usuário
            </button>
          </form>
        )}

        <div className="data-table">
          <div className="data-table-head">
            <span>Usuário</span>
            <span>Email</span>
            <span>Papel</span>
            <span>Entrou em</span>
            <span>Ações</span>
          </div>
          {members.map((member) => (
            <article key={member.id} className="data-table-row">
              <div>
                <strong>{member.name}</strong>
                <small>{member.isCurrentUser ? "Você" : member.role}</small>
              </div>
              <span>{member.email}</span>
              <span>{member.role}</span>
              <span>{member.joinedAt}</span>
              <div>
                {canManage && !isLocalDataMode() ? (
                  <div className="cards-grid">
                    <form action={updateWorkspaceMemberRoleAction} className="inline-form">
                      <input type="hidden" name="membershipId" value={member.id} />
                      <label>
                        <span>Papel</span>
                        <select name="memberRole" defaultValue={member.role}>
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                          <option value="OWNER">Owner</option>
                        </select>
                      </label>
                      <button type="submit" className="ghost-button">
                        Atualizar papel
                      </button>
                    </form>

                    <form action={resetWorkspaceMemberPasswordAction} className="inline-form">
                      <input type="hidden" name="membershipId" value={member.id} />
                      <label>
                        <span>Nova senha</span>
                        <input
                          name="memberPasswordReset"
                          type="password"
                          placeholder="Mínimo de 8 caracteres"
                          minLength={8}
                          required
                        />
                      </label>
                      <button type="submit" className="ghost-button">
                        Redefinir senha
                      </button>
                    </form>

                    <form action={removeWorkspaceMemberAction} className="row-action">
                      <input type="hidden" name="membershipId" value={member.id} />
                      <button type="submit" className="ghost-button">
                        Remover usuário
                      </button>
                    </form>
                  </div>
                ) : (
                  <small className="muted-text">Sem ações disponíveis</small>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-split">
        <article className="split-panel success">
          <span className="section-label">Por que isso importa</span>
          <h2>Sem setup, o produto vira cadastro solto. Com setup, ele vira sistema.</h2>
          <p>
            Esses dados vão alimentar cobrança, templates, onboarding e o futuro módulo de
            emissão fiscal.
          </p>
        </article>

        <article className="split-panel">
          <span className="section-label">Próximo uso</span>
          <h2>Base para automações e identidade comercial</h2>
          <p>
            O nome da empresa, o Pix padrão e a descrição de serviço devem aparecer nas telas
            certas para reduzir digitação e passar mais confiança.
          </p>
        </article>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Auditoria recente</span>
            <h2>Equipe e configurações sensíveis ficam registradas no workspace</h2>
          </div>
        </div>

        <div className="data-table">
          <div className="data-table-head">
            <span>Quando</span>
            <span>Responsável</span>
            <span>Evento</span>
            <span>Resumo</span>
          </div>
          {auditEntries.map((entry) => (
            <article key={entry.id} className="data-table-row">
              <span>{entry.createdAt}</span>
              <div>
                <strong>{entry.actorName}</strong>
                <small>{entry.actorEmail}</small>
              </div>
              <span>{entry.action}</span>
              <span>{entry.summary}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Atividade WhatsApp</span>
            <h2>Eventos recentes recebidos da Evolution API</h2>
          </div>
        </div>

        <div className="data-table">
          <div className="data-table-head">
            <span>Quando</span>
            <span>Origem</span>
            <span>Evento</span>
            <span>Resumo</span>
          </div>
          {evolutionAuditEntries.map((entry) => (
            <article key={entry.id} className="data-table-row">
              <span>{entry.createdAt}</span>
              <div>
                <strong>{entry.actorName}</strong>
                <small>{entry.actorEmail}</small>
              </div>
              <span>{entry.action}</span>
              <span>{entry.summary}</span>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
