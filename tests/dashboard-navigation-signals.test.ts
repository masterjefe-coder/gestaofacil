import test from "node:test";
import assert from "node:assert/strict";
import {
  getCurrentDashboardModuleSignal,
  mapOperationalAlertsToNavigationSignals,
} from "@/lib/dashboard-navigation-signals";

test("dashboard navigation signals map operational alerts to modules without duplicates", () => {
  const signals = mapOperationalAlertsToNavigationSignals([
    {
      id: "asaas-webhook-pending",
      tone: "warning",
      title: "Baixa automatica incompleta",
      message: "Webhook pendente.",
    },
    {
      id: "asaas-incident",
      tone: "warning",
      title: "Falha recente na cobranca externa",
      message: "Falha no Asaas.",
    },
    {
      id: "fiscal-not-ready",
      tone: "warning",
      title: "Setup fiscal ainda incompleto",
      message: "Faltam dados.",
    },
  ]);

  assert.deepEqual(signals, [
    {
      href: "/dashboard/billing",
      label: "Cobranca",
      status: "warning",
      targetHref: "/dashboard/billing?focus=triage&view=triage&operationalFocus=recebimentos#recebimentos",
      targetLabel: "Abrir triagem",
    },
    {
      href: "/dashboard/setup",
      label: "Empresa",
      status: "warning",
      targetHref: "/dashboard/setup?operationalFocus=integrations#integrations-section",
      targetLabel: "Abrir integracoes",
    },
    {
      href: "/dashboard/fiscal",
      label: "Fiscal",
      status: "warning",
      targetHref: "/dashboard/fiscal?operationalFocus=documentos#documentos-fiscais",
      targetLabel: "Abrir documentos",
    },
  ]);
});

test("dashboard navigation signals preserve critical severity for setup plan signal", () => {
  const signals = mapOperationalAlertsToNavigationSignals([
    {
      id: "subscription-restricted",
      tone: "critical",
      title: "Assinatura exige atencao",
      message: "Plano em atraso.",
    },
  ]);

  assert.deepEqual(signals, [
    {
      href: "/dashboard/setup",
      label: "Plano",
      status: "critical",
      targetHref: "/dashboard/setup?operationalFocus=subscription#subscription-section",
      targetLabel: "Abrir assinatura",
    },
  ]);
});

test("dashboard navigation signals keep the highest severity per module", () => {
  const signals = mapOperationalAlertsToNavigationSignals([
    {
      id: "asaas-webhook-pending",
      tone: "warning",
      title: "Baixa automatica incompleta",
      message: "Webhook pendente.",
    },
    {
      id: "subscription-restricted",
      tone: "critical",
      title: "Assinatura exige atencao",
      message: "Plano em atraso.",
    },
  ]);

  assert.deepEqual(signals, [
    {
      href: "/dashboard/billing",
      label: "Cobranca",
      status: "warning",
      targetHref: "/dashboard/billing?operationalFocus=recebimentos#recebimentos",
      targetLabel: "Abrir recebimentos",
    },
    {
      href: "/dashboard/setup",
      label: "Plano",
      status: "critical",
      targetHref: "/dashboard/setup?operationalFocus=subscription#subscription-section",
      targetLabel: "Abrir assinatura",
    },
  ]);
});

test("dashboard navigation signals resolve the current focused module by path", () => {
  const signal = getCurrentDashboardModuleSignal("/dashboard/fiscal", [
    {
      href: "/dashboard/fiscal",
      label: "Fiscal",
      status: "critical",
      targetHref: "/dashboard/fiscal?operationalFocus=documentos#documentos-fiscais",
      targetLabel: "Abrir documentos",
    },
    {
      href: "/dashboard/setup",
      label: "Plano",
      status: "warning",
    },
  ]);

  assert.deepEqual(signal, {
    href: "/dashboard/fiscal",
    label: "Fiscal",
    status: "critical",
    targetHref: "/dashboard/fiscal?operationalFocus=documentos#documentos-fiscais",
    targetLabel: "Abrir documentos",
  });
  assert.equal(getCurrentDashboardModuleSignal("/dashboard", [
    {
      href: "/dashboard/fiscal",
      label: "Fiscal",
      status: "critical",
    },
  ]), null);
});
