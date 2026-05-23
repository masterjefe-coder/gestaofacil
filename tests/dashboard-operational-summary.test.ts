import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardOperationalSummary } from "@/components/dashboard-operational-summary";
import type { OperationalDiagnosticsSnapshot } from "@/lib/operational-diagnostics";
import type { OperationalDiagnosticsDomainSummary } from "@/lib/operational-diagnostics-panel-helpers";

function buildSnapshot(
  overrides: Partial<OperationalDiagnosticsSnapshot> = {},
): OperationalDiagnosticsSnapshot {
  return {
    service: "gestao-facil",
    timestamp: "2026-05-23T10:00:00.000Z",
    requestId: "dashboard-home",
    status: "warning",
    summary: {
      okCount: 7,
      warningCount: 2,
    },
    requestTracing: {
      header: "x-request-id",
      enabled: true,
    },
    runtime: {
      mode: "database",
      nodeEnv: "test",
      databaseConfigured: true,
      appBaseUrlConfigured: true,
      healthTokenConfigured: true,
      authSecretConfigured: true,
    },
    integrations: {
      asaas: {
        enabled: true,
        environment: "sandbox",
        webhookConfigured: false,
        webhookTokenConfigured: true,
        helper: "Webhook ainda incompleto.",
      },
      evolution: {
        enabled: true,
        webhookConfigured: true,
        defaultInstanceConfigured: true,
        timeoutMs: 8000,
        helper: "Instancia principal conectada.",
        connectivity: {
          configured: true,
          reachable: false,
          summary: "Evolution sem resposta no momento.",
        },
      },
      nfse: {
        enabled: true,
        ready: false,
        environment: "homologacao",
        hasCertificate: true,
        certificateSource: "path",
        missing: ["cnae"],
        helper: "Ainda faltam dados fiscais.",
        certificateInspection: {
          ok: false,
          error: "Certificado invalido.",
        },
      },
    },
    resilience: {
      openCircuitBreakerCount: 1,
      halfOpenCircuitBreakerCount: 0,
      circuitBreakers: {},
    },
    checks: [
      {
        key: "evolution-connectivity",
        level: "warning",
        summary: "Evolution sem resposta no momento.",
      },
      {
        key: "asaas-webhook",
        level: "warning",
        summary: "Webhook ainda incompleto.",
      },
    ],
    ...overrides,
  };
}

function buildSignals(
  overrides: Partial<Record<"evolution" | "asaas" | "fiscal" | "subscription", OperationalDiagnosticsDomainSummary>> = {},
): {
  evolution: OperationalDiagnosticsDomainSummary;
  asaas: OperationalDiagnosticsDomainSummary;
  fiscal: OperationalDiagnosticsDomainSummary;
  subscription: OperationalDiagnosticsDomainSummary;
} {
  return {
    evolution: {
      primary: {
        action: "evolution.instance.disconnected",
        createdAt: "23 mai, 09:50",
        summary: "Instancia principal perdeu conexao.",
      },
      primaryTone: "warning",
      recovery: {
        action: "evolution.messages_upsert",
        createdAt: "23 mai, 09:20",
        summary: "Mensagens voltaram a entrar.",
      },
    },
    asaas: {
      primaryTone: "neutral",
    },
    fiscal: {
      primaryTone: "neutral",
    },
    subscription: {
      primaryTone: "neutral",
    },
    ...overrides,
  };
}

test("dashboard operational summary highlights warning count and recovery context", () => {
  const html = renderToStaticMarkup(
    createElement(DashboardOperationalSummary, {
      snapshot: buildSnapshot(),
      signals: buildSignals(),
    }),
  );

  assert.match(html, /2 frentes em atencao/);
  assert.match(html, /Instancia principal perdeu conexao\./);
  assert.match(html, /Ultimo ok: 23 mai, 09:20/);
  assert.match(html, /Ajustar cobran/);
});

test("dashboard operational summary falls back to setup links when there are no warnings", () => {
  const html = renderToStaticMarkup(
    createElement(DashboardOperationalSummary, {
      snapshot: buildSnapshot({
        status: "ok",
        summary: {
          okCount: 10,
          warningCount: 0,
        },
        checks: [],
      }),
      signals: buildSignals(),
    }),
  );

  assert.match(html, /Operacao estavel/);
  assert.match(html, /Abrir empresa/);
  assert.match(html, /Abrir diagnostico/);
});
