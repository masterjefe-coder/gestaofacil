import { getAsaasIntegrationStatus } from "@/lib/asaas";
import { isLocalDataMode } from "@/lib/data-mode";
import { getEvolutionIntegrationStatus } from "@/lib/evolution-api";
import { getNfseNationalIntegrationStatus } from "@/lib/nfse-national-provider";
import { REQUEST_ID_HEADER } from "@/lib/request-tracing";

type DiagnosticLevel = "ok" | "warning";

export type OperationalDiagnosticCheck = {
  key: string;
  level: DiagnosticLevel;
  summary: string;
};

export type OperationalDiagnosticsSnapshot = {
  service: string;
  timestamp: string;
  requestId: string;
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
  };
  integrations: {
    asaas: {
      enabled: boolean;
      environment: "sandbox" | "production";
      webhookConfigured: boolean;
      webhookTokenConfigured: boolean;
    };
    evolution: {
      enabled: boolean;
      webhookConfigured: boolean;
      defaultInstanceConfigured: boolean;
      timeoutMs: number;
    };
    nfse: {
      enabled: boolean;
      ready: boolean;
      environment: string;
      hasCertificate: boolean;
      certificateSource?: "base64" | "path";
      missing: string[];
    };
  };
  checks: OperationalDiagnosticCheck[];
};

function buildCheck(key: string, level: DiagnosticLevel, summary: string): OperationalDiagnosticCheck {
  return { key, level, summary };
}

export function buildOperationalDiagnosticsSnapshot(requestId: string): OperationalDiagnosticsSnapshot {
  const asaas = getAsaasIntegrationStatus();
  const evolution = getEvolutionIntegrationStatus();
  const nfse = getNfseNationalIntegrationStatus();
  const localMode = isLocalDataMode();
  const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());
  const appBaseUrlConfigured = Boolean(process.env.APP_BASE_URL?.trim());
  const healthTokenConfigured = Boolean(process.env.HEALTHCHECK_TOKEN?.trim());
  const authSecretConfigured = Boolean(process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim());
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
      "nfse-readiness",
      nfse.ready ? "ok" : "warning",
      nfse.ready
        ? "NFS-e Nacional pronta para operacao automatica."
        : `NFS-e Nacional pendente: ${nfse.missing.join(", ") || "revisar configuracao do ambiente"}.`,
    ),
  ];

  return {
    service: "gestao-facil",
    timestamp: new Date().toISOString(),
    requestId,
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
    },
    integrations: {
      asaas: {
        enabled: asaas.enabled,
        environment: asaas.environment,
        webhookConfigured: asaas.webhookConfigured,
        webhookTokenConfigured: asaas.webhookTokenConfigured,
      },
      evolution: {
        enabled: evolution.enabled,
        webhookConfigured: evolution.webhookConfigured,
        defaultInstanceConfigured: Boolean(evolution.instance),
        timeoutMs: evolution.timeoutMs,
      },
      nfse: {
        enabled: nfse.enabled,
        ready: nfse.ready,
        environment: nfse.environment,
        hasCertificate: nfse.hasCertificate,
        certificateSource: nfse.certificateSource,
        missing: nfse.missing,
      },
    },
    checks,
  };
}
