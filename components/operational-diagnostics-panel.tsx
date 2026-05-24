import Link from "next/link";
import {
  getOperationalDiagnosticAction,
  getOperationalSignalToneClass,
  type OperationalDiagnosticsDomainSummary,
} from "@/lib/operational-diagnostics-panel-helpers";
import type { OperationalDiagnosticsSnapshot } from "@/lib/operational-diagnostics";

type OperationalDiagnosticsPanelProps = {
  snapshot: OperationalDiagnosticsSnapshot;
  signals: {
    evolution: OperationalDiagnosticsDomainSummary;
    asaas: OperationalDiagnosticsDomainSummary;
    fiscal: OperationalDiagnosticsDomainSummary;
    subscription: OperationalDiagnosticsDomainSummary;
  };
};

function getStatusTone(status: "ok" | "warning") {
  return status === "ok" ? "split-panel success" : "split-panel";
}

function getStatusLabel(status: "ok" | "warning") {
  return status === "ok" ? "Saudável" : "Atenção";
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Sem falha registrada.";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getProviderOutcomeLabel(value: "success" | "failure" | "circuit-open" | null) {
  switch (value) {
    case "success":
      return "Ultima chamada saudavel";
      
    case "failure":
      return "Última chamada com falha";
    case "circuit-open":
      return "Proteção aberta na última tentativa";
    default:
      return "Sem chamada recente";
  }
}

export function OperationalDiagnosticsPanel({ snapshot, signals }: OperationalDiagnosticsPanelProps) {
  const circuitBreakers = Object.entries(snapshot.resilience.circuitBreakers);
  const providers = Object.entries(snapshot.resilience.providers);
  const topChecks = snapshot.checks.slice(0, 6);
  const warningChecks = snapshot.checks.filter((check) => check.level === "warning").slice(0, 4);

  return (
    <section className="data-panel">
      <div className="card-header">
        <div>
          <span className="section-label">Diagnostico operacional</span>
          <h2>Leitura viva do runtime e das integrações</h2>
        </div>
      </div>

      <div className="ops-diagnostics-grid">
        <article className={getStatusTone(snapshot.status)}>
          <span className="section-label">Panorama</span>
          <h2>{getStatusLabel(snapshot.status)}</h2>
          <p>
            {snapshot.summary.warningCount === 0
              ? "Os sinais monitorados estao sem alerta estrutural agora."
              : `${snapshot.summary.warningCount} alerta(s) pedem revisão antes de ampliar automações.`}
          </p>
          <div className="ops-inline-meta">
            <span>{snapshot.summary.okCount} checks ok</span>
            <span>{snapshot.summary.warningCount} warnings</span>
            <span>{snapshot.runtime.mode === "database" ? "Banco ativo" : "Modo local"}</span>
          </div>
        </article>

        <article className={getStatusTone(snapshot.integrations.evolution.connectivity.reachable ? "ok" : "warning")}>
          <span className="section-label">WhatsApp</span>
          <h2>{snapshot.integrations.evolution.connectivity.reachable ? "Conectado" : "Instável"}</h2>
          <p>{snapshot.integrations.evolution.connectivity.summary}</p>
          <div className="ops-inline-meta">
            <span>{snapshot.integrations.evolution.defaultInstanceConfigured ? "Instância principal definida" : "Sem instância padrão"}</span>
            <span>Timeout {snapshot.integrations.evolution.timeoutMs}ms</span>
          </div>
        </article>

        <article className={getStatusTone(snapshot.integrations.asaas.webhookConfigured ? "ok" : "warning")}>
          <span className="section-label">Cobranca</span>
          
          <h2>{snapshot.integrations.asaas.webhookConfigured ? "Webhook pronto" : "Webhook pendente"}</h2>
          <p>{snapshot.integrations.asaas.helper}</p>
          <div className="ops-inline-meta">
            <span>{snapshot.integrations.asaas.environment}</span>
            <span>{snapshot.integrations.asaas.webhookTokenConfigured ? "Token configurado" : "Token ausente"}</span>
          </div>
        </article>

        <article className={getStatusTone(snapshot.integrations.nfse.certificateInspection.ok ? "ok" : "warning")}>
          <span className="section-label">Fiscal</span>
          <h2>{snapshot.integrations.nfse.ready ? "Pronto" : "Parcial"}</h2>
          <p>
            {snapshot.integrations.nfse.certificateInspection.ok
              ? "Certificado fiscal lido com sucesso para sustentar emissão automática."
              : snapshot.integrations.nfse.certificateInspection.error || snapshot.integrations.nfse.helper}
          </p>
          <div className="ops-inline-meta">
            <span>{snapshot.integrations.nfse.environment}</span>
            <span>{snapshot.integrations.nfse.certificateSource || "Sem certificado"}</span>
          </div>
        </article>
      </div>

      <div className="section-split">
        <article className={getStatusTone(snapshot.resilience.openCircuitBreakerCount === 0 ? "ok" : "warning")}>
          <span className="section-label">Resiliência externa</span>
          <h2>{snapshot.resilience.openCircuitBreakerCount === 0 ? "Estável" : "Degradada"}</h2>
          <p>
            {snapshot.resilience.openCircuitBreakerCount === 0
              ? snapshot.resilience.halfOpenCircuitBreakerCount > 0
                ? `${snapshot.resilience.halfOpenCircuitBreakerCount} integração(ões) em recuperação monitorada.`
                : "Nenhum circuit breaker aberto nas integrações observadas."
              : `${snapshot.resilience.openCircuitBreakerCount} integração(ões) estão com proteção aberta agora.`}
          </p>
          {circuitBreakers.length > 0 ? (
            <ul className="ops-breaker-list">
              {circuitBreakers.map(([name, state]) => (
                <li key={name}>
                  <strong>{name}</strong>
                  <span>{state.state} · {state.failureCount} falha(s)</span>
                  <small>{formatTimestamp(state.lastFailureAt)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <small className="muted-text">Ainda não houve abertura de proteção nas integrações monitoradas.</small>
          )}
        </article>

        <article className="split-panel">
          <span className="section-label">Correlação e acesso</span>
          <h2>Request tracing ativo</h2>
          <p>
            Toda resposta operacional ecoa <code>{snapshot.requestTracing.header}</code>, o que ajuda a ligar rota,
            provedor e incidente no mesmo fio de investigação.
          </p>
          <div className="ops-inline-meta">
            <span>{snapshot.runtime.healthTokenConfigured ? "Health token pronto" : "Health token ausente"}</span>
            <span>{snapshot.runtime.authSecretConfigured ? "Segredo de sessão ok" : "Segredo pendente"}</span>
            <span>{snapshot.runtime.rateLimitMode === "distributed" ? "Rate limit distribuído" : "Rate limit local"}</span>
            <span>Request ID base: {snapshot.requestId}</span>
          </div>
          <div className="hero-actions">
            <Link href="/api/diagnostics" className="secondary-link">
              Abrir diagnostico JSON
            </Link>
            <Link href="/api/health" className="secondary-link">
              Abrir health
            </Link>
          </div>
        </article>
      </div>

      <article className="split-panel">
        <span className="section-label">Telemetria por provedor</span>
        <h2>Como as integrações estão se comportando na prática</h2>
        {providers.length > 0 ? (
          <div className="ops-breaker-list">
            {providers.map(([name, state]) => (
              <div key={name} className="ops-provider-item">
                <strong>{name}</strong>
                <span>{getProviderOutcomeLabel(state.lastOutcome)}</span>
                <small>
                  {state.successCount} sucesso(s) · {state.failureCount} falha(s) · {state.retriedCalls} com retry
                </small>
                <small>
                  {state.lastDurationMs !== null ? `${state.lastDurationMs}ms na última chamada` : "Sem duração recente"}
                  {state.lastStatusCode ? ` · status ${state.lastStatusCode}` : ""}
                </small>
                {state.lastErrorMessage ? <small>{state.lastErrorMessage}</small> : null}
              </div>
            ))}
          </div>
        ) : (
          <small className="muted-text">As chamadas externas ainda nao geraram amostra suficiente neste runtime.</small>
        )}
      </article>

      <article className="split-panel">
        <span className="section-label">Fila assíncrona</span>
        <h2>Jobs operacionais em background</h2>
        <div className="ops-inline-meta">
          <span>{snapshot.resilience.jobs.pendingCount} pendente(s)</span>
          <span>{snapshot.resilience.jobs.runningCount} em execução</span>
          <span>{snapshot.resilience.jobs.failedCount} falho(s)</span>
          <span>{snapshot.resilience.jobs.completedCount} concluído(s)</span>
        </div>
        <p>
          {snapshot.resilience.jobs.failedCount > 0
            ? "Existe job falho pedindo triagem manual ou nova tentativa controlada."
            : snapshot.resilience.jobs.pendingCount > 0
              ? "A fila tem trabalho pendente, mas sem falha estrutural conhecida agora."
              : "Nenhum job operacional pendente ou falho no momento."}
        </p>
      </article>

      <article className="split-panel">
        <span className="section-label">Checks principais</span>
        <h2>O que sustenta a operação agora</h2>
        <div className="ops-check-list">
          {topChecks.map((check) => (
            <div key={check.key} className={`ops-check-item ${check.level === "ok" ? "ok" : "warning"}`}>
              <strong>{check.key}</strong>
              <p>{check.summary}</p>
            </div>
          ))}
        </div>
      </article>

      <div className="section-split">
        <article className={getOperationalSignalToneClass(signals.evolution.primaryTone)}>
          <span className="section-label">Último sinal do WhatsApp</span>
          <h2>{signals.evolution.primary ? "Atividade recente recebida" : "Sem evento recente"}</h2>
          <p>{signals.evolution.primary ? signals.evolution.primary.summary : "Nenhum evento recente da Evolution foi auditado neste workspace."}</p>
          {signals.evolution.primary ? (
            <div className="ops-inline-meta">
              <span>{signals.evolution.primary.action}</span>
              <span>{signals.evolution.primary.createdAt}</span>
              {signals.evolution.recovery ? <span>Último ok: {signals.evolution.recovery.createdAt}</span> : null}
            </div>
          ) : null}
        </article>

        <article className={getOperationalSignalToneClass(signals.asaas.primaryTone)}>
          <span className="section-label">Último sinal da cobrança</span>
          <h2>{signals.asaas.primary ? "Leitura recente disponível" : "Sem incidente recente"}</h2>
          <p>
            {signals.asaas.primary
              ? signals.asaas.primary.summary
                : "Até aqui, nenhuma falha relevante de cobrança foi registrada no workspace."}
          </p>
          {signals.asaas.primary ? (
            <div className="ops-inline-meta">
              <span>{signals.asaas.primary.action}</span>
              <span>{signals.asaas.primary.createdAt}</span>
              {signals.asaas.recovery ? <span>Último ok: {signals.asaas.recovery.createdAt}</span> : null}
            </div>
          ) : null}
        </article>
      </div>

      <div className="section-split">
        <article className={getOperationalSignalToneClass(signals.fiscal.primaryTone)}>
          <span className="section-label">Último sinal fiscal</span>
          <h2>{signals.fiscal.primary ? "Movimento fiscal recente" : "Sem movimento recente"}</h2>
          <p>
            {signals.fiscal.primary
              ? signals.fiscal.primary.summary
              : "Os próximos rascunhos, revisões e emissões fiscais vão aparecer aqui."}
          </p>
          {signals.fiscal.primary ? (
            <div className="ops-inline-meta">
              <span>{signals.fiscal.primary.action}</span>
              <span>{signals.fiscal.primary.createdAt}</span>
              {signals.fiscal.recovery ? <span>Último ok: {signals.fiscal.recovery.createdAt}</span> : null}
            </div>
          ) : null}
        </article>

        <article className={getOperationalSignalToneClass(signals.subscription.primaryTone)}>
          <span className="section-label">Último sinal da assinatura</span>
          <h2>{signals.subscription.primary ? "Movimento recente registrado" : "Sem movimento recente"}</h2>
          <p>
            {signals.subscription.primary
              ? signals.subscription.primary.summary
              : "Os próximos eventos do checkout ou da recorrência da assinatura vão aparecer aqui."}
          </p>
          {signals.subscription.primary ? (
            <div className="ops-inline-meta">
              <span>{signals.subscription.primary.action}</span>
              <span>{signals.subscription.primary.createdAt}</span>
              {signals.subscription.recovery ? <span>Último ok: {signals.subscription.recovery.createdAt}</span> : null}
            </div>
          ) : null}
        </article>
      </div>

      {warningChecks.length > 0 ? (
        <article className="split-panel">
          <span className="section-label">Próximas ações</span>
          <h2>Onde atacar primeiro</h2>
          <div className="ops-actions-list">
            {warningChecks.map((check) => {
              const action = getOperationalDiagnosticAction(check.key);

              return (
                <div key={check.key} className="ops-action-item">
                  <div>
                    <strong>{check.key}</strong>
                    <p>{check.summary}</p>
                  </div>
                  {action ? (
                    <Link href={action.href} className="secondary-link">
                      {action.label}
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </article>
      ) : null}
    </section>
  );
}
