import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as getDiagnostics } from "@/app/api/diagnostics/route";
import { operationalDiagnosticsDeps } from "@/lib/operational-diagnostics";
import { REQUEST_ID_HEADER } from "@/lib/request-tracing";

const originalDiagnosticsDeps = {
  inspectNfseNationalCertificate: operationalDiagnosticsDeps.inspectNfseNationalCertificate,
  probeEvolutionApi: operationalDiagnosticsDeps.probeEvolutionApi,
};

function restoreOperationalDiagnosticsDeps() {
  operationalDiagnosticsDeps.inspectNfseNationalCertificate = originalDiagnosticsDeps.inspectNfseNationalCertificate;
  operationalDiagnosticsDeps.probeEvolutionApi = originalDiagnosticsDeps.probeEvolutionApi;
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

test("diagnostics route rejects unauthenticated requests without health token", async () => {
  restoreOperationalDiagnosticsDeps();
  await withEnv({ HEALTHCHECK_TOKEN: "health-secret" }, async () => {
    const response = await getDiagnostics(new NextRequest("http://localhost/api/diagnostics"));
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.match(payload.error, /nao autorizado/i);
    assert.ok(response.headers.get(REQUEST_ID_HEADER));
  });
});

test("diagnostics route returns operational snapshot for valid health token", async () => {
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
  await withEnv({
    NODE_ENV: "production",
    HEALTHCHECK_TOKEN: "health-secret",
    APP_BASE_URL: "https://gestaofacil.app",
    AUTH_SECRET: "auth-secret",
    DATABASE_URL: "file:./test.db",
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
    const requestId = "diagnostics-request-id";
    const response = await getDiagnostics(new NextRequest("http://localhost/api/diagnostics", {
      headers: {
        "x-health-token": "health-secret",
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.requestId, requestId);
    assert.equal(payload.requestTracing.header, REQUEST_ID_HEADER);
    assert.equal(payload.runtime.mode, "database");
    assert.equal(payload.runtime.appBaseUrlConfigured, true);
    assert.equal(payload.integrations.asaas.webhookConfigured, true);
    assert.equal(payload.integrations.evolution.defaultInstanceConfigured, true);
    assert.equal(payload.integrations.evolution.connectivity.reachable, true);
    assert.equal(payload.integrations.nfse.ready, true);
    assert.equal(payload.integrations.nfse.certificateInspection.ok, true);
    assert.equal(payload.resilience.openCircuitBreakerCount, 0);
    assert.equal(
      payload.checks.some((check: { key: string; level: string }) => check.key === "auth-secrets" && check.level === "ok"),
      true,
    );
  });
  restoreOperationalDiagnosticsDeps();
});
