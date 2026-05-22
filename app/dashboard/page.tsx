import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  dashboardModuleCards,
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

export default async function DashboardPage() {
  const [dashboardStats, todayAgenda, recommendations, cadenceMetrics, cadenceRisks] = await Promise.all([
    getDashboardStats(),
    getTodayAgenda(),
    getDashboardRecommendations(),
    getDashboardCadenceMetrics(),
    getDashboardCadenceRisks(),
  ]);

  const heroRecommendation = recommendations[0];
  const headlineStats = dashboardStats.slice(0, 4);

  return (
    <DashboardShell
      currentPath="/dashboard"
      eyebrow="Central da empresa"
      title="Escolha a área certa e siga a operação sem ruído."
      description="A tela inicial agora funciona como uma central de entrada: você vê a prioridade do dia e entra direto no módulo certo."
      actions={(
        <>
          <Link href="/dashboard/setup" className="secondary-link">
            Ajustar empresa
          </Link>
          <Link href="/dashboard/reports" className="primary-link">
            Abrir relatórios
          </Link>
        </>
      )}
    >
      <section className="dashboard-overview-hero">
        <article className={`dashboard-spotlight-card fade-in-up ${heroRecommendation ? getDashboardPriorityClass(heroRecommendation.priority) : "priority-normal"}`}>
          <div className="dashboard-spotlight-header">
            <div>
              <span className="section-label">Prioridade do dia</span>
              <h2>{heroRecommendation?.title || "A operação está estável e pronta para seguir pelos módulos."}</h2>
            </div>
            <span className={`dashboard-priority-badge ${heroRecommendation ? getDashboardPriorityClass(heroRecommendation.priority) : "priority-normal"}`}>
              {heroRecommendation ? getDashboardPriorityLabel(heroRecommendation.priority) : "Tudo sob controle"}
            </span>
          </div>

          <p>
            {heroRecommendation?.description || "Quando surgir um ponto realmente importante, ele aparece aqui primeiro para você não perder tempo procurando onde agir."}
          </p>

          <div className="dashboard-hero-actions">
            {heroRecommendation?.action?.kind === "quote_followup" ? (
              <form action={markDashboardQuoteFollowUpAction} className="card-action">
                <input type="hidden" name="id" value={heroRecommendation.action.targetId} />
                <input type="hidden" name="dueLabel" value={heroRecommendation.action.dueLabel || "Follow-up hoje"} />
                <button type="submit" className="primary-link">
                  {heroRecommendation.action.label}
                </button>
              </form>
            ) : null}
            {heroRecommendation?.action?.kind === "quote_to_charge" ? (
              <form action={generateDashboardChargeFromQuoteAction} className="card-action">
                <input type="hidden" name="id" value={heroRecommendation.action.targetId} />
                <button type="submit" className="primary-link">
                  {heroRecommendation.action.label}
                </button>
              </form>
            ) : null}
            {heroRecommendation?.action?.kind === "customer_status" ? (
              <form action={markDashboardCustomerStatusAction} className="card-action">
                <input type="hidden" name="id" value={heroRecommendation.action.targetId} />
                <input type="hidden" name="status" value={heroRecommendation.action.status || ""} />
                <input type="hidden" name="note" value={heroRecommendation.action.note || ""} />
                <button type="submit" className="primary-link">
                  {heroRecommendation.action.label}
                </button>
              </form>
            ) : null}
            {heroRecommendation?.action?.kind === "charge_today" ? (
              <form action={markDashboardChargeTodayAction} className="card-action">
                <input type="hidden" name="id" value={heroRecommendation.action.targetId} />
                <button type="submit" className="primary-link">
                  {heroRecommendation.action.label}
                </button>
              </form>
            ) : null}
            <Link href={heroRecommendation?.href || "/dashboard/quotes"} className="secondary-link">
              {heroRecommendation?.hrefLabel || "Abrir área responsável"}
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
          <article className="dashboard-mini-panel fade-in-up fade-delay-1">
            <span className="section-label">Entrada rápida</span>
            <div className="dashboard-mini-list">
              <article>
                <strong>Comece pelo módulo certo</strong>
                <p>Clientes, orçamentos, pedidos, financeiro, notas, empresa e equipe ficam separados logo abaixo.</p>
              </article>
              <article>
                <strong>Sem excesso na tela inicial</strong>
                <p>A home agora mostra só direção, prioridade e atalhos, não a operação inteira de uma vez.</p>
              </article>
            </div>
          </article>

          <article className="dashboard-mini-panel fade-in-up fade-delay-2">
            <span className="section-label">Hoje</span>
            <div className="dashboard-mini-list">
              {todayAgenda.slice(0, 3).map((item) => (
                <article key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
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
            <h2>Entre direto no que você quer resolver</h2>
          </div>
        </div>

        <div className="cards-grid quote-grid">
          {dashboardModuleCards.map((item) => (
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
              <span className="section-label">Próximas ações</span>
              <h2>O que vale atacar primeiro</h2>
            </div>
          </div>

          {recommendations.length > 0 ? (
            <div className="cards-grid quote-grid">
              {recommendations.slice(0, 3).map((item) => (
                <article
                  key={`${item.kicker}-${item.title}`}
                  className={`dashboard-card dashboard-card-refined fade-in-up ${getDashboardPriorityClass(item.priority)}`}
                >
                  <span className="dashboard-kicker">{item.kicker}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <small className={`muted-text priority-text ${getDashboardPriorityClass(item.priority)}`}>{getDashboardPriorityLabel(item.priority)}</small>
                  <Link href={item.href} className="secondary-link">
                    {item.hrefLabel}
                  </Link>
                </article>
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
          <article className="agenda-card agenda-card-refined">
            <div className="card-header">
              <div>
                <span className="section-label">Alertas</span>
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

          <article className="agenda-card agenda-card-refined">
            <div className="card-header">
              <div>
                <span className="section-label">Indicadores</span>
                <h2>Leitura rápida</h2>
              </div>
            </div>

            <div className="stats-row stats-row-compact">
              {cadenceMetrics.map((metric) => (
                <article key={metric.label} className="stat-card stat-card-refined">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <p>{metric.helper}</p>
                </article>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </DashboardShell>
  );
}
