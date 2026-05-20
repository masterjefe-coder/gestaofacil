import Link from "next/link";
import { ReportPrintButton } from "@/components/report-print-button";
import { getDashboardReportSnapshot } from "@/lib/workspace-repository";

type PrintPageProps = {
  searchParams?: Promise<{
    autoprint?: string;
  }>;
};

export default async function ReportsPrintPage({ searchParams }: PrintPageProps) {
  const [report, params] = await Promise.all([
    getDashboardReportSnapshot(),
    searchParams,
  ]);
  const autoPrint = params?.autoprint === "1";

  return (
    <main className="page-shell print-report">
      <header className="dashboard-hero print-hide">
        <div>
          <span className="eyebrow">PDF operacional</span>
          <h1>Relatório Gestão Fácil</h1>
          <p>Versão pronta para impressão e salvamento em PDF pelo navegador.</p>
        </div>
        <div className="dashboard-actions">
          <Link href="/dashboard/reports" className="secondary-link">
            Voltar aos relatórios
          </Link>
          <ReportPrintButton autoPrint={autoPrint} />
        </div>
      </header>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Resumo</span>
            <h2>Relatório gerado em {report.generatedAt}</h2>
          </div>
        </div>
        <div className="stats-row">
          {report.summary.concat(report.cadenceMetrics).map((item) => (
            <article key={item.label} className="stat-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.helper}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Alertas</span>
            <h2>Riscos e atenção do dia</h2>
          </div>
        </div>
        <div className="report-table">
          <div className="report-table-head report-table-head-2">
            <span>Alerta</span>
            <span>Descrição</span>
          </div>
          {report.cadenceRisks.map((item) => (
            <article key={item.id} className="report-table-row report-table-row-2">
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="report-grid">
        <section className="data-panel">
          <div className="card-header">
            <div>
              <span className="section-label">Comercial</span>
              <h2>Propostas</h2>
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
              <h2>Cobranças</h2>
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
    </main>
  );
}
