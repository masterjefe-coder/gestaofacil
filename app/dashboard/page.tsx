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

  return (
    <DashboardShell
      currentPath="/dashboard"
      eyebrow="Operação do workspace"
      title="O que precisa acontecer hoje aparece aqui primeiro."
      description="O painel prioriza o próximo passo comercial, financeiro e fiscal sem te obrigar a caçar informação em módulos separados."
      actions={
        <>
          <Link href="/" className="secondary-link">
            Ver site
          </Link>
          <Link href="/dashboard/setup" className="primary-link">Configurar workspace</Link>
        </>
      }
    >
      <section className="dashboard-command-strip">
        <article className="command-panel">
          <div>
            <span className="section-label">Situação do dia</span>
            <h2>O painel começa pela leitura executiva da operação.</h2>
            <p>
              Se alguma parte do fluxo está travando conversão, recebimento ou emissão, ela precisa aparecer antes de qualquer navegação manual.
            </p>
          </div>
          <div className="command-panel-grid">
            <article className="command-chip">
              <span>Foco imediato</span>
              <strong>{recommendations[0]?.title || "Fluxo sem gargalo crítico agora"}</strong>
            </article>
            <article className="command-chip">
              <span>Maior risco</span>
              <strong>{cadenceRisks[0]?.title || "Nenhum risco operacional gritando agora"}</strong>
            </article>
            <article className="command-chip">
              <span>Próxima disciplina</span>
              <strong>{todayAgenda[0]?.title || "Sem agenda crítica no momento"}</strong>
            </article>
          </div>
        </article>

        <article className="agenda-card">
          <div className="card-header">
            <div>
              <span className="section-label">Atalho de operação</span>
              <h2>Entradas mais usadas</h2>
            </div>
          </div>
          <div className="hero-actions">
            <Link href="/dashboard/quotes" className="secondary-link">
              Abrir orçamentos
            </Link>
            <Link href="/dashboard/billing" className="secondary-link">
              Abrir cobranças
            </Link>
            <Link href="/dashboard/fiscal" className="secondary-link">
              Abrir fiscal
            </Link>
          </div>
        </article>
      </section>

      <section className="stats-row">
        {dashboardStats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <p>{stat.helper}</p>
          </article>
        ))}
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Ações recomendadas</span>
            <h2>O melhor próximo passo do dia já aparece aqui</h2>
          </div>
        </div>

        {recommendations.length > 0 ? (
          <div className="cards-grid quote-grid">
            {recommendations.map((item) => (
              <article key={`${item.kicker}-${item.title}`} className="dashboard-card">
                <span className="dashboard-kicker">{item.kicker}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <small className="muted-text">
                  {item.priority === "critical" ? "Prioridade crítica" : item.priority === "high" ? "Prioridade alta" : "Prioridade normal"}
                </small>
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
            <span>Quando o produto identificar gargalos claros entre comercial, cobrança e fiscal, as próximas ações vão aparecer aqui.</span>
          </div>
        )}
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Cadência transversal</span>
            <h2>Travados, conversões e compromissos no mesmo painel</h2>
          </div>
        </div>

        <div className="kanban-board">
          {cadenceLanes.map((lane) => (
            <div key={lane.id} className="kanban-column">
              <div className="kanban-column-header">
                <h3>{lane.title}</h3>
                <span>{lane.items.length}</span>
              </div>
              <small className="muted-text">{lane.helper}</small>
              <div className="kanban-items">
                {lane.items.length > 0 ? lane.items.map((item) => (
                  <article key={item.id} className="kanban-item">
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
                  <article className="kanban-item">
                    <strong>Sem item crítico agora</strong>
                    <span>A cadência deste bloco está limpa neste momento.</span>
                    <small>Assim que o fluxo acumular sinais, os gargalos entram aqui.</small>
                  </article>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="kanban-card">
          <div className="card-header">
            <div>
              <span className="section-label">Saúde da cadência</span>
              <h2>Indicadores da operação guiada</h2>
            </div>
          </div>

          <div className="stats-row">
            {cadenceMetrics.map((metric) => (
              <article key={metric.label} className="stat-card">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.helper}</p>
              </article>
            ))}
          </div>
        </article>

        <aside className="agenda-card">
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
              <span>A cadência operacional está sem sinais claros de envelhecimento ruim agora.</span>
            </div>
          )}
        </aside>
      </section>

      <section className="section-grid dashboard-preview">
        <div>
          <span className="section-label">Navegação do MVP</span>
          <h2>Os primeiros módulos precisam seguir o fluxo comercial, não a lógica de ERP.</h2>
        </div>
        <div className="cards-grid">
          {dashboardSections.map((section) => (
            <Link key={section.href} href={section.href} className="dashboard-card nav-card">
              <span className="dashboard-kicker">{section.kicker}</span>
              <h3>{section.title}</h3>
              <p>{section.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="kanban-card">
          <div className="card-header">
            <div>
              <span className="section-label">Funil comercial</span>
              <h2>Visão de oportunidades e orçamentos</h2>
            </div>
          </div>

          <div className="kanban-board">
            {pipelineColumns.map((column) => (
              <div key={column.title} className="kanban-column">
                <div className="kanban-column-header">
                  <h3>{column.title}</h3>
                  <span>{column.total}</span>
                </div>
                <div className="kanban-items">
                  {column.items.map((item) => (
                    <article key={item.title} className="kanban-item">
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

        <aside className="agenda-card">
          <div className="card-header">
            <div>
              <span className="section-label">Próximas ações</span>
              <h2>Hoje no Gestão Fácil</h2>
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
        </aside>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Relatórios</span>
            <h2>Exportar a operação do dia sem retrabalho</h2>
          </div>
          <div className="dashboard-actions">
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
        </div>

        <div className="stats-row">
          {cadenceMetrics.map((metric) => (
            <article key={metric.label} className="stat-card">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.helper}</p>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
