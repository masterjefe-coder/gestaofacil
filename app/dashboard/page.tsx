import Link from "next/link";
import { DashboardOperationalDomainsStrip } from "@/components/dashboard-operational-domains-strip";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardOperationalSummary } from "@/components/dashboard-operational-summary";
import {
  getDashboardHeroState,
  getOperationalPromotionForRecommendation,
  orderDashboardModuleCards,
  orderDashboardRecommendations,
  getDashboardPriorityClass,
  getDashboardPriorityLabel,
} from "@/lib/dashboard-home";
import {
  generateDashboardChargeFromQuoteAction,
  markDashboardChargeTodayAction,
  markDashboardCustomerStatusAction,
  markDashboardQuoteFollowUpAction,
} from "@/app/dashboard/actions";
import {
  getDashboardCadenceMetrics,
  getDashboardCadenceRisks,
  getDashboardRecommendations,
  getDashboardStats,
  getTodayAgenda,
} from "@/lib/workspace-repository";
import { mapOperationalAlertsToNavigationSignals } from "@/lib/dashboard-navigation-signals";
import { getOperationalAlerts, getPrimaryOperationalAlert } from "@/lib/operational-alerts";
import { listWorkspaceAuditEntriesByActions, listWorkspaceAuditEntriesByType } from "@/lib/audit-repository";
import { buildOperationalDiagnosticsSnapshot } from "@/lib/operational-diagnostics";
import { summarizeOperationalSignals } from "@/lib/operational-diagnostics-panel-helpers";

export default async function DashboardPage() {
  const [
    dashboardStats,
    todayAgenda,
    recommendations,
    cadenceMetrics,
    cadenceRisks,
    operationalAlerts,
    operationalDiagnostics,
    evolutionAuditEntries,
    fiscalAuditEntries,
    asaasIncidentEntries,
    asaasLifecycleEntries,
    subscriptionAuditEntries,
  ] = await Promise.all([
    getDashboardStats(),
    getTodayAgenda(),
    getDashboardRecommendations(),
    getDashboardCadenceMetrics(),
    getDashboardCadenceRisks(),
    getOperationalAlerts(),
    buildOperationalDiagnosticsSnapshot("dashboard-home"),
    listWorkspaceAuditEntriesByType("evolution", 6),
    listWorkspaceAuditEntriesByType("nfse", 6),
    listWorkspaceAuditEntriesByActions(["charge.asaas.failed", "asaas.payment_overdue"], 6),
    listWorkspaceAuditEntriesByActions(["workspace.asaas.connected", "workspace.asaas.disconnected", "workspace.asaas.subaccount_created"], 6),
    listWorkspaceAuditEntriesByActions(["workspace.subscription.checkout_created", "workspace.subscription.checkout_synced", "subscription.asaas.payment_overdue", "subscription.asaas.payment_received", "subscription.asaas.payment_confirmed"], 6),
  ]);

  const headlineStats = dashboardStats.slice(0, 4);
  const navigationSignals = mapOperationalAlertsToNavigationSignals(operationalAlerts);
  const orderedModuleCards = orderDashboardModuleCards(navigationSignals);
  const orderedRecommendations = orderDashboardRecommendations(recommendations, navigationSignals);
  const primaryOperationalAlert = getPrimaryOperationalAlert(operationalAlerts);
  const heroState = getDashboardHeroState(orderedRecommendations, navigationSignals, primaryOperationalAlert);
  const operationalSignals = {
    evolution: summarizeOperationalSignals(evolutionAuditEntries),
    fiscal: summarizeOperationalSignals(fiscalAuditEntries),
    asaas: summarizeOperationalSignals([
      ...asaasIncidentEntries,
      ...asaasLifecycleEntries,
    ]),
    subscription: summarizeOperationalSignals(subscriptionAuditEntries),
  };

  return (
    <DashboardShell
      currentPath="/dashboard"
      eyebrow="Central da empresa"
      title="Central executiva, curta e objetiva."
      description="Dire??o, atalhos e prioridades em uma leitura r?pida."
      actions={(
        <>
          <Link href="/dashboard/setup" className="secondary-link">
            Empresa
          </Link>
          <Link href="/dashboard/reports" className="primary-link">
            Relat?rios
          </Link>
        </>
      )}
    >
      <DashboardOperationalDomainsStrip signals={navigationSignals} />

      <section className="dashboard-overview-hero">
        <article className={`dashboard-spotlight-card fade-in-up ${getDashboardPriorityClass(heroState.priority)}`}>
          <div className="dashboard-spotlight-header">
            <div>
              <span className="section-label">Prioridade do dia</span>
              <h2>{heroState.title}</h2>
            </div>
            <span className={`dashboard-priority-badge ${getDashboardPriorityClass(heroState.priority)}`}>
              {heroState.badgeLabel}
            </span>
          </div>

          <p>{heroState.description}</p>
          {heroState.sourceLabel ? (
            <small className="dashboard-hero-cause">
              Dominio em foco: {heroState.sourceLabel}
            </small>
          ) : null}
          {heroState.recoveryMessage ? (
            <small className="dashboard-hero-recovery">
              Ultimo sinal saudavel: {heroState.recoveryMessage}
            </small>
          ) : null}

          <div className="dashboard-hero-actions">
            {heroState.action?.kind === "quote_followup" ? (
              <form action={markDashboardQuoteFollowUpAction} className="card-action">
                <input type="hidden" name="id" value={heroState.action.targetId} />
                <input type="hidden" name="dueLabel" value={heroState.action.dueLabel || "Follow-up hoje"} />
                <button type="submit" className="primary-link">
                  {heroState.action.label}
                </button>
              </form>
            ) : null}
            {heroState.action?.kind === "quote_to_charge" ? (
              <form action={generateDashboardChargeFromQuoteAction} className="card-action">
                <input type="hidden" name="id" value={heroState.action.targetId} />
                <button type="submit" className="primary-link">
                  {heroState.action.label}
                </button>
              </form>
            ) : null}
            {heroState.action?.kind === "customer_status" ? (
              <form action={markDashboardCustomerStatusAction} className="card-action">
                <input type="hidden" name="id" value={heroState.action.targetId} />
                <input type="hidden" name="status" value={heroState.action.status || ""} />
                <input type="hidden" name="note" value={heroState.action.note || ""} />
                <button type="submit" className="primary-link">
                  {heroState.action.label}
                </button>
              </form>
            ) : null}
            {heroState.action?.kind === "charge_today" ? (
              <form action={markDashboardChargeTodayAction} className="card-action">
                <input type="hidden" name="id" value={heroState.action.targetId} />
                <button type="submit" className="primary-link">
                  {heroState.action.label}
                </button>
              </form>
            ) : null}
            <Link href={heroState.href} className="secondary-link">
              {heroState.hrefLabel}
            </Link>
          </div>

          <div className="dashboard-top-metrics">
            {headlineStats.map((stat) => (
              <article key={stat.label} className="dashboard-metric-tile">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.helper}</small>
              </article>
            ))}
          </div>
        </article>

        <aside className="dashboard-overview-stack">
          <article className="dashboard-mini-panel dashboard-mini-panel-compact fade-in-up fade-delay-1">
            <span className="section-label">Hoje</span>
            <div className="dashboard-shortcuts-grid dashboard-shortcuts-grid-compact">
              {todayAgenda.slice(0, 3).map((item) => (
                <article key={item.title} className="dashboard-shortcut-card dashboard-shortcut-card-text">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </article>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="data-panel data-panel-refined">
        <div className="card-header">
            <div>
              <span className="section-label">Áreas do sistema</span>
              <h2>Entre direto no que precisa resolver agora</h2>
            </div>
        </div>

        <div className="cards-grid quote-grid">
          {orderedModuleCards.map((item) => (
            <Link key={item.href} href={item.href} className="dashboard-card dashboard-card-refined nav-card fade-in-up">
              <span className="dashboard-kicker">{item.kicker}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-focus-grid">
        <article className="data-panel data-panel-refined">
          <div className="card-header">
            <div>
              <span className="section-label">Prioridades</span>
              <h2>O que atacar primeiro</h2>
            </div>
          </div>

          {orderedRecommendations.length > 0 ? (
            <div className="cards-grid quote-grid">
              {orderedRecommendations.slice(0, 2).map((item) => (
                (() => {
                  const operationalPromotion = getOperationalPromotionForRecommendation(item, navigationSignals);

                  return (
                    <article
                      key={`${item.kicker}-${item.title}`}
                      className={`dashboard-card dashboard-card-refined fade-in-up ${getDashboardPriorityClass(item.priority)}`}
                    >
                      <div className="dashboard-card-kicker-row">
                        <span className="dashboard-kicker">{item.kicker}</span>
                        {operationalPromotion ? (
                          <span className={`dashboard-operational-badge dashboard-operational-badge-${operationalPromotion.status}`}>
                            {operationalPromotion.label}: {operationalPromotion.signalLabel}
                          </span>
                        ) : null}
                      </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <small className={`muted-text priority-text ${getDashboardPriorityClass(item.priority)}`}>{getDashboardPriorityLabel(item.priority)}</small>
                  <Link href={item.href} className="secondary-link">
                    {item.hrefLabel}
                  </Link>
                    </article>
                  );
                })()
              ))}
            </div>
          ) : (
            <div className="auth-hint">
              <strong>Sem ação destacada agora</strong>
              <span>A operação está estável neste momento. Você pode entrar direto na área que quiser acompanhar.</span>
            </div>
          )}
        </article>

        <aside className="dashboard-side-rail">
          <DashboardOperationalSummary
            snapshot={operationalDiagnostics}
            signals={operationalSignals}
          />

          <article className="agenda-card agenda-card-refined">
            <div className="card-header">
              <div>
                <span className="section-label">Riscos</span>
                <h2>O que merece atenção</h2>
              </div>
            </div>

            {cadenceRisks.length > 0 ? (
              <ul className="agenda-list">
                {cadenceRisks.slice(0, 3).map((risk) => (
                  <li key={risk.id}>
                    <strong>{risk.title}</strong>
                    <span>{risk.description}</span>
                    <Link href={risk.href} className="secondary-link">
                      {risk.hrefLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="auth-hint">
                <strong>Sem alerta forte no momento</strong>
                <span>Os principais blocos da operação estão em ordem agora.</span>
              </div>
            )}
          </article>

        </aside>
      </section>
    </DashboardShell>
  );
}
