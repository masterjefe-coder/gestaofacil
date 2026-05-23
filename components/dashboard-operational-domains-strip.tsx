import Link from "next/link";
import {
  getDashboardNavigationSignalClass,
  type DashboardNavigationSignal,
} from "@/lib/dashboard-navigation-signals";

type DashboardOperationalDomainsStripProps = {
  signals: DashboardNavigationSignal[];
};

function getSummary(signals: DashboardNavigationSignal[]) {
  if (signals.length === 0) {
    return "Nenhum dominio operacional pede atencao estrutural agora.";
  }

  if (signals.length === 1) {
    return "1 dominio pede atencao agora.";
  }

  return `${signals.length} dominios pedem atencao agora.`;
}

export function DashboardOperationalDomainsStrip({
  signals,
}: DashboardOperationalDomainsStripProps) {
  return (
    <section className="dashboard-domain-strip fade-in-up">
      <div className="dashboard-domain-strip-copy">
        <span className="section-label">Atencao por dominio</span>
        <strong>{signals.length === 0 ? "Operacao distribuida e estavel" : "Entre direto no ponto sensivel"}</strong>
        <p>{getSummary(signals)}</p>
      </div>

      <div className="dashboard-domain-strip-list">
        {signals.length > 0 ? (
          signals.map((signal) => (
            <Link
              key={`${signal.href}-${signal.label}`}
              href={signal.href}
              className={`dashboard-domain-chip dashboard-domain-chip-${getDashboardNavigationSignalClass(signal.status)}`}
            >
              <span>{signal.label}</span>
              <small>{signal.href === "/dashboard/setup" ? "Abrir empresa" : "Abrir modulo"}</small>
            </Link>
          ))
        ) : (
          <>
            <Link href="/dashboard/setup" className="dashboard-domain-chip dashboard-domain-chip-ok">
              <span>Empresa</span>
              <small>Base estavel</small>
            </Link>
            <Link href="/dashboard/billing" className="dashboard-domain-chip dashboard-domain-chip-ok">
              <span>Cobranca</span>
              <small>Fluxo estavel</small>
            </Link>
            <Link href="/dashboard/fiscal" className="dashboard-domain-chip dashboard-domain-chip-ok">
              <span>Fiscal</span>
              <small>Emissao pronta</small>
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
