import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { EvolutionPairingPanel } from "@/components/evolution-pairing-panel";
import {
  connectWorkspaceAsaasAccountAction,
  createWorkspaceAsaasSubaccountAction,
  createEvolutionInstanceAction,
  createWorkspaceMemberAction,
  createWorkspaceSubscriptionCheckoutAction,
  disconnectWorkspaceAsaasAccountAction,
  removeWorkspaceMemberAction,
  resetWorkspaceMemberPasswordAction,
  updateWorkspaceMemberRoleAction,
  updateWorkspaceSubscriptionPlanAction,
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
import { getWorkspaceAsaasConnection, getWorkspaceAsaasOnboardingSnapshot } from "@/lib/asaas-workspace";
import { getNfseNationalMunicipalityStatus } from "@/lib/nfse-national-municipal-status";
import { getFiscalSetupReadiness } from "@/lib/nfse-repository";
import { getNfseEmissionModeSummary, getNfseNationalIntegrationStatus } from "@/lib/nfse-national-provider";
import { formatSubscriptionDate, getBillingCycleLabel, getSubscriptionPlanPresentation, getSubscriptionStatusLabel, getTrialRemainingDays } from "@/lib/subscription";
import { getWorkspaceSubscription } from "@/lib/workspace-subscription-repository";
import { pricingPlans } from "@/lib/site-data";

type SetupPageProps = {
  searchParams?: Promise<{
    evolutionMessage?: string;
    evolutionOk?: string;
    asaasConnected?: string;
    asaasCreated?: string;
    asaasDisconnected?: string;
    asaasError?: string;
    subscriptionUpdated?: string;
    subscriptionCheckoutCreated?: string;
    subscriptionError?: string;
    subscriptionIntent?: string;
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
  const [setup, members, auditEntries, evolutionAuditEntries, context, params, fiscalReadiness, evolutionProbe, evolutionInstances, workspaceAsaas, workspaceAsaasOnboarding, subscription] = await Promise.all([
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
    getWorkspaceAsaasOnboardingSnapshot(),
    getWorkspaceSubscription(),
  ]);
  const teamCreated = params?.teamCreated === "1";
  const teamUpdated = params?.teamUpdated === "1";
  const teamRemoved = params?.teamRemoved === "1";
  const teamPasswordReset = params?.teamPasswordReset === "1";
  const teamError = params?.teamError;
  const evolutionMessage = params?.evolutionMessage;
  const evolutionOk = params?.evolutionOk === "1";
  const asaasConnected = params?.asaasConnected === "1";
  const asaasCreated = params?.asaasCreated === "1";
  const asaasDisconnected = params?.asaasDisconnected === "1";
  const asaasError = params?.asaasError;
  const subscriptionUpdated = params?.subscriptionUpdated === "1";
  const subscriptionCheckoutCreated = params?.subscriptionCheckoutCreated === "1";
  const subscriptionError = params?.subscriptionError;
  const subscriptionIntent = params?.subscriptionIntent === "1";
  const canManage = isLocalDataMode() || canManageWorkspace(context.workspaceRole);
  const emissionModes = getNfseEmissionModeSummary();
  const nfseIntegration = getNfseNationalIntegrationStatus();
  const evolutionIntegration = getEvolutionIntegrationStatus();
  const asaasIntegration = getAsaasIntegrationStatus();
  const municipalityStatus = await getNfseNationalMunicipalityStatus(setup.city || "", setup.state || "");
  const workspaceEvolutionInstance = evolutionInstances.find((instance) => instance.instanceName === setup.slug);
  const fallbackEvolutionInstance = evolutionInstances.find((instance) => instance.instanceName === evolutionIntegration.instance);
  const selectedEvolutionInstanceName =
    workspaceEvolutionInstance?.instanceName
    || fallbackEvolutionInstance?.instanceName
    || evolutionIntegration.instance
    || evolutionInstances[0]?.instanceName
    || "";
  const selectedEvolutionInstanceState = selectedEvolutionInstanceName
    ? await getEvolutionConnectionState(selectedEvolutionInstanceName).catch(() => null)
    : null;
  const isUsingWorkspaceEvolutionInstance = selectedEvolutionInstanceName === setup.slug;
  const subscriptionPlan = getSubscriptionPlanPresentation(subscription.plan);
  const trialRemainingDays = getTrialRemainingDays(subscription);
  const localMode = isLocalDataMode();

  return (
    <DashboardShell
      currentPath="/dashboard/setup"
      eyebrow="Empresa"
      title="Deixe a empresa pronta para vender, cobrar e atender sem atrito."
      description="Aqui você organiza os dados principais, conecta os canais e deixa a operação mais prática para o dia a dia."
      actions={
        <Link href="/dashboard" className="secondary-link">
          Voltar ao dashboard
        </Link>
      }
    >
      <section className="dashboard-overview-hero module-overview-hero">
        <article className="dashboard-spotlight-card fade-in-up">
          <div className="dashboard-spotlight-header">
            <div>
              <span className="section-label">Leitura estrutural</span>
              <h2>Essa área mostra se a empresa já está pronta para operar com segurança.</h2>
            </div>
            <span className={`dashboard-priority-badge ${fiscalReadiness.ready ? "priority-normal" : "priority-critical"}`}>
              {fiscalReadiness.ready ? "Tudo em ordem" : "Falta ajustar"}
            </span>
          </div>
          <p>
            {fiscalReadiness.helper} Aqui ficam os dados da empresa, cobrança, WhatsApp e equipe no mesmo lugar.
          </p>

          <div className="dashboard-top-metrics">
            <article className="dashboard-metric-tile">
              <span>Fiscal</span>
              <strong>{fiscalReadiness.ready ? "Pronto" : "Parcial"}</strong>
              <small>{fiscalReadiness.ready ? "A empresa já consegue seguir o fluxo de cobrança e emissão." : fiscalReadiness.helper}</small>
            </article>
            <article className="dashboard-metric-tile">
              <span>Assinatura</span>
              <strong>{getSubscriptionStatusLabel(subscription.status)}</strong>
              <small>{subscriptionPlan.name} em {getBillingCycleLabel(subscription.billingCycle).toLowerCase()}.</small>
            </article>
            <article className="dashboard-metric-tile">
              <span>WhatsApp</span>
              <strong>{evolutionIntegration.enabled ? "Ativo" : "Pendente"}</strong>
              <small>{evolutionIntegration.helper}</small>
            </article>
            <article className="dashboard-metric-tile">
              <span>Cobrança</span>
              <strong>{asaasIntegration.enabled ? "Ativo" : "Pendente"}</strong>
              <small>{asaasIntegration.helper}</small>
            </article>
          </div>
        </article>

        <aside className="dashboard-overview-stack">
          <article className="dashboard-mini-panel fade-in-up fade-delay-1">
            <span className="section-label">Objetivo do módulo</span>
            <div className="dashboard-mini-list">
              <article>
                <strong>Organizar a operação</strong>
                <p>A empresa precisa ter dados, cobrança, WhatsApp e equipe bem alinhados para o trabalho fluir.</p>
              </article>
              <article>
                <strong>Evitar travas depois</strong>
                <p>Quando essa base está ajustada, você evita retrabalho na cobrança, no atendimento e na emissão.</p>
              </article>
            </div>
          </article>

          <article className="dashboard-mini-panel fade-in-up fade-delay-2">
            <span className="section-label">Atalhos rápidos</span>
            <div className="dashboard-shortcuts-grid">
              <a href="#subscription-section" className="dashboard-shortcut-card">
                <strong>Assinatura</strong>
                <span>Ver plano</span>
              </a>
              <a href="#team-section" className="dashboard-shortcut-card">
                <strong>Equipe</strong>
                <span>Gerenciar acessos</span>
              </a>
              <a href="#integrations-section" className="dashboard-shortcut-card">
                <strong>Integrações</strong>
                <span>Conectar serviços</span>
              </a>
              <Link href="/dashboard" className="dashboard-shortcut-card">
                <strong>Dashboard</strong>
                <span>Voltar ao comando</span>
              </Link>
            </div>
          </article>
        </aside>
      </section>

      {localMode ? (
        <div className="auth-hint fiscal-warning">
          <strong>Ambiente de teste</strong>
          <span>
            Este ambiente é só para teste e não mostra automaticamente os dados reais criados no site.
          </span>
          <small className="muted-text">
            Para validar usuários e integrações reais, o sistema precisa estar ligado ao banco oficial.
          </small>
        </div>
      ) : null}

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Resumo rápido</span>
            <h2>O que já está pronto e o que ainda falta ajustar</h2>
          </div>
        </div>

        <div className="cards-grid quote-grid">
          <article className="dashboard-card">
            <span className="dashboard-kicker">Ambiente</span>
            <h3>{localMode ? "Teste local" : "Dados reais"}</h3>
            <p>
              {localMode
                ? "Bom para testar a interface, mas não confirma clientes e empresas reais."
                : "Ligado ao banco oficial e pronto para refletir o que acontece no produto real."}
            </p>
          </article>

          <article className="dashboard-card">
            <span className="dashboard-kicker">Plano</span>
            <h3>{subscription.asaasSubscriptionId ? "Cobrança pronta" : "Cobrança pendente"}</h3>
            <p>
              {subscription.asaasSubscriptionId
                ? "O plano já está ligado à cobrança automática."
                : "O plano já existe no sistema, mas ainda falta preparar a cobrança automática."}
            </p>
          </article>

          <article className="dashboard-card">
            <span className="dashboard-kicker">Recebimentos</span>
            <h3>{workspaceAsaas.mode === "workspace" ? "Conta conectada" : "Conta pendente"}</h3>
            <p>
              {workspaceAsaas.mode === "workspace"
                ? "A conta já está pronta para receber e acompanhar pagamentos."
                : "Ainda falta conectar a conta que vai receber os pagamentos da empresa."}
            </p>
          </article>

          <article className="dashboard-card">
            <span className="dashboard-kicker">Emissão</span>
            <h3>{nfseIntegration.ready ? "Base pronta" : "Base incompleta"}</h3>
            <p>
              {nfseIntegration.ready
                ? "A empresa já está mais perto de emitir sem retrabalho."
                : "Ainda faltam alguns dados antes de deixar a emissão pronta no fluxo."}
            </p>
          </article>
        </div>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Dados da empresa</span>
            <h2>Organize a base principal do negócio</h2>
          </div>
        </div>

        {!fiscalReadiness.ready ? (
          <div className="auth-hint fiscal-warning">
            <strong>Alguns dados ainda faltam</strong>
            <span>{fiscalReadiness.helper}</span>
          </div>
        ) : null}

        {canManage ? (
          <form action={updateWorkspaceSetupAction} className="inline-form">
            <label>
              <span>Nome interno da empresa</span>
              <input name="name" type="text" defaultValue={setup.name} required />
            </label>
            <label>
              <span>Identificador interno</span>
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
              <span>Código da cidade</span>
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
            <strong>Somente leitura</strong>
            <span>Apenas perfis com permissão de gestão podem alterar estes dados e convidar pessoas.</span>
          </div>
        )}
      </section>

      <section className="section-split">
        <article className="split-panel">
          <span className="section-label">Emissão assistida</span>
          <h2>Mesmo sem certificado, dá para seguir com apoio manual</h2>
          <p>{emissionModes.assisted.helper}</p>
        </article>

        <article className={nfseIntegration.ready ? "split-panel success" : "split-panel"}>
          <span className="section-label">Emissão automática</span>
          <h2>Com certificado, a emissão fica mais automática</h2>
          <p>{emissionModes.automatic.helper}</p>
        </article>
      </section>

      <section className="section-split">
        <article className={subscription.status === "TRIALING" ? "split-panel success" : "split-panel"}>
          <span className="section-label">Assinatura da empresa</span>
          
          <h2>{subscriptionPlan.name} em {getBillingCycleLabel(subscription.billingCycle).toLowerCase()}</h2>
          <p>
            Status atual: {getSubscriptionStatusLabel(subscription.status)}.
            {trialRemainingDays !== null ? ` Restam ${trialRemainingDays} dia(s) no trial.` : ""}
          </p>
        </article>

        <article className={evolutionIntegration.enabled ? "split-panel success" : "split-panel"}>
          <span className="section-label">WhatsApp da empresa</span>
          <h2>Canal pronto para mensagens, lembretes e respostas</h2>
          <p>{evolutionIntegration.helper}</p>
        </article>

        <article className={asaasIntegration.enabled ? "split-panel success" : "split-panel"}>
          <span className="section-label">Recebimentos</span>
          <h2>Conta pronta para Pix, boleto, cartão e links de pagamento</h2>
          <p>{asaasIntegration.helper}</p>
        </article>
      </section>

      <section className="section-split">
        <article className={evolutionProbe.reachable ? "split-panel success" : "split-panel"}>
          <span className="section-label">Status do WhatsApp</span>
          <h2>Conexão do canal principal</h2>
          <p>{evolutionProbe.summary}</p>
        </article>

        <article className={asaasIntegration.webhookConfigured ? "split-panel success" : "split-panel"}>
          <span className="section-label">Atualização de pagamentos</span>
          <h2>Confirmação automática quando o cliente paga</h2>
          <p>
            {asaasIntegration.webhookConfigured
              ? "O sistema já consegue receber a confirmação de pagamento automaticamente."
              : "Ainda falta concluir a ligação automática entre a conta de cobrança e o sistema."}
          </p>
        </article>
      </section>

      <section id="subscription-section" className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Plano</span>
            <h2>Plano da empresa e cobrança automática</h2>
          </div>
        </div>

        <div className={subscription.status === "TRIALING" ? "auth-hint" : "auth-hint fiscal-warning"}>
          <strong>{getSubscriptionStatusLabel(subscription.status)}</strong>
          <span>
            Plano atual: {subscriptionPlan.name} ({subscriptionPlan.price}).
            {subscription.trialEndsAt ? ` Trial até ${formatSubscriptionDate(subscription.trialEndsAt)}.` : ""}
          </span>
          <small className="muted-text">
            Ciclo escolhido: {getBillingCycleLabel(subscription.billingCycle)}.
            {subscription.notes ? ` ${subscription.notes}` : ""}
          </small>
        </div>

        {subscriptionIntent ? (
          <div className="auth-hint">
            <strong>Próximo passo</strong>
            <span>A empresa já está em teste. Se quiser deixar a cobrança automática pronta, faça isso aqui embaixo.</span>
          </div>
        ) : null}

        {subscriptionUpdated ? (
          <div className="auth-hint">
            <strong>Plano atualizado</strong>
            <span>O plano da empresa foi ajustado com sucesso.</span>
          </div>
        ) : null}
        {subscriptionCheckoutCreated ? (
          <div className="auth-hint">
            <strong>Cobrança automática criada</strong>
            <span>O plano da empresa já está ligado à cobrança automática.</span>
          </div>
        ) : null}
        {subscriptionError ? (
          <div className="auth-hint fiscal-warning">
            <strong>Não foi possível concluir essa etapa</strong>
            <span>{subscriptionError}</span>
          </div>
        ) : null}

        <div className="cards-grid pricing-grid">
          {pricingPlans.map((plan) => (
            <article key={plan.code} className="dashboard-card pricing-card">
              <div className="pricing-card-top">
                <span className="dashboard-kicker">{plan.badge}</span>
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
              </div>
              <div className="pricing-price-block">
                <strong>{plan.price}</strong>
                <small>{plan.annualPrice}</small>
                <span>{plan.audience}</span>
              </div>
              <form action={updateWorkspaceSubscriptionPlanAction} className="inline-form">
                <input type="hidden" name="subscriptionPlan" value={plan.code} />
                <label>
                  <span>Ciclo</span>
                  <select name="subscriptionBillingCycle" defaultValue={subscription.billingCycle}>
                    <option value="MONTHLY">Mensal</option>
                    <option value="YEARLY">Anual</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className={plan.code === subscription.plan ? "primary-link form-submit" : "secondary-link form-submit"}
                >
                  {plan.code === subscription.plan ? "Plano atual" : "Escolher este plano"}
                </button>
              </form>
            </article>
          ))}
        </div>

        <div className="auth-hint">
          <strong>O que já fica pronto agora</strong>
          <span>
            Trial de 14 dias, plano por empresa e base pronta para recorrência.
          </span>
          <small className="muted-text">
            A cobrança recorrente automática ainda será ligada na próxima etapa, mas a modelagem já nasce alinhada.
          </small>
        </div>

        {canManage ? (
          <div className="hero-actions">
            {!subscription.asaasSubscriptionId ? (
              <form action={createWorkspaceSubscriptionCheckoutAction}>
                <button type="submit" className="primary-link">
                  Ativar cobrança do plano
                </button>
              </form>
            ) : null}
            {subscription.asaasPaymentLink ? (
              <Link href={subscription.asaasPaymentLink} target="_blank" rel="noreferrer" className="secondary-link">
                Abrir primeira cobrança da assinatura
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      <section id="integrations-section" className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">WhatsApp</span>
            <h2>Conectar o número principal da empresa</h2>
          </div>
        </div>

        {evolutionMessage ? (
          <div className={evolutionOk ? "auth-hint" : "auth-hint fiscal-warning"}>
            <strong>{evolutionOk ? "Tudo certo" : "Não foi possível concluir agora"}</strong>
            <span>{evolutionMessage}</span>
            <small className="muted-text">Você continua nesta mesma área para conferir o resultado sem perder o ponto da tela.</small>
          </div>
        ) : null}

        {canManage ? (
          <form action={createEvolutionInstanceAction} className="inline-form">
            <label>
              <span>Identificador da conexão</span>
              <input
                name="instanceName"
                type="text"
                defaultValue={setup.slug}
                placeholder="Ex.: numero-principal"
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
              Criar conexão
            </button>
          </form>
        ) : null}

        {selectedEvolutionInstanceName ? (
          <div className="auth-hint">
            <strong>Número principal escolhido</strong>
            <span>
              {selectedEvolutionInstanceName}
              {selectedEvolutionInstanceState?.instance?.state
                ? ` · estado ${getEvolutionStateLabel(selectedEvolutionInstanceState.instance.state)}`
                : ""}
            </span>
            <small className="muted-text">
              {isUsingWorkspaceEvolutionInstance
                ? "A tela já está usando o número principal desta empresa."
                : "A tela está usando um número padrão porque ainda não encontrou uma conexão com o nome desta empresa."}
            </small>
          </div>
        ) : null}

        {workspaceEvolutionInstance && evolutionIntegration.instance && evolutionIntegration.instance !== workspaceEvolutionInstance.instanceName ? (
          <div className="auth-hint fiscal-warning">
            <strong>O número padrão ainda não é o ideal</strong>
            <span>
              O sistema ainda estava apontando para outra conexão, mas esta empresa já tem uma conexão própria pronta para uso.
            </span>
            <small className="muted-text">
              A tela já prioriza a conexão certa, para evitar que mensagens saiam pelo número errado.
            </small>
          </div>
        ) : null}

        {canManage && selectedEvolutionInstanceName ? (
          <EvolutionPairingPanel instanceName={selectedEvolutionInstanceName} />
        ) : null}

        <details className="guided-flow-card">
          <summary>
            <div>
              <span className="section-label">Visão detalhada</span>
              <h3>Ver outras conexões e situação de cada uma</h3>
              <p>Abra só quando quiser revisar conexões antigas, números em teste ou detalhes de atualização.</p>
            </div>
            <span className="guided-flow-badge">Opcional</span>
          </summary>

          <div className="guided-flow-body">
            <div className="data-table">
              <div className="data-table-head">
                <span>Conexão</span>
                <span>Status</span>
                <span>Número</span>
                <span>Atualização</span>
              </div>
              {evolutionInstances.length > 0 ? evolutionInstances.map((instance) => (
                <article key={instance.instanceName} className="data-table-row">
                  <div>
                    <strong>{instance.instanceName}</strong>
                    <small>{instance.profileName || instance.integration || "Sem perfil conectado ainda"}</small>
                  </div>
                  <span>{getEvolutionStateLabel(instance.status)}</span>
                  <span>{instance.owner || "Aguardando conexão"}</span>
                  <span>{instance.webhookUrl || evolutionIntegration.webhookUrl || "Atualização automática pronta"}</span>
                </article>
              )) : (
                <article className="data-table-row">
                  <span>Nenhuma conexão encontrada</span>
                  <span>Conecte o WhatsApp da empresa</span>
                  <span>-</span>
                  <span>-</span>
                </article>
              )}
            </div>
          </div>
        </details>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Cobrança</span>
            <h2>Recebimentos e confirmação automática</h2>
          </div>
        </div>

        <div className={asaasIntegration.enabled ? "auth-hint" : "auth-hint fiscal-warning"}>
          <strong>{asaasIntegration.enabled ? "Conta de cobrança conectada" : "Conta de cobrança ainda incompleta"}</strong>
          <span>{asaasIntegration.helper}</span>
          <small className="muted-text">
            {workspaceAsaas.mode === "workspace"
              ? "A empresa já está usando uma conta própria para receber."
              : workspaceAsaas.mode === "root_fallback"
                ? "A empresa ainda está usando uma conta geral enquanto a conta própria não fica pronta."
                : "Ainda não há uma conta conectada para esta empresa."}
          </small>
        </div>

        <div className={asaasIntegration.webhookConfigured ? "auth-hint" : "auth-hint fiscal-warning"}>
          <strong>{asaasIntegration.webhookConfigured ? "Atualização automática pronta" : "Atualização automática ainda incompleta"}</strong>
          <span>
            {asaasIntegration.webhookConfigured
              ? "Quando o cliente paga, o sistema já consegue receber a confirmação sozinho."
              : "Ainda falta concluir a ligação automática para o sistema saber sozinho quando o cliente paga."}
          </span>
        </div>

        <div className="cards-grid quote-grid">
          <article className="dashboard-card">
            <span className="dashboard-kicker">Mais simples</span>
            <h3>Criar a conta de recebimento por aqui</h3>
            <p>O sistema prepara a conta da empresa e já deixa a cobrança pronta para uso.</p>
            <small className="muted-text">Melhor para quem quer começar rápido sem mexer em muita configuração.</small>
          </article>

          <article className="dashboard-card">
            <span className="dashboard-kicker">Se já tiver conta</span>
            <h3>Conectar uma conta existente</h3>
            <p>Use quando a empresa já recebe por fora e só precisa ligar essa conta ao sistema.</p>
            <small className="muted-text">Nesse caso, basta informar a chave da conta uma vez.</small>
          </article>

          <article className="dashboard-card">
            <span className="dashboard-kicker">Automação</span>
            <h3>Criação da cobrança e baixa automática</h3>
            <p>Depois da conexão, o sistema cria a cobrança na conta certa e marca o pagamento sozinho quando o cliente paga.</p>
            <small className="muted-text">A ideia é reduzir retrabalho e acompanhamento manual.</small>
          </article>
        </div>

        {asaasConnected ? (
          <div className="auth-hint">
            <strong>Conta Asaas conectada</strong>
            <span>
              {asaasCreated
                ? "A conta de recebimento foi criada e ligada à empresa. Se ainda faltar algum documento, finalize isso direto na conta."
                : "A empresa já pode emitir cobranças pela conta conectada."}
            </span>
          </div>
        ) : null}
        {asaasDisconnected ? (
          <div className="auth-hint fiscal-warning">
            <strong>Conta Asaas desconectada</strong>
            <span>A empresa voltou a operar sem uma conta própria conectada.</span>
          </div>
        ) : null}
        {asaasError ? (
          <div className="auth-hint fiscal-warning">
            <strong>Falha na configuração Asaas</strong>
            <span>{asaasError}</span>
            {asaasError.includes("ASAAS_API_KEY da conta principal") ? (
              <small className="muted-text">
                Para criar subcontas dentro do produto, a plataforma precisa ter uma `ASAAS_API_KEY` principal válida no ambiente de produção.
              </small>
            ) : null}
          </div>
        ) : null}

        {canManage ? (
          <>
            <div className="guided-flow-stack">
              <details className="guided-flow-card" open={workspaceAsaas.mode !== "workspace"}>
                <summary>
                  <div>
                    <span className="section-label">Recomendado</span>
                    <h3>Criar a conta da empresa por aqui</h3>
                    <p>Fluxo guiado para deixar a cobrança pronta sem exigir configuração mais técnica.</p>
                  </div>
                  <span className="guided-flow-badge">Mais fácil</span>
                </summary>

                <div className="guided-flow-body">
                  <div className="auth-hint">
                    <strong>O que você vai precisar</strong>
                    <span>Separe email, CPF ou CNPJ, celular, CEP, endereço e uma estimativa simples de faturamento mensal. O resto o sistema organiza.</span>
                    <small className="muted-text">Em alguns casos, a conta pode pedir dados extras depois. Se isso acontecer, você conclui direto nela.</small>
                  </div>

                  <form action={createWorkspaceAsaasSubaccountAction} className="inline-form">
                    <label className="form-span-2">
                      <span>Nome da empresa ou responsável</span>
                      <input name="subaccountName" type="text" defaultValue={setup.tradeName || setup.legalName} required />
                    </label>
                    <label>
                      <span>Email operacional</span>
                      <input name="subaccountEmail" type="email" placeholder="financeiro@empresa.com.br" required />
                    </label>
                    <label>
                      <span>CPF ou CNPJ</span>
                      <input name="subaccountCpfCnpj" type="text" defaultValue={setup.document} required />
                    </label>
                    <label>
                      <span>Celular</span>
                      <input name="subaccountMobilePhone" type="text" placeholder="5511999998888" required />
                    </label>
                    <label>
                      <span>Faturamento mensal aproximado</span>
                      <input name="subaccountIncomeValue" type="number" min="1" step="0.01" placeholder="5000" required />
                    </label>
                    <label>
                      <span>Tipo de empresa</span>
                      <select name="subaccountCompanyType" defaultValue="">
                        <option value="">Deixar Asaas inferir pelo documento</option>
                        <option value="MEI">MEI</option>
                        <option value="LIMITED">LTDA</option>
                        <option value="INDIVIDUAL">Empresário individual</option>
                        <option value="ASSOCIATION">Associação</option>
                      </select>
                    </label>
                    <label>
                      <span>Data de nascimento do titular</span>
                      <input name="subaccountBirthDate" type="date" />
                    </label>
                    <label className="form-span-2">
                      <span>Endereço</span>
                      <input name="subaccountAddress" type="text" placeholder="Rua, avenida ou alameda" required />
                    </label>
                    <label>
                      <span>Número</span>
                      <input name="subaccountAddressNumber" type="text" required />
                    </label>
                    <label>
                      <span>Complemento</span>
                      <input name="subaccountComplement" type="text" />
                    </label>
                    <label>
                      <span>Bairro</span>
                      <input name="subaccountProvince" type="text" required />
                    </label>
                    <label>
                      <span>CEP</span>
                      <input name="subaccountPostalCode" type="text" required />
                    </label>
                    <button type="submit" className="primary-link form-submit">
                      Criar conta de recebimento
                    </button>
                  </form>
                </div>
              </details>

              <details className="guided-flow-card" open={workspaceAsaas.mode === "workspace"}>
                <summary>
                  <div>
                    <span className="section-label">Conta existente</span>
                    <h3>Conectar uma conta que já existe</h3>
                    <p>Use este caminho quando a empresa já tiver conta ativa e só precisar ligá-la ao sistema.</p>
                  </div>
                  <span className="guided-flow-badge">Alternativa</span>
                </summary>

                <div className="guided-flow-body">
                  <div className="auth-hint">
                    <strong>O que informar aqui</strong>
                    <span>Peça apenas a chave da conta que vai receber os valores. O sistema tenta completar o resto sozinho.</span>
                    <small className="muted-text">Se algum campo extra não estiver claro agora, tudo bem. Você pode deixar para depois.</small>
                  </div>

                  <form action={connectWorkspaceAsaasAccountAction} className="inline-form">
                    <label className="form-span-2">
                    <span>Chave da conta de recebimento</span>
                    <input
                      name="asaasApiKey"
                      type="password"
                      placeholder={workspaceAsaas.mode === "workspace" ? "Preencha apenas para trocar a chave atual" : "Cole a chave da conta que vai receber"}
                      required={workspaceAsaas.mode !== "workspace"}
                    />
                  </label>
                  <label>
                    <span>Referência da conta</span>
                    <input
                      name="asaasAccountId"
                      type="text"
                        defaultValue={setup.asaasAccountId || ""}
                        placeholder="Opcional por enquanto"
                      />
                  </label>
                  <label>
                    <span>Identificador interno</span>
                    <input value={setup.asaasWalletId || workspaceAsaas.walletId || ""} type="text" readOnly />
                  </label>
                  <label className="form-span-2">
                    <span>Repasse da plataforma</span>
                    <div className="checkbox-row">
                        <input
                          id="asaas-split-enabled"
                          name="asaasSplitEnabled"
                          type="checkbox"
                          defaultChecked={Boolean(setup.asaasSplitEnabled)}
                        />
                        <span>Deixe ligado apenas se houver repasse ou taxa da plataforma. Se não houver, pode continuar desligado.</span>
                      </div>
                    </label>
                    <button type="submit" className="secondary-link form-submit">
                      Conectar conta existente
                    </button>
                  </form>
                </div>
              </details>
            </div>
          </>
        ) : null}

        {canManage && workspaceAsaas.mode === "workspace" ? (
          <form action={disconnectWorkspaceAsaasAccountAction} className="card-action">
            <button type="submit" className="ghost-button">
              Desconectar conta própria
            </button>
          </form>
        ) : null}

        <div className="auth-hint">
          <strong>Melhor formato</strong>
          <span>
            O ideal é cada empresa cobrar pela própria conta. Usar uma conta geral só faz sentido enquanto a conta individual ainda não estiver pronta.
          </span>
        </div>

        {workspaceAsaasOnboarding ? (
          <>
            <div className="auth-hint">
              <strong>Andamento da conta conectada</strong>
              <span>
                Situação geral: {workspaceAsaasOnboarding.generalApproval || "aguardando"}.
                {` Cadastro: ${workspaceAsaasOnboarding.commercialStatus || "n/d"}.`}
                {` Documentos: ${workspaceAsaasOnboarding.documentationStatus || "n/d"}.`}
                {` Conta bancária: ${workspaceAsaasOnboarding.bankAccountStatus || "n/d"}.`}
              </span>
              <small className="muted-text">Se ainda houver alguma pendência, você pode concluir direto na conta conectada.</small>
            </div>

            {workspaceAsaasOnboarding.pendingDocuments.length > 0 ? (
              <div className="report-table">
                <div className="report-table-head report-table-head-2">
                  <span>Etapa de onboarding</span>
                  <span>Ação</span>
                </div>
                {workspaceAsaasOnboarding.pendingDocuments.map((item, index) => (
                  <article key={`${item.type}-${index}`} className="report-table-row report-table-row-2">
                    <div>
                      <strong>{item.type}</strong>
                      <span>{item.status || (item.pending ? "Pendente" : "Em análise")}</span>
                    </div>
                    <div>
                      <span>{item.action || "Acompanhar no Asaas"}</span>
                      {item.url ? (
                        <Link href={item.url} target="_blank" rel="noreferrer" className="secondary-link">
                          Abrir etapa
                        </Link>
                      ) : (
                        <small className="muted-text">Sem link retornado agora</small>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="auth-hint">
                <strong>Sem etapas pendentes visíveis agora</strong>
                <span>Se a conta acabou de ser criada, o Asaas pode levar alguns segundos para expor as próximas ações documentais.</span>
              </div>
            )}
          </>
        ) : null}
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

      <section id="team-section" className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Equipe</span>
            <h2>Adicionar pessoas e organizar acessos</h2>
          </div>
        </div>

        {teamCreated ? <p className="auth-hint">Usuário adicionado à empresa com sucesso.</p> : null}
        {teamUpdated ? <p className="auth-hint">Papel do usuário atualizado com sucesso.</p> : null}
        {teamRemoved ? <p className="auth-hint">Usuário removido da empresa com sucesso.</p> : null}
        {teamPasswordReset ? <p className="auth-hint">Senha do usuário redefinida com sucesso.</p> : null}
        {teamError ? <p className="auth-error">{teamError}</p> : null}

        {isLocalDataMode() ? (
          <div className="auth-hint">
            <strong>Ambiente de teste ativo</strong>
            <span>Quando o sistema estiver ligado ao banco oficial, esta área cria acessos reais para a equipe.</span>
          </div>
        ) : !canManage ? (
          <div className="auth-hint">
            <strong>Acesso restrito</strong>
            <span>Seu perfil atual permite consultar a equipe, mas não convidar novas pessoas.</span>
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
                <option value="MEMBER">Operação</option>
                <option value="ADMIN">Gestão</option>
                <option value="OWNER">Responsável</option>
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
            <span>Acesso</span>
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
                          <option value="MEMBER">Operação</option>
                          <option value="ADMIN">Gestão</option>
                          <option value="OWNER">Responsável</option>
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
          <h2>Quando a base está redonda, a operação fica mais leve.</h2>
          <p>
            Esses dados ajudam cobrança, atendimento, equipe e emissão a funcionarem sem retrabalho.
          </p>
        </article>

        <article className="split-panel">
          <span className="section-label">Próximo uso</span>
          <h2>Mais consistência no comercial e no financeiro</h2>
          <p>
            Nome da empresa, cobrança e descrição de serviço aparecem nos lugares certos para economizar tempo e passar mais confiança.
          </p>
        </article>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Histórico recente</span>
            <h2>Últimas mudanças feitas na empresa</h2>
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
            <h2>Últimos sinais recebidos do WhatsApp</h2>
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

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Detalhes avançados</span>
            <h2>Informações técnicas só quando você precisar</h2>
          </div>
        </div>

        <details className="guided-flow-card">
          <summary>
            <div>
              <span className="section-label">Cobrança e WhatsApp</span>
              <h3>Ver referências internas das integrações</h3>
              <p>Use esta área apenas para suporte, implantação ou conferência mais técnica.</p>
            </div>
            <span className="guided-flow-badge">Avançado</span>
          </summary>

          <div className="guided-flow-body">
            <div className="report-table">
              <div className="report-table-head report-table-head-2">
                <span>Item</span>
                <span>Valor</span>
              </div>
              <article className="report-table-row report-table-row-2">
                <div>
                  <strong>Modo da conta de cobrança</strong>
                  <span>{workspaceAsaas.mode === "workspace" ? "Conta própria conectada" : workspaceAsaas.mode === "root_fallback" ? "Conta geral temporária" : "Sem conta conectada"}</span>
                </div>
                <div>
                  <strong>Ambiente</strong>
                  <span>{asaasIntegration.environment === "production" ? "Produção" : "Sandbox"}</span>
                </div>
              </article>
              <article className="report-table-row report-table-row-2">
                <div>
                  <strong>Referência da conta</strong>
                  <span>{workspaceAsaasOnboarding?.accountId || setup.asaasAccountId || "Não informado"}</span>
                </div>
                <div>
                  <strong>Identificador interno</strong>
                  <span>{workspaceAsaasOnboarding?.walletId || setup.asaasWalletId || "Não informado"}</span>
                </div>
              </article>
              <article className="report-table-row report-table-row-2">
                <div>
                  <strong>Conexão principal do WhatsApp</strong>
                  <span>{selectedEvolutionInstanceName || "Não definida"}</span>
                </div>
                <div>
                  <strong>Atualização automática</strong>
                  <span>{asaasIntegration.webhookConfigured ? "Pronta" : "Pendente"}</span>
                </div>
              </article>
            </div>
          </div>
        </details>
      </section>
    </DashboardShell>
  );
}
