import assert from "node:assert/strict";
import test from "node:test";
import { resetAllCircuitBreakerStates, withRetryAndCircuitBreaker } from "@/lib/api-retry";
import {
  buildOperationalDiagnosticsSnapshot,
  operationalDiagnosticsDeps,
} from "@/lib/operational-diagnostics";
import { REQUEST_ID_HEADER } from "@/lib/request-tracing";

const originalDiagnosticsDeps = {
  inspectNfseNationalCertificate: operationalDiagnosticsDeps.inspectNfseNationalCertificate,
  probeEvolutionApi: operationalDiagnosticsDeps.probeEvolutionApi,
  listBackgroundJobStats: operationalDiagnosticsDeps.listBackgroundJobStats,
  getRateLimiterStats: operationalDiagnosticsDeps.getRateLimiterStats,
};

function restoreOperationalDiagnosticsDeps() {
  operationalDiagnosticsDeps.inspectNfseNationalCertificate = originalDiagnosticsDeps.inspectNfseNationalCertificate;
  operationalDiagnosticsDeps.probeEvolutionApi = originalDiagnosticsDeps.probeEvolutionApi;
  operationalDiagnosticsDeps.listBackgroundJobStats = originalDiagnosticsDeps.listBackgroundJobStats;
  operationalDiagnosticsDeps.getRateLimiterStats = originalDiagnosticsDeps.getRateLimiterStats;
}

async function withEnv<T>(entries: Record<string, string | undefined>, fn: () => Promise<T>) {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(entries)) {
    previous.set(key, process.env[key]);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("operational diagnostics snapshot reports warnings when key env vars are missing", async () => {
  resetAllCircuitBreakerStates();
  restoreOperationalDiagnosticsDeps();
  operationalDiagnosticsDeps.listBackgroundJobStats = async () => ({
    pendingCount: 0,
    runningCount: 0,
    failedCount: 0,
    completedCount: 0,
  });
  operationalDiagnosticsDeps.getRateLimiterStats = () => ({
    mode: "local",
    auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
    api: { windowMs: 60 * 1000, maxRequests: 60 },
    webhook: { windowMs: 60 * 1000, maxRequests: 100 },
    passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 3 },
    general: { windowMs: 60 * 1000, maxRequests: 100 },
  });
  await withEnv({
    NODE_ENV: "production",
    DATABASE_URL: undefined,
    APP_BASE_URL: undefined,
    AUTH_SECRET: undefined,
    NEXTAUTH_SECRET: undefined,
    HEALTHCHECK_TOKEN: undefined,
    ASAAS_API_KEY: undefined,
    ASAAS_WEBHOOK_AUTH_TOKEN: undefined,
    EVOLUTION_API_BASE_URL: undefined,
    EVOLUTION_API_KEY: undefined,
    EVOLUTION_WEBHOOK_URL: undefined,
    EVOLUTION_WEBHOOK_SECRET: undefined,
    NFSE_NATIONAL_ENABLED: undefined,
    NFSE_NATIONAL_SERIES: undefined,
    NFSE_NATIONAL_CERT_PFX_BASE64: undefined,
    NFSE_NATIONAL_CERT_PFX_PATH: undefined,
    NFSE_NATIONAL_CERT_PASSPHRASE: undefined,
  }, async () => {
    const snapshot = await buildOperationalDiagnosticsSnapshot("warning-request-id");

    assert.equal(snapshot.requestId, "warning-request-id");
    assert.equal(snapshot.requestTracing.header, REQUEST_ID_HEADER);
    assert.equal(snapshot.status, "warning");
    assert.equal(snapshot.summary.warningCount > 0, true);
    assert.equal(snapshot.summary.okCount + snapshot.summary.warningCount, snapshot.checks.length);
    assert.equal(
      snapshot.checks.some((check) => check.key === "app-base-url" && check.level === "warning"),
      true,
    );
  });
});

test("operational diagnostics snapshot reports ok when runtime and integrations are configured", async () => {
  resetAllCircuitBreakerStates();
  operationalDiagnosticsDeps.probeEvolutionApi = async () => ({
    configured: true,
    reachable: true,
    summary: "Endpoint respondeu e a API está acessível a partir do app.",
  });
  operationalDiagnosticsDeps.inspectNfseNationalCertificate = async () => ({
    ok: true,
    subject: "CN=Gestao Facil",
    issuer: "CN=Fake CA",
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: "2027-01-01T00:00:00.000Z",
    hasPrivateKey: true,
  });
  operationalDiagnosticsDeps.listBackgroundJobStats = async () => ({
    pendingCount: 2,
    runningCount: 1,
    failedCount: 0,
    completedCount: 4,
  });
  operationalDiagnosticsDeps.getRateLimiterStats = () => ({
    mode: "distributed",
    auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
    api: { windowMs: 60 * 1000, maxRequests: 60 },
    webhook: { windowMs: 60 * 1000, maxRequests: 100 },
    passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 3 },
    general: { windowMs: 60 * 1000, maxRequests: 100 },
  });
  await withEnv({
    NODE_ENV: "production",
    DATABASE_URL: "file:./test.db",
    APP_BASE_URL: "https://gestaofacil.app",
    AUTH_SECRET: "auth-secret",
    HEALTHCHECK_TOKEN: "health-secret",
    ASAAS_API_KEY: "asaas-key",
    ASAAS_WEBHOOK_AUTH_TOKEN: "asaas-webhook-secret",
    EVOLUTION_API_BASE_URL: "https://evolution.example.com",
    EVOLUTION_API_KEY: "evolution-key",
    EVOLUTION_API_INSTANCE: "gf-main",
    EVOLUTION_WEBHOOK_URL: "https://gestaofacil.app/api/evolution/webhook",
    EVOLUTION_WEBHOOK_SECRET: "evolution-secret",
    NFSE_NATIONAL_ENABLED: "true",
    NFSE_NATIONAL_SERIES: "A1",
    NFSE_NATIONAL_CERT_PFX_BASE64: "ZmFrZQ==",
    NFSE_NATIONAL_CERT_PASSPHRASE: "cert-secret",
  }, async () => {
    await withRetryAndCircuitBreaker(
      "asaas-api",
      async () => ({ ok: true }),
      {
        maxAttempts: 1,
      },
      {
        failureThreshold: 5,
        resetTimeoutMs: 60000,
      },
    );

    const snapshot = await buildOperationalDiagnosticsSnapshot("ok-request-id");

    assert.equal(snapshot.status, "ok");
    assert.equal(snapshot.summary.warningCount, 0);
    assert.equal(snapshot.summary.okCount, snapshot.checks.length);
    assert.equal(snapshot.runtime.authSecretConfigured, true);
    assert.equal(snapshot.integrations.asaas.webhookConfigured, true);
    assert.equal(snapshot.integrations.evolution.defaultInstanceConfigured, true);
    assert.equal(snapshot.integrations.evolution.connectivity.reachable, true);
    assert.equal(snapshot.integrations.nfse.ready, true);
    assert.equal(snapshot.integrations.nfse.certificateInspection.ok, true);
    assert.equal(snapshot.resilience.openCircuitBreakerCount, 0);
    assert.equal(snapshot.resilience.providers["asaas-api"]?.successCount, 1);
    assert.equal(snapshot.runtime.rateLimitMode, "distributed");
    assert.equal(snapshot.resilience.jobs.pendingCount, 2);
    assert.equal(snapshot.checks.some((check) => check.key === "api-resilience" && check.level === "ok"), true);
    assert.equal(snapshot.checks.some((check) => check.key === "provider-telemetry" && check.level === "ok"), true);
    assert.equal(snapshot.checks.some((check) => check.key === "background-jobs" && check.level === "ok"), true);
  });
  restoreOperationalDiagnosticsDeps();
});

test("operational diagnostics snapshot reports open circuit breakers as warnings", async () => {
  resetAllCircuitBreakerStates();
  operationalDiagnosticsDeps.probeEvolutionApi = async () => ({
    configured: false,
    reachable: false,
    summary: "Integração ainda não configurada neste ambiente.",
  });
  operationalDiagnosticsDeps.inspectNfseNationalCertificate = async () => ({
    ok: false,
    error: "Certificado ausente.",
  });
  operationalDiagnosticsDeps.listBackgroundJobStats = async () => ({
    pendingCount: 0,
    runningCount: 0,
    failedCount: 1,
    completedCount: 0,
  });
  operationalDiagnosticsDeps.getRateLimiterStats = () => ({
    mode: "local",
    auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
    api: { windowMs: 60 * 1000, maxRequests: 60 },
    webhook: { windowMs: 60 * 1000, maxRequests: 100 },
    passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 3 },
    general: { windowMs: 60 * 1000, maxRequests: 100 },
  });

  try {
    await withRetryAndCircuitBreaker(
      "diagnostics-test-breaker",
      async () => {
        throw new Error("upstream failed");
      },
      {
        maxAttempts: 1,
      },
      {
        failureThreshold: 1,
        resetTimeoutMs: 60000,
      },
    );
  } catch {
    // Intentionally ignored so we can inspect the breaker state in diagnostics.
  }

  const snapshot = await buildOperationalDiagnosticsSnapshot("breaker-request-id");

  assert.equal(snapshot.resilience.openCircuitBreakerCount, 1);
  assert.equal(snapshot.resilience.circuitBreakers["diagnostics-test-breaker"]?.state, "OPEN");
  assert.equal(snapshot.resilience.providers["diagnostics-test-breaker"]?.failureCount, 1);
  assert.equal(snapshot.checks.some((check) => check.key === "api-resilience" && check.level === "warning"), true);
  assert.equal(snapshot.checks.some((check) => check.key === "provider-telemetry" && check.level === "warning"), true);
  assert.equal(snapshot.checks.some((check) => check.key === "background-jobs" && check.level === "warning"), true);

  resetAllCircuitBreakerStates();
  restoreOperationalDiagnosticsDeps();
});
