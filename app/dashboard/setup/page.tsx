import Link from "next/link";
import { SetupAsaasFlashMessages, SetupSubscriptionFlashMessages, SetupTeamFlashMessages } from "@/components/setup-flash-messages";
import { DashboardShell } from "@/components/dashboard-shell";
import { EvolutionPairingPanel } from "@/components/evolution-pairing-panel";
import { InviteLinkField } from "@/components/invite-link-field";
import { OperationalDiagnosticsPanel } from "@/components/operational-diagnostics-panel";
import {
  connectWorkspaceAsaasAccountAction,
  createWorkspaceAsaasSubaccountAction,
  createEvolutionInstanceAction,
  createWorkspaceInviteAction,
  createWorkspaceMemberAction,
  createWorkspaceSubscriptionCheckoutAction,
  disconnectWorkspaceAsaasAccountAction,
  renewWorkspaceInviteAction,
  revokeWorkspaceInviteAction,
  resendWorkspaceInviteAction,
  removeWorkspaceMemberAction,
  resetWorkspaceMemberPasswordAction,
  updateWorkspaceMemberRoleAction,
  updateUserAlertPreferencesAction,
  updateWorkspaceSubscriptionPlanAction,
  updateWorkspaceSetupAction,
} from "@/app/dashboard/setup/actions";
import { getWorkspaceAccessSummary, listWorkspaceAccessEvents } from "@/lib/access-activity";
import { listAuditEntries } from "@/lib/audit-repository";
import { listWorkspaceAuditEntriesByActions } from "@/lib/audit-repository";
import { listWorkspaceAuditEntriesByType } from "@/lib/audit-repository";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { buildSetupPageViewModel } from "@/lib/setup-page-data";
import { buildOperationalDiagnosticsSnapshot } from "@/lib/operational-diagnostics";
import { summarizeOperationalSignals } from "@/lib/operational-diagnostics-panel-helpers";
import { getWorkspaceSetup } from "@/lib/workspace-settings-repository";
import {
  fetchEvolutionInstances,
  getEvolutionConnectionState,
  probeEvolutionApi,
} from "@/lib/evolution-api";
import { getResolvedNfsePortalUrls, resolveNfseProvider } from "@/lib/nfse-provider";
import { listWorkspaceMembers } from "@/lib/workspace-membership-repository";
import { listWorkspaceInvites } from "@/lib/workspace-invite-repository";
import { getWorkspaceAsaasConnection, getWorkspaceAsaasOnboardingSnapshot } from "@/lib/asaas-workspace";
import { getNfseNationalMunicipalityStatus } from "@/lib/nfse-national-municipal-status";
import { getFiscalSetupReadiness } from "@/lib/nfse-repository";
import {
  getEvolutionOperationalSummary,
  getEvolutionStateLabel,
  getNfseMunicipalityBlockSummary,
  getSetupHealthTone,
} from "@/lib/setup-page-helpers";
import { readSetupPageFlashState, type SetupSearchParams } from "@/lib/setup-page-state";
import { formatSubscriptionDate, getSubscriptionStatusLabel } from "@/lib/subscription";
import { getWorkspaceSubscription } from "@/lib/workspace-subscription-repository";
import { getCurrentUserAlertPreferences } from "@/lib/workspace-user-preferences";
import { pricingPlans } from "@/lib/site-data";

export const dynamic = "force-dynamic";

type SetupPageProps = {
  searchParams?: Promise<SetupSearchParams>;
};

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const [
    setup,
    members,
    invites,
    auditEntries,
    evolutionAuditEntries,
    fiscalAuditEntries,
    asaasIncidentEntries,
    asaasLifecycleEntries,
    subscriptionAuditEntries,
    context,
    params,
    fiscalReadiness,
    evolutionProbe,
    operationalDiagnostics,
    evolutionInstances,
    workspaceAsaas,
    workspaceAsaasOnboarding,
    subscription,
    accessEvents,
    accessSummary,
    alertPreferences,
  ] = await Promise.all([
    getWorkspaceSetup(),
    listWorkspaceMembers(),
    listWorkspaceInvites(),
    listAuditEntries(8),
    listWorkspaceAuditEntriesByType("evolution", 8),
    listWorkspaceAuditEntriesByType("nfse", 8),
    listWorkspaceAuditEntriesByActions(["charge.asaas.failed", "asaas.payment_overdue"], 8),
    listWorkspaceAuditEntriesByActions(["workspace.asaas.connected", "workspace.asaas.disconnected", "workspace.asaas.subaccount_created"], 6),
    listWorkspaceAuditEntriesByActions(["workspace.subscription.checkout_created", "workspace.subscription.checkout_synced", "subscription.asaas.payment_overdue", "subscription.asaas.payment_received", "subscription.asaas.payment_confirmed"], 6),
    getCurrentWorkspaceContext(),
    searchParams,
    getFiscalSetupReadiness(),
    probeEvolutionApi(),
    buildOperationalDiagnosticsSnapshot("dashboard-setup"),
    fetchEvolutionInstances().catch(() => []),
    getWorkspaceAsaasConnection(),
    getWorkspaceAsaasOnboardingSnapshot(),
    getWorkspaceSubscription(),
    listWorkspaceAccessEvents(),
    getWorkspaceAccessSummary(),
    getCurrentUserAlertPreferences(),
  ]);
  const flash = readSetupPageFlashState(params);
  const operationalFocus = params?.operationalFocus || "";
  const nfseProvider = resolveNfseProvider(setup.city || "", setup.state || "");
  const nfsePortalUrls = getResolvedNfsePortalUrls(setup.city || "", setup.state || "");
  const municipalityStatus = nfseProvider.key === "national"
    ? await getNfseNationalMunicipalityStatus(setup.city || "", setup.state || "")
    : null;
  const view = buildSetupPageViewModel({
    workspaceRole: context.workspaceRole,
    setupSlug: setup.slug,
    subscription,
    companyCity: setup.city,
    companyState: setup.state,
    fiscalReady: fiscalReadiness.ready,
    evolutionReachable: evolutionProbe.reachable,
    evolutionInstances,
    workspaceAsaasMode: workspaceAsaas.mode,
    asaasIncidentEntries,
  });
  const selectedEvolutionInstanceName = view.selectedEvolutionInstanceName;
  const selectedEvolutionInstanceState = selectedEvolutionInstanceName
    ? await getEvolutionConnectionState(selectedEvolutionInstanceName).catch(() => null)
    : null;
  const evolutionOperationalSummary = getEvolutionOperationalSummary({
    integrationEnabled: view.evolutionIntegration.enabled,
    probeReachable: evolutionProbe.reachable,
    instanceState: selectedEvolutionInstanceState?.instance?.state || view.workspaceEvolutionInstance?.status,
  });
  const municipalityBlockSummary = getNfseMunicipalityBlockSummary({
    city: municipalityStatus?.city,
    state: municipalityStatus?.state,
    statusConvenio: municipalityStatus?.statusConvenio,
    aderenteAmbienteNacional: municipalityStatus?.aderenteAmbienteNacional,
    aderenteEmissorNacional: municipalityStatus?.aderenteEmissorNacional,
  });
  const evolutionSignals = summarizeOperationalSignals(evolutionAuditEntries);
  const fiscalSignals = summarizeOperationalSignals(fiscalAuditEntries);
  const asaasSignals = summarizeOperationalSignals([
    ...asaasIncidentEntries,
    ...asaasLifecycleEntries,
  ]);
  const subscriptionSignals = summarizeOperationalSignals(subscriptionAuditEntries);
  const subscriptionSectionFocused = operationalFocus === "subscription";
  const integrationsSectionFocused = operationalFocus === "integrations";

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
              <small>{view.subscriptionPlan.name} em {view.billingCycleLabel.toLowerCase()}.</small>
            </article>
            <article className="dashboard-metric-tile">
              <span>WhatsApp</span>
              <strong>{view.evolutionIntegration.enabled ? "Ativo" : "Pendente"}</strong>
              <small>{view.evolutionIntegration.helper}</small>
            </article>
            <article className="dashboard-metric-tile">
              <span>Cobrança</span>
              <strong>{view.asaasIntegration.enabled ? "Ativo" : "Pendente"}</strong>
              <small>{view.asaasIntegration.helper}</small>
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

      {view.localMode ? (
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
            <h3>{view.localMode ? "Teste local" : "Dados reais"}</h3>
            <p>
              {view.localMode
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
            <h3>{view.nfseIntegration.ready ? "Base pronta" : "Base incompleta"}</h3>
            <p>
              {view.nfseIntegration.ready
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

        {flash.setupSaved ? <p className="auth-hint">Dados da empresa salvos com sucesso.</p> : null}
        {flash.setupError ? <p className="auth-error">{flash.setupError}</p> : null}

        {!fiscalReadiness.ready ? (
          <div className="auth-hint fiscal-warning">
            <strong>Alguns dados ainda faltam</strong>
            <span>{fiscalReadiness.helper}</span>
          </div>
        ) : null}

        {view.canManage ? (
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
          <h2>
            {view.nfseIntegration.provider.key === "joinville"
              ? "Mesmo sem automação total, o portal municipal mantém a operação fluindo"
              : "Mesmo sem certificado, dá para seguir com apoio manual"}
          </h2>
          <p>{view.emissionModes.assisted.helper}</p>
        </article>

        <article className={view.nfseIntegration.ready ? "split-panel success" : "split-panel"}>
          <span className="section-label">Emissão automática</span>
          <h2>
            {view.nfseIntegration.provider.key === "joinville"
              ? "Com inscrição municipal e certificado, Joinville pode emitir direto pelo webservice"
              : "Com certificado, a emissão fica mais automática"}
          </h2>
          <p>{view.emissionModes.automatic.helper}</p>
        </article>
      </section>

      <section className="section-split">
        <article className={subscription.status === "TRIALING" ? "split-panel success" : "split-panel"}>
          <span className="section-label">Assinatura da empresa</span>
          
          <h2>{view.subscriptionPlan.name} em {view.billingCycleLabel.toLowerCase()}</h2>
          <p>
            Status atual: {getSubscriptionStatusLabel(subscription.status)}.
            {view.trialRemainingDays !== null ? ` Restam ${view.trialRemainingDays} dia(s) no trial.` : ""}
          </p>
        </article>

        <article className={view.evolutionIntegration.enabled ? "split-panel success" : "split-panel"}>
          <span className="section-label">WhatsApp da empresa</span>
          <h2>Canal pronto para mensagens, lembretes e respostas</h2>
          <p>{view.evolutionIntegration.helper}</p>
        </article>

        <article className={view.asaasIntegration.enabled ? "split-panel success" : "split-panel"}>
          <span className="section-label">Recebimentos</span>
          <h2>Conta pronta para Pix, boleto, cartão e links de pagamento</h2>
          <p>{view.asaasIntegration.helper}</p>
        </article>
      </section>

      <section className="section-split">
        <article className={evolutionOperationalSummary.tone === "success" ? "split-panel success" : "split-panel"}>
          <span className="section-label">Status do WhatsApp</span>
          <h2>Conexão do canal principal</h2>
          <p>{evolutionOperationalSummary.description}</p>
        </article>

        <article className={view.asaasIntegration.webhookConfigured ? "split-panel success" : "split-panel"}>
          <span className="section-label">Atualização de pagamentos</span>
          <h2>Confirmação automática quando o cliente paga</h2>
          <p>
            {view.asaasIntegration.webhookConfigured
              ? "O sistema já consegue receber a confirmação de pagamento automaticamente."
              : "Ainda falta concluir a ligação automática entre a conta de cobrança e o sistema."}
          </p>
        </article>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Observabilidade</span>
            <h2>Saúde operacional das integrações</h2>
          </div>
        </div>

        <div className="section-split">
          <article className={getSetupHealthTone({ ok: view.evolutionHealthOk, warning: view.evolutionIntegration.enabled && !evolutionProbe.reachable })}>
            <span className="section-label">WhatsApp</span>
            <h2>{view.evolutionHealthOk ? "Operando" : view.evolutionIntegration.enabled ? "Parcial" : "Pendente"}</h2>
            <p>
              {view.evolutionHealthOk
                ? "Instância conectada, API alcançável e eventos recentes disponíveis no workspace."
                : view.evolutionIntegration.enabled
                  ? "A configuração existe, mas a API ou a instância ainda não estão estáveis o bastante."
                  : "O canal ainda não foi ligado ao workspace."}
            </p>
          </article>

          <article className={getSetupHealthTone({ ok: view.asaasHealthOk, warning: workspaceAsaas.mode !== "disabled" })}>
            <span className="section-label">Cobrança</span>
            <h2>{view.asaasHealthOk ? "Operando" : workspaceAsaas.mode !== "disabled" ? "Parcial" : "Pendente"}</h2>
            <p>
              {view.asaasHealthOk
                ? "Conta própria, webhook e automação externa estão sem incidente recente conhecido."
                : workspaceAsaas.mode !== "disabled"
                  ? "A cobrança existe, mas ainda há pendência de webhook, onboarding ou incidente recente."
                  : "Ainda falta conectar a conta que vai receber os pagamentos."}
            </p>
          </article>

          <article className={getSetupHealthTone({ ok: !view.hasSubscriptionIncident, warning: subscription.status === "TRIALING" || subscription.status === "ACTIVE" })}>
            <span className="section-label">Assinatura</span>
            <h2>{view.hasSubscriptionIncident ? "Atenção" : "Saudável"}</h2>
            <p>
              {view.hasSubscriptionIncident
                ? "O acesso pode ser limitado até a assinatura voltar para um estado regular."
                : "O ciclo do workspace está em um estado que não bloqueia a operação normal."}
            </p>
          </article>

          <article className={getSetupHealthTone({ ok: view.fiscalHealthOk, warning: view.nfseIntegration.enabled })}>
            <span className="section-label">Fiscal</span>
            <h2>{view.fiscalHealthOk ? "Operando" : view.nfseIntegration.enabled ? "Parcial" : "Assistido"}</h2>
            <p>
              {view.fiscalHealthOk
                ? "O setup fiscal já sustenta emissão com menos atrito."
                : view.nfseIntegration.enabled
                  ? view.nfseIntegration.provider.key === "joinville"
                    ? "O provider municipal de Joinville já está mapeado, mas ainda faltam dados finais do emissor."
                    : "Parte do setup existe, mas ainda faltam dados ou readiness do emissor."
                  : "O fluxo ainda depende mais da emissão assistida do que da automação."}
            </p>
          </article>
        </div>
      </section>

      <OperationalDiagnosticsPanel
        snapshot={operationalDiagnostics}
        signals={{
          evolution: evolutionSignals,
          asaas: asaasSignals,
          fiscal: fiscalSignals,
          subscription: subscriptionSignals,
        }}
      />

      <section
        id="subscription-section"
        className={subscriptionSectionFocused ? "data-panel operational-focus-panel" : "data-panel"}
      >
        <div className="card-header">
          <div>
            <span className="section-label">Plano</span>
            <h2>Plano da empresa e cobrança automática</h2>
          </div>
        </div>

        {subscriptionSectionFocused ? (
          <div className="operational-focus-banner">
            <strong>Atenção operacional direcionada</strong>
            <span>Você chegou aqui porque o plano ou a cobrança recorrente da empresa pedem revisão agora.</span>
          </div>
        ) : null}

        <div className={subscription.status === "TRIALING" ? "auth-hint" : "auth-hint fiscal-warning"}>
          <strong>{getSubscriptionStatusLabel(subscription.status)}</strong>
          <span>
            Plano atual: {view.subscriptionPlan.name} ({view.subscriptionPlan.price}).
            {subscription.trialEndsAt ? ` Trial até ${formatSubscriptionDate(subscription.trialEndsAt)}.` : ""}
          </span>
          <small className="muted-text">
            Ciclo escolhido: {view.billingCycleLabel}.
            {subscription.notes ? ` ${subscription.notes}` : ""}
          </small>
        </div>

        <SetupSubscriptionFlashMessages state={flash} />

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

        {view.canManage ? (
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

      <section
        id="integrations-section"
        className={integrationsSectionFocused ? "data-panel operational-focus-panel" : "data-panel"}
      >
        <div className="card-header">
          <div>
            <span className="section-label">WhatsApp</span>
            <h2>Conectar o número principal da empresa</h2>
          </div>
        </div>

        {integrationsSectionFocused ? (
          <div className="operational-focus-banner">
            <strong>Atenção operacional direcionada</strong>
            <span>Você chegou aqui porque WhatsApp ou cobrança automática precisam de ajuste nesta empresa.</span>
          </div>
        ) : null}

        {flash.evolutionMessage ? (
          <div className={flash.evolutionOk ? "auth-hint" : "auth-hint fiscal-warning"}>
            <strong>{flash.evolutionOk ? "Tudo certo" : "Não foi possível concluir agora"}</strong>
            <span>{flash.evolutionMessage}</span>
            <small className="muted-text">Você continua nesta mesma área para conferir o resultado sem perder o ponto da tela.</small>
          </div>
        ) : null}

        {view.canManage ? (
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
          <div className={evolutionOperationalSummary.tone === "success" ? "auth-hint" : "auth-hint fiscal-warning"}>
            <strong>{evolutionOperationalSummary.title}</strong>
            <span>
              {selectedEvolutionInstanceName}
              {selectedEvolutionInstanceState?.instance?.state
                ? ` · estado ${getEvolutionStateLabel(selectedEvolutionInstanceState.instance.state)}`
                : ""}
            </span>
            <small className="muted-text">
              {evolutionOperationalSummary.description}
            </small>
            <small className="muted-text">
              {view.isUsingWorkspaceEvolutionInstance
                ? "A tela já está usando o número principal desta empresa."
                : "A tela está usando um número padrão porque ainda não encontrou uma conexão com o nome desta empresa."}
            </small>
          </div>
        ) : null}

        {view.workspaceEvolutionInstance && view.evolutionIntegration.instance && view.evolutionIntegration.instance !== view.workspaceEvolutionInstance.instanceName ? (
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

        {view.canManage && selectedEvolutionInstanceName ? (
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
                  <span>{instance.webhookUrl || view.evolutionIntegration.webhookUrl || "Atualização automática pronta"}</span>
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

        <div className={view.asaasIntegration.enabled ? "auth-hint" : "auth-hint fiscal-warning"}>
          <strong>{view.asaasIntegration.enabled ? "Conta de cobrança conectada" : "Conta de cobrança ainda incompleta"}</strong>
          <span>{view.asaasIntegration.helper}</span>
          <small className="muted-text">
            {workspaceAsaas.mode === "workspace"
              ? "A empresa já está usando uma conta própria para receber."
              : workspaceAsaas.mode === "root_fallback"
                ? "A empresa ainda está usando uma conta geral enquanto a conta própria não fica pronta."
                : "Ainda não há uma conta conectada para esta empresa."}
          </small>
        </div>

        <div className={view.asaasIntegration.webhookConfigured ? "auth-hint" : "auth-hint fiscal-warning"}>
          <strong>{view.asaasIntegration.webhookConfigured ? "Atualização automática pronta" : "Atualização automática ainda incompleta"}</strong>
          <span>
            {view.asaasIntegration.webhookConfigured
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

        <SetupAsaasFlashMessages state={flash} />

        {view.canManage ? (
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

        {view.canManage && workspaceAsaas.mode === "workspace" ? (
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

      {view.nfseIntegration.provider.key === "joinville" ? (
        <section className="data-panel">
          <div className="card-header">
            <div>
              <span className="section-label">Município emissor</span>
              <h2>Joinville está operando pelo webservice municipal NF-em</h2>
            </div>
          </div>

          <div className={view.nfseIntegration.ready ? "auth-hint" : "auth-hint fiscal-warning"}>
            <strong>
              {view.nfseIntegration.ready
                ? "Provider municipal pronto para validação operacional"
                : "Fluxo municipal detectado, mas ainda faltam dados do emissor"}
            </strong>
            <span>
              Para Joinville/SC, a emissão automática do projeto segue pelo provedor municipal NF-em em vez do Emissor
              Nacional direto.
            </span>
            <small className="muted-text">
              Portal oficial:{" "}
              <Link href={nfsePortalUrls.issueUrl} target="_blank" rel="noreferrer">
                abrir NF-em de Joinville
              </Link>
              {" "}ou{" "}
              <Link href={nfsePortalUrls.loginUrl} target="_blank" rel="noreferrer">
                acessar login municipal
              </Link>
              .
            </small>
            {!view.nfseIntegration.ready ? (
              <small className="muted-text">
                Pendências atuais: {view.nfseIntegration.missing.join(", ") || "revisar dados do emissor municipal"}.
              </small>
            ) : null}
          </div>
        </section>
      ) : municipalityStatus ? (
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
            {municipalityBlockSummary ? (
              <small className="muted-text">{municipalityBlockSummary.description}</small>
            ) : null}
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
            <span className="section-label">Incidentes recentes</span>
            <h2>O que merece atenção antes de confiar no automático</h2>
          </div>
        </div>

        {asaasIncidentEntries.length > 0 ? (
          <div className="data-table">
            <div className="data-table-head">
              <span>Quando</span>
              <span>Origem</span>
              <span>Evento</span>
              <span>Resumo</span>
            </div>
            {asaasIncidentEntries.map((entry) => (
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
        ) : (
          <div className="auth-hint">
            <strong>Sem incidente recente registrado</strong>
            <span>Até aqui, não houve falha recente relevante de cobrança automática registrada neste workspace.</span>
          </div>
        )}
      </section>

      <section className="section-split">
        <article className={view.transactionalEmailReady ? "split-panel success" : "split-panel"}>
          <span className="section-label">Segurança de acesso</span>
          <h2>Recuperação de senha e convites por email</h2>
          <p>
            {view.transactionalEmailReady
              ? "O envio transacional está pronto para convites, recuperação de senha e notificações de acesso."
              : "Ainda falta configurar o provider transacional para convites automáticos e recuperação de senha por email."}
          </p>
        </article>

        <article className="split-panel">
          <span className="section-label">Proteção de login</span>
          <h2>Cooldown ativo para excesso de tentativas</h2>
          <p>
            O login agora aplica proteção persistida contra repetição excessiva de tentativas e registra eventos de acesso no workspace.
          </p>
        </article>
      </section>

      <section id="access-section" className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Acesso e alertas</span>
            <h2>Controle o que aparece para você e acompanhe o que aconteceu no workspace</h2>
          </div>
        </div>

        {flash.alertPrefsSaved ? <p className="auth-hint">Preferências pessoais de alerta salvas com sucesso.</p> : null}
        {flash.alertPrefsError ? <p className="auth-error">{flash.alertPrefsError}</p> : null}

        <div className="cards-grid quote-grid">
          <article className="dashboard-card">
            <span className="dashboard-kicker">Entradas recentes</span>
            <h3>{accessSummary.successCount}</h3>
            <p>Logins concluídos nos últimos 7 dias neste workspace.</p>
          </article>
          <article className="dashboard-card">
            <span className="dashboard-kicker">Falhas</span>
            <h3>{accessSummary.failedCount}</h3>
            <p>Tentativas de acesso sem sucesso registradas no mesmo período.</p>
          </article>
          <article className="dashboard-card">
            <span className="dashboard-kicker">Bloqueios</span>
            <h3>{accessSummary.lockedCount}</h3>
            <p>Vezes em que a proteção de login precisou entrar em ação.</p>
          </article>
          <article className="dashboard-card">
            <span className="dashboard-kicker">Redefinições</span>
            <h3>{accessSummary.resetCount}</h3>
            <p>Pedidos e conclusões de recuperação de senha auditados.</p>
          </article>
        </div>

        <div className="section-split">
          <article className="split-panel">
            <span className="section-label">Preferências do seu usuário</span>
            <h2>Escolha como quer receber sinais operacionais</h2>
            <p>Essas escolhas valem só para a sua conta dentro deste workspace.</p>

            <form action={updateUserAlertPreferencesAction} className="inline-form">
              <label className="checkbox-field form-span-2">
                <input name="showOperationalAlerts" type="checkbox" defaultChecked={alertPreferences.showOperationalAlerts} />
                <span>Mostrar alertas operacionais no topo do dashboard</span>
              </label>
              <label className="checkbox-field form-span-2">
                <input name="showNotificationCenter" type="checkbox" defaultChecked={alertPreferences.showNotificationCenter} />
                <span>Mostrar central de notificações de acesso e convites</span>
              </label>
              <label className="checkbox-field form-span-2">
                <input name="emailOnInviteAccepted" type="checkbox" defaultChecked={alertPreferences.emailOnInviteAccepted} />
                <span>Receber email quando um convite do workspace for aceito</span>
              </label>
              <label className="checkbox-field form-span-2">
                <input name="emailOnSecurityAlerts" type="checkbox" defaultChecked={alertPreferences.emailOnSecurityAlerts} />
                <span>Receber email em eventos sensíveis de segurança, como bloqueio de login e troca de senha</span>
              </label>
              <button type="submit" className="primary-link form-submit">
                Salvar preferências
              </button>
            </form>
          </article>

          <article className="split-panel">
            <span className="section-label">Leitura rápida</span>
            <h2>O que esse painel já ajuda a detectar</h2>
            <p>
              Picos de falha de login, excesso de recuperação de senha, convites aceitos e saídas de sessão ficam visíveis sem depender de suporte técnico.
            </p>
          </article>
        </div>

        <div className="data-table">
          <div className="data-table-head">
            <span>Quando</span>
            <span>Evento</span>
            <span>Responsável</span>
            <span>Canal</span>
            <span>Resumo</span>
          </div>
          {accessEvents.map((entry) => (
            <article key={entry.id} className="data-table-row">
              <span>{entry.createdAt}</span>
              <div>
                <strong>{entry.title}</strong>
                <small>{entry.tone === "warning" ? "Atenção" : entry.tone === "positive" ? "Confirmado" : "Informativo"}</small>
              </div>
              <div>
                <strong>{entry.actorName}</strong>
                <small>{entry.actorEmail}</small>
              </div>
              <span>{entry.deviceLabel || "Workspace"}</span>
              <span>{entry.summary}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="team-section" className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Equipe</span>
            <h2>Adicionar pessoas e organizar acessos</h2>
          </div>
        </div>

        <SetupTeamFlashMessages state={flash} />

        {view.localMode ? (
          <div className="auth-hint">
            <strong>Ambiente de teste ativo</strong>
            <span>Quando o sistema estiver ligado ao banco oficial, esta área cria acessos reais para a equipe.</span>
          </div>
        ) : !view.canManage ? (
          <div className="auth-hint">
            <strong>Acesso restrito</strong>
            <span>Seu perfil atual permite consultar a equipe, mas não convidar novas pessoas.</span>
          </div>
        ) : (
          <>
            <form action={createWorkspaceInviteAction} className="inline-form">
              <label>
                <span>Nome da pessoa</span>
                <input name="inviteName" type="text" placeholder="Ex.: Julia Financeiro" />
              </label>
              <label>
                <span>Email</span>
                <input name="inviteEmail" type="email" placeholder="julia@empresa.com.br" required />
              </label>
              <label>
                <span>Papel</span>
                <select name="inviteRole" defaultValue="MEMBER">
                  <option value="MEMBER">Operação</option>
                  <option value="ADMIN">Gestão</option>
                  <option value="OWNER">Responsável</option>
                </select>
              </label>
              <button type="submit" className="primary-link form-submit">
                Gerar convite
              </button>
            </form>

            <div className="auth-hint">
              <strong>Fluxo recomendado</strong>
              <span>Convites deixam a entrada rastreável, evitam senha compartilhada e funcionam melhor para multiempresa.</span>
            </div>

            <details className="guided-flow-card">
              <summary>
                <div>
                  <span className="section-label">Acesso manual</span>
                  <h3>Criar usuário direto com senha inicial</h3>
                  <p>Use apenas quando a operação já pedir um acesso imediato sem depender do link de convite.</p>
                </div>
                <span className="guided-flow-badge">Avançado</span>
              </summary>

              <div className="guided-flow-body">
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
                  <button type="submit" className="secondary-link form-submit">
                    Adicionar usuário direto
                  </button>
                </form>
              </div>
            </details>
          </>
        )}

        <div className="data-table">
          <div className="data-table-head">
            <span>Convite</span>
            <span>Papel</span>
            <span>Status</span>
            <span>Entrega</span>
            <span>Expira em</span>
            <span>Ações</span>
          </div>
          {invites.length > 0 ? invites.map((invite) => (
            <article key={invite.id} className="data-table-row">
              <div>
                <strong>{invite.name || invite.email}</strong>
                <small>{invite.email}</small>
              </div>
              <span>{invite.role}</span>
              <span>{invite.status}</span>
              <div>
                <strong>{invite.deliveryStatus}</strong>
                <small>{invite.lastSentAt ? `Último envio: ${invite.lastSentAt}` : "Sem envio automático registrado"}</small>
                {invite.lastDeliveryError ? <small>{invite.lastDeliveryError}</small> : null}
              </div>
              <span>{invite.expiresAt}</span>
              <div className="cards-grid">
                {invite.inviteUrl ? (
                  <InviteLinkField inviteUrl={invite.inviteUrl} />
                ) : (
                  <small className="muted-text">Link indisponível neste ambiente</small>
                )}
                {view.canManage ? (
                  <>
                    {invite.status === "Pendente" ? (
                      <form action={resendWorkspaceInviteAction} className="row-action">
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <button type="submit" className="ghost-button">
                          Reenviar email
                        </button>
                      </form>
                    ) : null}
                    {invite.status === "Expirado" || invite.status === "Revogado" ? (
                      <form action={renewWorkspaceInviteAction} className="row-action">
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <button type="submit" className="ghost-button">
                          Renovar convite
                        </button>
                      </form>
                    ) : null}
                    {invite.status === "Pendente" ? (
                      <form action={revokeWorkspaceInviteAction} className="row-action">
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <button type="submit" className="ghost-button">
                          Revogar convite
                        </button>
                      </form>
                    ) : null}
                  </>
                ) : (
                  <small className="muted-text">Sem ação disponível</small>
                )}
              </div>
            </article>
          )) : (
            <article className="data-table-row">
              <span>Nenhum convite recente</span>
              <span>-</span>
              <span>-</span>
              <span>-</span>
              <span>-</span>
              <small className="muted-text">Os próximos convites aparecem aqui para copiar, acompanhar ou revogar.</small>
            </article>
          )}
        </div>

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
                {view.canManage && !view.localMode ? (
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

      <section className="section-split">
        <article className="split-panel">
          <span className="section-label">Ciclo da cobrança</span>
          <h2>Últimos eventos do Asaas no workspace</h2>
          {asaasLifecycleEntries.length > 0 ? (
            <div className="dashboard-mini-list">
              {asaasLifecycleEntries.slice(0, 3).map((entry) => (
                <article key={entry.id}>
                  <strong>{entry.action}</strong>
                  <p>{entry.summary}</p>
                </article>
              ))}
            </div>
          ) : (
            <p>Nenhum evento recente de conexão, troca de conta ou criação de subconta foi registrado ainda.</p>
          )}
        </article>

        <article className="split-panel">
          <span className="section-label">Ciclo da assinatura</span>
          <h2>Últimos movimentos do plano do workspace</h2>
          {subscriptionAuditEntries.length > 0 ? (
            <div className="dashboard-mini-list">
              {subscriptionAuditEntries.slice(0, 3).map((entry) => (
                <article key={entry.id}>
                  <strong>{entry.action}</strong>
                  <p>{entry.summary}</p>
                </article>
              ))}
            </div>
          ) : (
            <p>Os próximos eventos da assinatura vão aparecer aqui quando o checkout ou a recorrência começarem a rodar.</p>
          )}
        </article>
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
                  <span>{view.asaasIntegration.environment === "production" ? "Produção" : "Sandbox"}</span>
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
                  <span>{view.asaasIntegration.webhookConfigured ? "Pronta" : "Pendente"}</span>
                </div>
              </article>
            </div>
          </div>
        </details>
      </section>
    </DashboardShell>
  );
}
