import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardReportSnapshot } from "@/lib/workspace-repository";

export default async function ReportsPage() {
  const report = await getDashboardReportSnapshot();

  return (
    <DashboardShell
      currentPath="/dashboard/reports"
      eyebrow="Relatórios"
      title="Ler a operação e exportar sem desmontar o fluxo."
      description="Resumo executivo, cadência, comercial, financeiro e fiscal no mesmo lugar, com saída em Excel e PDF."
      actions={
        <>
          <Link href="/dashboard" className="secondary-link">
            Voltar ao dashboard
          </Link>
          <a href="/api/reports/export" className="primary-link">
            Exportar Excel
          </a>
          <Link href="/dashboard/reports/print?autoprint=1" className="secondary-link" target="_blank">
            Gerar PDF
          </Link>
        </>
      }
    >
      <section className="auth-hint">
        <strong>Relatório operacional</strong>
        <span>Gerado em {report.generatedAt}. Use a tela para leitura rápida, o Excel para análise e o PDF para envio tradicional.</span>
      </section>

      <section className="stats-row">
        {report.summary.map((item) => (
          <article key={item.label} className="stat-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.helper}</p>
          </article>
        ))}
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Saúde da cadência</span>
            <h2>Indicadores e alertas do dia</h2>
          </div>
        </div>

        <div className="stats-row">
          {report.cadenceMetrics.map((item) => (
            <article key={item.label} className="stat-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.helper}</p>
            </article>
          ))}
        </div>

        {report.cadenceRisks.length > 0 ? (
          <div className="cards-grid quote-grid">
            {report.cadenceRisks.map((risk) => (
              <article key={risk.id} className="dashboard-card">
                <span className="dashboard-kicker">Alerta</span>
                <h3>{risk.title}</h3>
                <p>{risk.description}</p>
                <Link href={risk.href} className="secondary-link">
                  {risk.hrefLabel}
                </Link>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Cadência transversal</span>
            <h2>Travados, conversões e compromissos</h2>
          </div>
        </div>

        <div className="kanban-board">
          {report.cadenceLanes.map((lane) => (
            <div key={lane.id} className="kanban-column">
              <div className="kanban-column-header">
                <h3>{lane.title}</h3>
                <span>{lane.items.length}</span>
              </div>
              <small className="muted-text">{lane.helper}</small>
              <div className="kanban-items">
                {lane.items.map((item) => (
                  <article key={item.id} className="kanban-item">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                    <small>{item.helper}</small>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="report-grid">
        <section className="data-panel">
          <div className="card-header">
            <div>
              <span className="section-label">Comercial</span>
              <h2>Propostas em destaque</h2>
            </div>
          </div>
          <div className="report-table">
            <div className="report-table-head">
              <span>Cliente</span>
              <span>Valor</span>
              <span>Cadência</span>
              <span>Próxima etapa</span>
            </div>
            {report.topQuotes.map((item) => (
              <article key={item.quoteId} className="report-table-row">
                <strong>{item.customer}</strong>
                <span>{item.amount}</span>
                <span>{item.cadenceLabel}</span>
                <span>{item.nextStepLabel}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="data-panel">
          <div className="card-header">
            <div>
              <span className="section-label">Financeiro</span>
              <h2>Cobranças prioritárias</h2>
            </div>
          </div>
          <div className="report-table">
            <div className="report-table-head">
              <span>Cliente</span>
              <span>Valor</span>
              <span>Etapa concluída</span>
              <span>Próxima etapa</span>
            </div>
            {report.topCharges.map((item) => (
              <article key={item.id} className="report-table-row">
                <strong>{item.customer}</strong>
                <span>{item.amount}</span>
                <span>{item.completedStepLabel}</span>
                <span>{item.nextStepLabel}</span>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="report-grid">
        <section className="data-panel">
          <div className="card-header">
            <div>
              <span className="section-label">Clientes</span>
              <h2>Base que merece atenção</h2>
            </div>
          </div>
          <div className="report-table">
            <div className="report-table-head">
              <span>Cliente</span>
              <span>Status</span>
              <span>Abertos</span>
              <span>Leitura</span>
            </div>
            {report.topCustomers.map((item) => (
              <article key={item.customerId} className="report-table-row">
                <strong>{item.customerName}</strong>
                <span>{item.status}</span>
                <span>{item.openAmount}</span>
                <span>{item.headline}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="data-panel">
          <div className="card-header">
            <div>
              <span className="section-label">Fiscal</span>
              <h2>Fila de documentos</h2>
            </div>
          </div>
          <div className="report-table">
            <div className="report-table-head">
              <span>Cliente</span>
              <span>Valor</span>
              <span>Prioridade</span>
              <span>Leitura</span>
            </div>
            {report.fiscalItems.map((item) => (
              <article key={item.documentId} className="report-table-row">
                <strong>{item.customer}</strong>
                <span>{item.amount}</span>
                <span>{item.priorityLabel}</span>
                <span>{item.helper}</span>
              </article>
            ))}
          </div>
        </section>
      </section>
    </DashboardShell>
  );
}
