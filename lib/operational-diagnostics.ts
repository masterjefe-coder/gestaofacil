import { getAllCircuitBreakerStates, getAllRetryTelemetryStates } from "@/lib/api-retry";
import { listBackgroundJobStats } from "@/lib/background-jobs";
import { getAsaasIntegrationStatus } from "@/lib/asaas";
import { isLocalDataMode } from "@/lib/data-mode";
import { getEvolutionIntegrationStatus, probeEvolutionApi } from "@/lib/evolution-api";
import { inspectNfseNationalCertificate } from "@/lib/nfse-national-provider";
import { getNfseNationalMunicipalityStatus } from "@/lib/nfse-national-municipal-status";
import { getResolvedNfseIntegrationStatus } from "@/lib/nfse-provider";
import { getRateLimiterStats } from "@/lib/rate-limit";
import { REQUEST_ID_HEADER } from "@/lib/request-tracing";

type DiagnosticLevel = "ok" | "warning";

export type OperationalDiagnosticCheck = {
  key: string;
  level: DiagnosticLevel;
  summary: string;
};

type OperationalCircuitBreaker = {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failureCount: number;
  lastFailureAt: string | null;
};

type OperationalProviderTelemetry = {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  retriedCalls: number;
  totalAttempts: number;
  totalRetryDelayMs: number;
  circuitOpenRejections: number;
  lastAttemptCount: number;
  lastDurationMs: number | null;
  lastOutcome: "success" | "failure" | "circuit-open" | null;
  lastErrorMessage: string | null;
  lastStatusCode: number | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
};

export type OperationalDiagnosticsSnapshot = {
  service: string;
  timestamp: string;
  requestId: string;
  status: "ok" | "warning";
  summary: {
    okCount: number;
    warningCount: number;
  };
  requestTracing: {
    header: string;
    enabled: true;
  };
  runtime: {
    mode: "local" | "database";
    nodeEnv: string;
    databaseConfigured: boolean;
    appBaseUrlConfigured: boolean;
    healthTokenConfigured: boolean;
    authSecretConfigured: boolean;
    rateLimitMode: "local" | "distributed";
  };
  integrations: {
    asaas: {
      enabled: boolean;
      environment: "sandbox" | "production";
      webhookConfigured: boolean;
      webhookTokenConfigured: boolean;
      helper: string;
    };
    evolution: {
      enabled: boolean;
      webhookConfigured: boolean;
      defaultInstanceConfigured: boolean;
      timeoutMs: number;
      helper: string;
      connectivity: {
        configured: boolean;
        reachable: boolean;
        summary: string;
      };
    };
    nfse: {
      enabled: boolean;
      ready: boolean;
      environment: string;
      provider: string;
      hasCertificate: boolean;
      certificateSource?: "base64" | "path";
      missing: string[];
      helper: string;
      certificateInspection: {
        ok: boolean;
        validFrom?: string;
        validTo?: string;
        error?: string;
      };
    };
  };
  resilience: {
    openCircuitBreakerCount: number;
    halfOpenCircuitBreakerCount: number;
    circuitBreakers: Record<string, OperationalCircuitBreaker>;
    providers: Record<string, OperationalProviderTelemetry>;
    jobs: {
      pendingCount: number;
      runningCount: number;
      failedCount: number;
      completedCount: number;
    };
  };
  checks: OperationalDiagnosticCheck[];
};

function buildCheck(key: string, level: DiagnosticLevel, summary: string): OperationalDiagnosticCheck {
  return { key, level, summary };
}

function toLastFailureAt(value: number) {
  return value > 0 ? new Date(value).toISOString() : null;
}

export const operationalDiagnosticsDeps = {
  getAllCircuitBreakerStates,
  getAllRetryTelemetryStates,
  getRateLimiterStats,
  getAsaasIntegrationStatus,
  getEvolutionIntegrationStatus,
  getResolvedNfseIntegrationStatus,
  getNfseNationalMunicipalityStatus,
  inspectNfseNationalCertificate,
  isLocalDataMode,
  listBackgroundJobStats,
  probeEvolutionApi,
};

export async function buildOperationalDiagnosticsSnapshot(
  requestId: string,
): Promise<OperationalDiagnosticsSnapshot> {
  const asaas = operationalDiagnosticsDeps.getAsaasIntegrationStatus();
  const evolution = operationalDiagnosticsDeps.getEvolutionIntegrationStatus();
  const nfseReferenceCity = process.env.NFSE_REFERENCE_CITY?.trim();
  const nfseReferenceState = process.env.NFSE_REFERENCE_STATE?.trim();
  const municipalityStatus = await operationalDiagnosticsDeps.getNfseNationalMunicipalityStatus(
    nfseReferenceCity || "",
    nfseReferenceState || "",
  );
  const nfse = operationalDiagnosticsDeps.getResolvedNfseIntegrationStatus(
    nfseReferenceCity,
    nfseReferenceState,
    {
      municipalityStatus,
    },
  );
  const localMode = operationalDiagnosticsDeps.isLocalDataMode();
  const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());
  const appBaseUrlConfigured = Boolean(process.env.APP_BASE_URL?.trim());
  const healthTokenConfigured = Boolean(process.env.HEALTHCHECK_TOKEN?.trim());
  const authSecretConfigured = Boolean(process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim());
  const [jobStats, evolutionConnectivity, nfseCertificateInspection] = await Promise.all([
    operationalDiagnosticsDeps.listBackgroundJobStats(),
    operationalDiagnosticsDeps.probeEvolutionApi(),
    nfse.hasCertificate
      ? operationalDiagnosticsDeps.inspectNfseNationalCertificate()
      : Promise.resolve({ ok: false as const, error: "Certificado ausente." }),
  ]);
  const rateLimiterStats = operationalDiagnosticsDeps.getRateLimiterStats();
  const rawCircuitBreakers = operationalDiagnosticsDeps.getAllCircuitBreakerStates();
  const providerTelemetry = operationalDiagnosticsDeps.getAllRetryTelemetryStates();
  const circuitBreakers = Object.fromEntries(
    Object.entries(rawCircuitBreakers).map(([name, state]) => [
      name,
      {
        state: state.state,
        failureCount: state.failureCount,
        lastFailureAt: toLastFailureAt(state.lastFailureTime),
      },
    ]),
  );
  const openCircuitBreakerCount = Object.values(rawCircuitBreakers).filter((state) => state.state === "OPEN").length;
  const halfOpenCircuitBreakerCount = Object.values(rawCircuitBreakers).filter((state) => state.state === "HALF_OPEN").length;
  const checks: OperationalDiagnosticCheck[] = [
    buildCheck(
      "runtime-storage",
      localMode || databaseConfigured ? "ok" : "warning",
      localMode
        ? "Modo local ativo para desenvolvimento e demonstracao."
        : databaseConfigured
          ? "DATABASE_URL configurada para persistencia principal."
          : "DATABASE_URL ausente no modo de banco.",
    ),
    buildCheck(
      "app-base-url",
      appBaseUrlConfigured ? "ok" : "warning",
      appBaseUrlConfigured
        ? "APP_BASE_URL configurada para links e callbacks do produto."
        : "APP_BASE_URL ausente; callbacks e links publicos podem falhar.",
    ),
    buildCheck(
      "auth-secrets",
      authSecretConfigured ? "ok" : "warning",
      authSecretConfigured
        ? "Segredos de autenticacao presentes para sessao segura."
        : "AUTH_SECRET ou NEXTAUTH_SECRET ausente no ambiente.",
    ),
    buildCheck(
      "health-token",
      healthTokenConfigured ? "ok" : "warning",
      healthTokenConfigured
        ? "HEALTHCHECK_TOKEN configurado para diagnostico autenticado."
        : "HEALTHCHECK_TOKEN ausente; o endpoint detalhado depende apenas de sessao.",
    ),
    buildCheck(
      "rate-limit-mode",
      rateLimiterStats.mode === "distributed" || localMode ? "ok" : "warning",
      rateLimiterStats.mode === "distributed"
        ? "Rate limit compartilhado ativo com bucket persistido."
        : "Rate limit ainda local em memoria; bom para baixo volume, mas sem coordenacao entre instancias.",
    ),
    buildCheck(
      "asaas-webhook",
      asaas.enabled && asaas.webhookConfigured ? "ok" : "warning",
      asaas.enabled
        ? asaas.webhookConfigured
          ? "Asaas configurado com webhook autenticado."
          : "Asaas ativo, mas webhook ainda incompleto."
        : "Asaas ainda nao configurado no ambiente.",
    ),
    buildCheck(
      "evolution-webhook",
      evolution.enabled && evolution.webhookConfigured ? "ok" : "warning",
      evolution.enabled
        ? evolution.webhookConfigured
          ? "Evolution configurada com webhook autenticado."
          : "Evolution ativa, mas webhook ainda incompleto."
        : "Evolution ainda nao configurada no ambiente.",
    ),
    buildCheck(
      "evolution-connectivity",
      !evolution.enabled || evolutionConnectivity.reachable ? "ok" : "warning",
      !evolution.enabled
        ? "Probe de conectividade pulada porque a Evolution ainda nao foi configurada."
        : evolutionConnectivity.summary,
    ),
    buildCheck(
      "nfse-readiness",
      nfse.ready ? "ok" : "warning",
      nfse.ready
        ? `${nfse.provider.label} pronta para operacao automatica.`
        : `${nfse.provider.label} pendente: ${nfse.missing.join(", ") || "revisar configuracao do ambiente"}.`,
    ),
    buildCheck(
      "nfse-certificate",
      !nfse.hasCertificate || nfseCertificateInspection.ok ? "ok" : "warning",
      !nfse.hasCertificate
        ? "Certificado digital ainda nao configurado no ambiente."
        : nfseCertificateInspection.ok
          ? "Certificado digital lido com sucesso para emissao fiscal."
          : nfseCertificateInspection.error || "Falha ao inspecionar certificado digital da NFS-e.",
    ),
    buildCheck(
      "api-resilience",
      openCircuitBreakerCount === 0 ? "ok" : "warning",
      openCircuitBreakerCount === 0
        ? halfOpenCircuitBreakerCount > 0
          ? `${halfOpenCircuitBreakerCount} circuit breaker(s) em recuperacao monitorada.`
          : "Nenhum circuit breaker aberto nas integracoes monitoradas."
        : `${openCircuitBreakerCount} circuit breaker(s) aberto(s); integracoes externas podem estar degradadas.`,
    ),
    buildCheck(
      "provider-telemetry",
      Object.values(providerTelemetry).some((provider) => provider.failureCount > 0 || provider.circuitOpenRejections > 0)
        ? "warning"
        : "ok",
      Object.keys(providerTelemetry).length === 0
        ? "Telemetria de provedores ainda sem chamadas registradas neste runtime."
        : Object.entries(providerTelemetry)
          .map(([provider, state]) => {
            const outcome = state.lastOutcome || "sem resultado";
            const status = state.lastStatusCode ? ` status ${state.lastStatusCode}` : "";
            return `${provider}: ${outcome}${status}, ${state.failureCount} falha(s), ${state.retriedCalls} chamada(s) com retry`;
          })
          .join(" | "),
    ),
    buildCheck(
      "background-jobs",
      jobStats.failedCount > 0 ? "warning" : "ok",
      `${jobStats.pendingCount} job(s) pendente(s), ${jobStats.runningCount} em execucao e ${jobStats.failedCount} falho(s).`,
    ),
  ];
  const warningCount = checks.filter((check) => check.level === "warning").length;
  const okCount = checks.length - warningCount;

  return {
    service: "gestao-facil",
    timestamp: new Date().toISOString(),
    requestId,
    status: warningCount > 0 ? "warning" : "ok",
    summary: {
      okCount,
      warningCount,
    },
    requestTracing: {
      header: REQUEST_ID_HEADER,
      enabled: true,
    },
    runtime: {
      mode: localMode ? "local" : "database",
      nodeEnv: process.env.NODE_ENV || "development",
      databaseConfigured,
      appBaseUrlConfigured,
      healthTokenConfigured,
      authSecretConfigured,
      rateLimitMode: rateLimiterStats.mode,
    },
    integrations: {
      asaas: {
        enabled: asaas.enabled,
        environment: asaas.environment,
        webhookConfigured: asaas.webhookConfigured,
        webhookTokenConfigured: asaas.webhookTokenConfigured,
        helper: asaas.helper,
      },
      evolution: {
        enabled: evolution.enabled,
        webhookConfigured: evolution.webhookConfigured,
        defaultInstanceConfigured: Boolean(evolution.instance),
        timeoutMs: evolution.timeoutMs,
        helper: evolution.helper,
        connectivity: evolutionConnectivity,
      },
      nfse: {
        enabled: nfse.enabled,
        ready: nfse.ready,
        environment: nfse.environment,
        provider: nfse.provider.key,
        hasCertificate: nfse.hasCertificate,
        certificateSource: nfse.certificateSource,
        missing: nfse.missing,
        helper: nfse.helper,
        certificateInspection: {
          ok: nfseCertificateInspection.ok,
          validFrom: nfseCertificateInspection.ok ? nfseCertificateInspection.validFrom : undefined,
          validTo: nfseCertificateInspection.ok ? nfseCertificateInspection.validTo : undefined,
          error: nfseCertificateInspection.ok ? undefined : nfseCertificateInspection.error,
        },
      },
    },
    resilience: {
      openCircuitBreakerCount,
      halfOpenCircuitBreakerCount,
      circuitBreakers,
      providers: providerTelemetry,
      jobs: jobStats,
    },
    checks,
  };
}
