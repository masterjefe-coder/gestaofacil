import Link from "next/link";
import {
  getOperationalDiagnosticAction,
  getOperationalSignalToneClass,
  type OperationalDiagnosticsDomainSummary,
} from "@/lib/operational-diagnostics-panel-helpers";
import type { OperationalDiagnosticsSnapshot } from "@/lib/operational-diagnostics";

type DashboardOperationalSummaryProps = {
  snapshot: OperationalDiagnosticsSnapshot;
  signals: {
    evolution: OperationalDiagnosticsDomainSummary;
    asaas: OperationalDiagnosticsDomainSummary;
    fiscal: OperationalDiagnosticsDomainSummary;
    subscription: OperationalDiagnosticsDomainSummary;
  };
};

type SummaryItem = {
  key: string;
  label: string;
  href: string;
  fallback: string;
  summary: OperationalDiagnosticsDomainSummary;
};

function getOverviewLabel(snapshot: OperationalDiagnosticsSnapshot) {
  if (snapshot.status === "ok") {
    return "Operacao estavel";
  }

  if (snapshot.summary.warningCount === 1) {
    return "1 frente em atencao";
  }

  return `${snapshot.summary.warningCount} frentes em atencao`;
}

export function DashboardOperationalSummary({
  snapshot,
  signals,
}: DashboardOperationalSummaryProps) {
  const items: SummaryItem[] = [
    {
      key: "evolution",
      label: "WhatsApp",
      href: "/dashboard/setup#integrations-section",
      fallback: snapshot.integrations.evolution.connectivity.summary,
      summary: signals.evolution,
    },
    {
      key: "asaas",
      label: "Cobrança",
      href: "/dashboard/setup#integrations-section",
      fallback: snapshot.integrations.asaas.helper,
      summary: signals.asaas,
    },
    {
      key: "fiscal",
      label: "Fiscal",
      href: "/dashboard/fiscal",
      fallback: snapshot.integrations.nfse.certificateInspection.error || snapshot.integrations.nfse.helper,
      summary: signals.fiscal,
    },
  ];
  const warningChecks = snapshot.checks.filter((check) => check.level === "warning").slice(0, 2);

  return (
    <article className="dashboard-mini-panel dashboard-mini-panel-compact dashboard-ops-summary fade-in-up fade-delay-3">
      <div className="dashboard-ops-summary-header">
        <div>
          <span className="section-label">Status</span>
          <h2>{getOverviewLabel(snapshot)}</h2>
        </div>
        <span className={`dashboard-priority-badge ${snapshot.status === "ok" ? "priority-normal" : "priority-high"}`}>
          {snapshot.status === "ok" ? "Sem alerta estrutural" : "Pede revisao"}
        </span>
      </div>

      <p className="dashboard-ops-summary-copy">
        {snapshot.status === "ok"
          ? "Integrações principais respondendo e atalhos prontos para seguir."
          : "A home aponta onde a operação está sensível sem exigir abrir o setup."}
      </p>

      <div className="dashboard-ops-summary-list">
        {items.map((item) => (
          <Link key={item.key} href={item.href} className={getOperationalSignalToneClass(item.summary.primaryTone)}>
            <span className="dashboard-ops-summary-kicker">{item.label}</span>
            <strong>{item.summary.primary?.summary || item.fallback}</strong>
            <small>
              {item.summary.recovery
                ? `Ultimo ok: ${item.summary.recovery.createdAt}`
                : item.summary.primary
                  ? item.summary.primary.createdAt
                  : "Sem evento auditado recente"}
            </small>
          </Link>
        ))}
      </div>

      <div className="dashboard-ops-summary-actions">
        {warningChecks.length > 0 ? (
          warningChecks.map((check) => {
            const action = getOperationalDiagnosticAction(check.key);

            if (!action) {
              return null;
            }

            return (
              <Link key={check.key} href={action.href} className="secondary-link">
                {action.label}
              </Link>
            );
          })
        ) : (
          <>
            <Link href="/dashboard/setup" className="secondary-link">
              Empresa
            </Link>
            <Link href="/api/diagnostics" className="secondary-link">
              Diagnóstico
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
