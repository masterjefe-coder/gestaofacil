import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as getAsaasWebhook, POST as postAsaasWebhook } from "@/app/api/asaas/webhook/route";
import { GET as getEvolutionWebhook, POST as postEvolutionWebhook } from "@/app/api/evolution/webhook/route";

function buildJsonRequest(url: string, headers: Record<string, string>, body?: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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

test("asaas webhook GET reports service health", async () => {
  const response = await getAsaasWebhook();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.status, "ok");
  assert.equal(payload.service, "gestao-facil-asaas-webhook");
});

test("asaas webhook POST returns 503 when auth token is not configured", async () => {
  await withEnv({ ASAAS_WEBHOOK_AUTH_TOKEN: undefined }, async () => {
    const response = await postAsaasWebhook(
      buildJsonRequest("http://localhost/api/asaas/webhook", { "x-forwarded-for": "203.0.113.10" }, { event: "PAYMENT_RECEIVED" }),
    );
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.match(payload.error, /ASAAS_WEBHOOK_AUTH_TOKEN/i);
  });
});

test("asaas webhook POST returns 401 for invalid token", async () => {
  await withEnv({ ASAAS_WEBHOOK_AUTH_TOKEN: "asaas-secret" }, async () => {
    const response = await postAsaasWebhook(
      buildJsonRequest(
        "http://localhost/api/asaas/webhook",
        {
          "asaas-access-token": "wrong-secret",
          "x-forwarded-for": "203.0.113.11",
        },
        { event: "PAYMENT_RECEIVED" },
      ),
    );
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.match(payload.error, /autorizado/i);
  });
});

test("asaas webhook POST rejects expired timestamps before processing", async () => {
  await withEnv({ ASAAS_WEBHOOK_AUTH_TOKEN: "asaas-secret" }, async () => {
    const response = await postAsaasWebhook(
      buildJsonRequest(
        "http://localhost/api/asaas/webhook",
        {
          "asaas-access-token": "asaas-secret",
          "x-forwarded-for": "203.0.113.12",
        },
        { event: "PAYMENT_RECEIVED", date_time: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
      ),
    );
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /timestamp invalido ou expirado/i);
  });
});

test("evolution webhook GET reports service health", async () => {
  const response = await getEvolutionWebhook();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.status, "ok");
  assert.equal(payload.service, "gestao-facil-evolution-webhook");
});

test("evolution webhook POST returns 503 when secret is not configured", async () => {
  await withEnv({ EVOLUTION_WEBHOOK_SECRET: undefined }, async () => {
    const response = await postEvolutionWebhook(
      buildJsonRequest("http://localhost/api/evolution/webhook", { "x-forwarded-for": "203.0.113.20" }, { event: "MESSAGES_UPSERT" }),
    );
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.match(payload.error, /EVOLUTION_WEBHOOK_SECRET/i);
  });
});

test("evolution webhook POST returns 401 for invalid bearer secret", async () => {
  await withEnv({ EVOLUTION_WEBHOOK_SECRET: "evolution-secret" }, async () => {
    const response = await postEvolutionWebhook(
      buildJsonRequest(
        "http://localhost/api/evolution/webhook",
        {
          authorization: "Bearer wrong-secret",
          "x-forwarded-for": "203.0.113.21",
        },
        { event: "MESSAGES_UPSERT" },
      ),
    );
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.match(payload.error, /autorizado/i);
  });
});

test("evolution webhook POST rejects expired timestamps before processing", async () => {
  await withEnv({ EVOLUTION_WEBHOOK_SECRET: "evolution-secret" }, async () => {
    const response = await postEvolutionWebhook(
      buildJsonRequest(
        "http://localhost/api/evolution/webhook",
        {
          authorization: "Bearer evolution-secret",
          "x-forwarded-for": "203.0.113.22",
        },
        { event: "MESSAGES_UPSERT", date_time: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
      ),
    );
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /timestamp invalido ou expirado/i);
  });
});
