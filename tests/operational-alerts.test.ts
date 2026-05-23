import test from "node:test";
import assert from "node:assert/strict";
import { buildOperationalAlerts, getPrimaryOperationalAlert } from "@/lib/operational-alerts";

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
  assert.equal(
    alerts[0]?.href,
    "/dashboard/setup?subscriptionIntent=1&operationalFocus=subscription#subscription-section",
  );
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
  assert.equal(alerts[0]?.href, "/dashboard/billing?operationalFocus=recebimentos#recebimentos");
  assert.equal(
    alerts[1]?.href,
    "/dashboard/billing?focus=triage&view=triage&operationalFocus=recebimentos#recebimentos",
  );
  assert.equal(
    alerts[2]?.href,
    "/dashboard/setup?operationalFocus=integrations#integrations-section",
  );
  assert.equal(
    alerts[3]?.href,
    "/dashboard/fiscal?focus=blocked&operationalFocus=documentos#documentos-fiscais",
  );
});

test("buildOperationalAlerts carries recovery context from recent healthy signals", () => {
  const alerts = buildOperationalAlerts({
    subscriptionStatus: "ACTIVE",
    asaasWebhookConfigured: true,
    asaasConnectionMode: "workspace",
    evolutionEnabled: true,
    evolutionReachable: false,
    evolutionSummary: "timeout",
    fiscalReady: true,
    fiscalHelper: "ok",
    incidents: [],
    evolutionEntries: [
      {
        id: "audit-1",
        action: "evolution.instance.disconnected",
        entityType: "evolution",
        entityId: "instance-1",
        actorName: "Sistema",
        actorEmail: "sistema@workspace.local",
        createdAt: "23 mai, 10:00",
        summary: "Instancia principal perdeu conexao.",
      },
      {
        id: "audit-2",
        action: "evolution.messages_upsert",
        entityType: "evolution",
        entityId: "instance-1",
        actorName: "Sistema",
        actorEmail: "sistema@workspace.local",
        createdAt: "23 mai, 09:20",
        summary: "Mensagens voltaram a entrar.",
      },
    ],
  });

  assert.equal(alerts[0]?.id, "evolution-unreachable");
  assert.equal(alerts[0]?.recoveryMessage, "Mensagens voltaram a entrar.");
  assert.equal(alerts[0]?.recoveryAt, "23 mai, 09:20");
});

test("getPrimaryOperationalAlert promotes the first operational alert", () => {
  const primary = getPrimaryOperationalAlert([
    {
      id: "evolution-unreachable",
      tone: "warning",
      title: "WhatsApp com conectividade instável",
      message: "timeout",
    },
    {
      id: "fiscal-not-ready",
      tone: "warning",
      title: "Setup fiscal ainda incompleto",
      message: "faltam dados",
    },
  ]);

  assert.equal(primary?.id, "evolution-unreachable");
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
