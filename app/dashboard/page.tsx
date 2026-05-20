import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { dashboardSections } from "@/lib/site-data";
import {
  getDashboardPipeline,
  getDashboardRecommendations,
  getDashboardStats,
  getTodayAgenda,
} from "@/lib/workspace-repository";

export default async function DashboardPage() {
  const [dashboardStats, pipelineColumns, todayAgenda, recommendations] = await Promise.all([
    getDashboardStats(),
    getDashboardPipeline(),
    getTodayAgenda(),
    getDashboardRecommendations(),
  ]);

  return (
    <DashboardShell
      eyebrow="Dashboard conceitual"
      title="Um painel que fala de vendas, cobranças e próximos passos."
      description="Esta primeira versão do dashboard organiza o produto em torno do fluxo comercial, não em torno de módulos isolados."
      actions={
        <>
          <Link href="/" className="secondary-link">
            Voltar para landing
          </Link>
          <a href="mailto:contato@gestaofacil.local" className="primary-link">
            Definir beta fechado
          </a>
        </>
      }
    >

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
    </DashboardShell>
  );
}
