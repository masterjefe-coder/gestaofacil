import test from "node:test";
import assert from "node:assert/strict";
import { buildOperationalAlerts } from "@/lib/operational-alerts";

test("buildOperationalAlerts emits critical subscription alert first", () => {
  const alerts = buildOperationalAlerts({
    subscriptionStatus: "PAST_DUE",
    asaasWebhookConfigured: true,
    asaasConnectionMode: "workspace",
    evolutionEnabled: true,
    evolutionReachable: true,
    evolutionSummary: "ok",
    fiscalReady: true,
    fiscalHelper: "ok",
    incidents: [],
  });

  assert.equal(alerts[0]?.id, "subscription-restricted");
  assert.equal(alerts[0]?.tone, "critical");
});

test("buildOperationalAlerts includes webhook, incident, channel and fiscal warnings", () => {
  const alerts = buildOperationalAlerts({
    subscriptionStatus: "ACTIVE",
    asaasWebhookConfigured: false,
    asaasConnectionMode: "workspace",
    evolutionEnabled: true,
    evolutionReachable: false,
    evolutionSummary: "timeout",
    fiscalReady: false,
    fiscalHelper: "faltam dados fiscais",
    incidents: [{
      id: "audit-1",
      action: "charge.asaas.failed",
      entityType: "charge",
      entityId: "charge-1",
      actorName: "Sistema",
      actorEmail: "sistema@workspace.local",
      createdAt: "21 mai, 10:00",
      summary: "Falha no Asaas para uma cobrança externa.",
    }],
  });

  assert.deepEqual(alerts.map((alert) => alert.id), [
    "asaas-webhook-pending",
    "asaas-incident",
    "evolution-unreachable",
    "fiscal-not-ready",
  ]);
});

test("buildOperationalAlerts limits output to four items", () => {
  const alerts = buildOperationalAlerts({
    subscriptionStatus: "CANCELED",
    asaasWebhookConfigured: false,
    asaasConnectionMode: "workspace",
    evolutionEnabled: true,
    evolutionReachable: false,
    evolutionSummary: "offline",
    fiscalReady: false,
    fiscalHelper: "faltam dados",
    incidents: [{
      id: "audit-1",
      action: "charge.asaas.failed",
      entityType: "charge",
      entityId: "charge-1",
      actorName: "Sistema",
      actorEmail: "sistema@workspace.local",
      createdAt: "21 mai, 10:00",
      summary: "Falha no Asaas para uma cobrança externa.",
    }],
  });

  assert.equal(alerts.length, 4);
});
