import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  generateDashboardChargeFromQuoteAction,
  markDashboardChargeTodayAction,
  markDashboardCustomerStatusAction,
  markDashboardQuoteFollowUpAction,
} from "@/app/dashboard/actions";
import { dashboardSections } from "@/lib/site-data";
import {
  getDashboardPipeline,
  getDashboardCadenceLanes,
  getDashboardCadenceMetrics,
  getDashboardCadenceRisks,
  getDashboardRecommendations,
  getDashboardStats,
  getTodayAgenda,
} from "@/lib/workspace-repository";

function getPriorityLabel(priority: "critical" | "high" | "normal") {
  if (priority === "critical") {
    return "Prioridade crítica";
  }

  if (priority === "high") {
    return "Prioridade alta";
  }

  return "Prioridade normal";
}

function getPriorityClass(priority: "critical" | "high" | "normal") {
  if (priority === "critical") {
    return "priority-critical";
  }

  if (priority === "high") {
    return "priority-high";
  }

  return "priority-normal";
}

export default async function DashboardPage() {
  const [dashboardStats, pipelineColumns, todayAgenda, recommendations, cadenceLanes, cadenceMetrics, cadenceRisks] = await Promise.all([
    getDashboardStats(),
    getDashboardPipeline(),
    getTodayAgenda(),
    getDashboardRecommendations(),
    getDashboardCadenceLanes(),
    getDashboardCadenceMetrics(),
    getDashboardCadenceRisks(),
  ]);

  const heroRecommendation = recommendations[0];
  const headlineStats = dashboardStats.slice(0, 4);
  const secondaryStats = dashboardStats.slice(4);

  return (
    <DashboardShell
      currentPath="/dashboard"
      eyebrow="Central de operação"
      title="Um dashboard mais limpo, mais executivo e muito mais acionável."
      description="A home operacional agora destaca foco, risco, próximos passos e leitura de performance sem te afogar em texto ou blocos dispersos."
      actions={
        <>
          <Link href="/" className="secondary-link">
            Ver site
          </Link>
          <Link href="/dashboard/setup" className="primary-link">
            Configurar workspace
          </Link>
        </>
      }
    >
      <section className="dashboard-overview-hero">
        <article className={`dashboard-spotlight-card fade-in-up ${heroRecommendation ? getPriorityClass(heroRecommendation.priority) : "priority-normal"}`}>
          <div className="dashboard-spotlight-header">
            <div>
              <span className="section-label">Foco do dia</span>
              <h2>{heroRecommendation?.title || "A operação está estável e sem gargalo crítico agora."}</h2>
            </div>
            <span className={`dashboard-priority-badge ${heroRecommendation ? getPriorityClass(heroRecommendation.priority) : "priority-normal"}`}>
              {heroRecommendation ? getPriorityLabel(heroRecommendation.priority) : "Operação saudável"}
            </span>
          </div>

          <p>
            {heroRecommendation?.description ||
              "Quando o sistema identificar uma ação clara com impacto comercial, financeiro ou fiscal, ela vai aparecer aqui primeiro."}
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
              {heroRecommendation?.hrefLabel || "Abrir rotina comercial"}
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
            <span className="section-label">Radar rápido</span>
            <div className="dashboard-mini-list">
              <article>
                <strong>Maior risco</strong>
                <p>{cadenceRisks[0]?.title || "Sem risco crítico aparecendo agora"}</p>
              </article>
              <article>
                <strong>Próxima disciplina</strong>
                <p>{todayAgenda[0]?.title || "Sem agenda operacional urgente no momento"}</p>
              </article>
              <article>
                <strong>Canal mais quente</strong>
                <p>{cadenceLanes.find((lane) => lane.items.length > 0)?.title || "Fluxo equilibrado entre os blocos"}</p>
              </article>
            </div>
          </article>

          <article className="dashboard-mini-panel fade-in-up fade-delay-2">
            <span className="section-label">Acesso rápido</span>
            <div className="dashboard-shortcuts-grid">
              <Link href="/dashboard/quotes" className="dashboard-shortcut-card">
                <strong>Orçamentos</strong>
                <span>Converter propostas</span>
              </Link>
              <Link href="/dashboard/billing" className="dashboard-shortcut-card">
                <strong>Cobranças</strong>
                <span>Receber sem atraso</span>
              </Link>
              <Link href="/dashboard/fiscal" className="dashboard-shortcut-card">
                <strong>Fiscal</strong>
                <span>Emitir com contexto</span>
              </Link>
              <Link href="/dashboard/customers" className="dashboard-shortcut-card">
                <strong>Clientes</strong>
                <span>Histórico unificado</span>
              </Link>
            </div>
          </article>
        </aside>
      </section>

      <section className="stats-row stats-row-refined">
        {secondaryStats.map((stat) => (
          <article key={stat.label} className="stat-card stat-card-refined fade-in-up">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <p>{stat.helper}</p>
          </article>
        ))}
      </section>

      <section className="dashboard-focus-grid">
        <article className="data-panel data-panel-refined">
          <div className="card-header">
            <div>
              <span className="section-label">Próximas ações</span>
              <h2>Fila priorizada com cara de central de comando</h2>
            </div>
          </div>

          {recommendations.length > 0 ? (
            <div className="cards-grid quote-grid">
              {recommendations.map((item) => (
                <article
                  key={`${item.kicker}-${item.title}`}
                  className={`dashboard-card dashboard-card-refined fade-in-up ${getPriorityClass(item.priority)}`}
                >
                  <span className="dashboard-kicker">{item.kicker}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <small className={`muted-text priority-text ${getPriorityClass(item.priority)}`}>{getPriorityLabel(item.priority)}</small>
                  {item.action?.kind === "quote_followup" ? (
                    <form action={markDashboardQuoteFollowUpAction} className="card-action">
                      <input type="hidden" name="id" value={item.action.targetId} />
                      <input type="hidden" name="dueLabel" value={item.action.dueLabel || "Follow-up hoje"} />
                      <button type="submit" className="primary-link">
                        {item.action.label}
                      </button>
                    </form>
                  ) : null}
                  {item.action?.kind === "quote_to_charge" ? (
                    <form action={generateDashboardChargeFromQuoteAction} className="card-action">
                      <input type="hidden" name="id" value={item.action.targetId} />
                      <button type="submit" className="primary-link">
                        {item.action.label}
                      </button>
                    </form>
                  ) : null}
                  {item.action?.kind === "customer_status" ? (
                    <form action={markDashboardCustomerStatusAction} className="card-action">
                      <input type="hidden" name="id" value={item.action.targetId} />
                      <input type="hidden" name="status" value={item.action.status || ""} />
                      <input type="hidden" name="note" value={item.action.note || ""} />
                      <button type="submit" className="primary-link">
                        {item.action.label}
                      </button>
                    </form>
                  ) : null}
                  {item.action?.kind === "charge_today" ? (
                    <form action={markDashboardChargeTodayAction} className="card-action">
                      <input type="hidden" name="id" value={item.action.targetId} />
                      <button type="submit" className="primary-link">
                        {item.action.label}
                      </button>
                    </form>
                  ) : null}
                  <Link href={item.href} className="secondary-link">
                    {item.hrefLabel}
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="auth-hint">
              <strong>Sem ação destacada</strong>
              <span>Quando a plataforma detectar um gargalo claro, a próxima ação aparece aqui automaticamente.</span>
            </div>
          )}
        </article>

        <aside className="dashboard-side-rail">
          <article className="agenda-card agenda-card-refined">
            <div className="card-header">
              <div>
                <span className="section-label">Agenda do dia</span>
                <h2>Compromissos que pedem atenção</h2>
              </div>
            </div>

            <ul className="agenda-list">
              {todayAgenda.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="agenda-card agenda-card-refined">
            <div className="card-header">
              <div>
                <span className="section-label">Alertas</span>
                <h2>O que pode envelhecer mal</h2>
              </div>
            </div>

            {cadenceRisks.length > 0 ? (
              <ul className="agenda-list">
                {cadenceRisks.map((risk) => (
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
                <strong>Sem risco destacado</strong>
                <span>A cadência operacional está estável neste momento.</span>
              </div>
            )}
          </article>
        </aside>
      </section>

      <section className="data-panel data-panel-refined">
        <div className="card-header">
          <div>
            <span className="section-label">Cadência transversal</span>
            <h2>Travados, conversões e compromissos no mesmo painel</h2>
          </div>
        </div>

        <div className="kanban-board kanban-board-refined">
          {cadenceLanes.map((lane) => (
            <div key={lane.id} className="kanban-column kanban-column-refined">
              <div className="kanban-column-header">
                <h3>{lane.title}</h3>
                <span>{lane.items.length}</span>
              </div>
              <small className="muted-text">{lane.helper}</small>
              <div className="kanban-items">
                {lane.items.length > 0 ? lane.items.map((item) => (
                  <article key={item.id} className="kanban-item kanban-item-refined">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                    <small>{item.helper}</small>
                    {item.action?.kind === "quote_followup" ? (
                      <form action={markDashboardQuoteFollowUpAction} className="card-action">
                        <input type="hidden" name="id" value={item.action.targetId} />
                        <input type="hidden" name="dueLabel" value={item.action.dueLabel || "Follow-up hoje"} />
                        <button type="submit" className="secondary-link">
                          {item.action.label}
                        </button>
                      </form>
                    ) : null}
                    {item.action?.kind === "quote_to_charge" ? (
                      <form action={generateDashboardChargeFromQuoteAction} className="card-action">
                        <input type="hidden" name="id" value={item.action.targetId} />
                        <button type="submit" className="secondary-link">
                          {item.action.label}
                        </button>
                      </form>
                    ) : null}
                    {item.action?.kind === "charge_today" ? (
                      <form action={markDashboardChargeTodayAction} className="card-action">
                        <input type="hidden" name="id" value={item.action.targetId} />
                        <button type="submit" className="secondary-link">
                          {item.action.label}
                        </button>
                      </form>
                    ) : null}
                    <Link href={item.href} className="ghost-button">
                      {item.hrefLabel}
                    </Link>
                  </article>
                )) : (
                  <article className="kanban-item kanban-item-refined">
                    <strong>Sem item crítico agora</strong>
                    <span>Essa faixa está limpa no momento.</span>
                    <small>Quando surgir sinal novo, ele entra aqui automaticamente.</small>
                  </article>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-grid dashboard-grid-refined">
        <article className="kanban-card kanban-card-refined">
          <div className="card-header">
            <div>
              <span className="section-label">Módulos principais</span>
              <h2>Navegação organizada por rotina de operação</h2>
            </div>
          </div>

          <div className="cards-grid">
            {dashboardSections.map((section) => (
              <Link key={section.href} href={section.href} className="dashboard-card nav-card dashboard-card-refined">
                <span className="dashboard-kicker">{section.kicker}</span>
                <h3>{section.title}</h3>
                <p>{section.description}</p>
              </Link>
            ))}
          </div>
        </article>

        <aside className="agenda-card agenda-card-refined">
          <div className="card-header">
            <div>
              <span className="section-label">Performance</span>
              <h2>Indicadores de cadência</h2>
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
        </aside>
      </section>

      <section className="dashboard-grid dashboard-grid-refined">
        <article className="kanban-card kanban-card-refined">
          <div className="card-header">
            <div>
              <span className="section-label">Funil comercial</span>
              <h2>Visão resumida de conversas, propostas e execução</h2>
            </div>
          </div>

          <div className="kanban-board kanban-board-refined">
            {pipelineColumns.map((column) => (
              <div key={column.title} className="kanban-column kanban-column-refined">
                <div className="kanban-column-header">
                  <h3>{column.title}</h3>
                  <span>{column.total}</span>
                </div>
                <div className="kanban-items">
                  {column.items.map((item) => (
                    <article key={item.title} className="kanban-item kanban-item-refined">
                      <strong>{item.title}</strong>
                      <span>{item.subtitle}</span>
                      <small>{item.meta}</small>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <aside className="agenda-card agenda-card-refined">
          <div className="card-header">
            <div>
              <span className="section-label">Relatórios</span>
              <h2>Saída pronta para compartilhar</h2>
            </div>
          </div>

          <div className="dashboard-report-actions">
            <Link href="/dashboard/reports" className="secondary-link">
              Abrir central
            </Link>
            <a href="/api/reports/export" className="primary-link">
              Exportar Excel
            </a>
            <Link href="/dashboard/reports/print?autoprint=1" className="secondary-link" target="_blank">
              Gerar PDF
            </Link>
          </div>
        </aside>
      </section>
    </DashboardShell>
  );
}
