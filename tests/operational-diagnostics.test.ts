import assert from "node:assert/strict";
import test from "node:test";
import { buildOperationalDiagnosticsSnapshot } from "@/lib/operational-diagnostics";
import { REQUEST_ID_HEADER } from "@/lib/request-tracing";

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
    const snapshot = buildOperationalDiagnosticsSnapshot("warning-request-id");

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
    const snapshot = buildOperationalDiagnosticsSnapshot("ok-request-id");

    assert.equal(snapshot.status, "ok");
    assert.equal(snapshot.summary.warningCount, 0);
    assert.equal(snapshot.summary.okCount, snapshot.checks.length);
    assert.equal(snapshot.runtime.authSecretConfigured, true);
    assert.equal(snapshot.integrations.asaas.webhookConfigured, true);
    assert.equal(snapshot.integrations.evolution.defaultInstanceConfigured, true);
    assert.equal(snapshot.integrations.nfse.ready, true);
  });
});
