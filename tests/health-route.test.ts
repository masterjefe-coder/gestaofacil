import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as getHealth } from "@/app/api/health/route";
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

test("health route serves public status without diagnostics by default", async () => {
  const response = await getHealth(new NextRequest("http://localhost/api/health"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.status, "ok");
  assert.equal(payload.service, "gestao-facil");
  assert.equal("runtime" in payload, false);
  assert.ok(response.headers.get(REQUEST_ID_HEADER));
});

test("health route serves detailed diagnostics for valid health token", async () => {
  await withEnv({
    GESTAO_FACIL_DATA_MODE: "database",
    DATABASE_URL: "file:./test.db",
    APP_BASE_URL: "https://gestaofacil.app",
    HEALTHCHECK_TOKEN: "health-secret",
    ASAAS_API_KEY: "asaas-key",
    ASAAS_WEBHOOK_AUTH_TOKEN: "asaas-webhook-secret",
    EVOLUTION_API_BASE_URL: "https://evolution.example.com",
    EVOLUTION_API_KEY: "evolution-key",
    EVOLUTION_WEBHOOK_URL: "https://gestaofacil.app/api/evolution/webhook",
    EVOLUTION_WEBHOOK_SECRET: "evolution-secret",
    NFSE_NATIONAL_ENABLED: "true",
    NFSE_NATIONAL_SERIES: "A1",
    NFSE_NATIONAL_CERT_PFX_BASE64: "ZmFrZQ==",
    NFSE_NATIONAL_CERT_PASSPHRASE: "cert-secret",
  }, async () => {
    const requestId = "health-request-id";
    const response = await getHealth(new NextRequest("http://localhost/api/health", {
      headers: {
        "x-health-token": "health-secret",
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.runtime.mode, "database");
    assert.equal(payload.runtime.databaseConfigured, true);
    assert.equal(payload.integrations.asaas.enabled, true);
    assert.equal(payload.integrations.evolution.enabled, true);
    assert.equal(payload.integrations.nfse.ready, true);
  });
});
