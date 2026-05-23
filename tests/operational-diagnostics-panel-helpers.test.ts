import assert from "node:assert/strict";
import test from "node:test";
import {
  getOperationalDiagnosticAction,
  getPrimarySignal,
  getOperationalSignalTone,
  getOperationalSignalToneClass,
  summarizeOperationalSignals,
} from "@/lib/operational-diagnostics-panel-helpers";

test("operational diagnostics panel helper maps checks to actionable destinations", () => {
  assert.deepEqual(getOperationalDiagnosticAction("asaas-webhook"), {
    href: "#integrations-section",
    label: "Ajustar cobrança",
  });
  assert.deepEqual(getOperationalDiagnosticAction("nfse-certificate"), {
    href: "/dashboard/fiscal",
    label: "Abrir fiscal",
  });
  assert.equal(getOperationalDiagnosticAction("unknown-check"), null);
});

test("operational diagnostics panel helper returns the first signal as primary context", () => {
  const signal = getPrimarySignal([
    {
      action: "nfse.updated",
      createdAt: "23/05 10:00",
      summary: "Documento fiscal atualizado para erro.",
    },
    {
      action: "nfse.national.issued",
      createdAt: "23/05 09:00",
      summary: "Documento fiscal emitido com sucesso.",
    },
  ]);

  assert.equal(signal?.action, "nfse.updated");
  assert.equal(signal?.summary, "Documento fiscal atualizado para erro.");
});

test("operational diagnostics panel helper classifies signal tone from action and summary", () => {
  assert.equal(getOperationalSignalTone({
    action: "charge.asaas.failed",
    createdAt: "23/05 10:00",
    summary: "Falha recente na cobranca externa.",
  }), "warning");

  assert.equal(getOperationalSignalTone({
    action: "evolution.instance.disconnected",
    createdAt: "23/05 10:10",
    summary: "Instancia principal perdeu conexao.",
  }), "warning");

  assert.equal(getOperationalSignalTone({
    action: "nfse.national.issued",
    createdAt: "23/05 10:00",
    summary: "Documento fiscal emitido com sucesso.",
  }), "ok");

  assert.equal(getOperationalSignalTone({
    action: "workspace.subscription.checkout_created",
    createdAt: "23/05 10:00",
    summary: "Checkout criado para a assinatura.",
  }), "ok");

  assert.equal(getOperationalSignalTone(undefined), "neutral");
  assert.equal(getOperationalSignalToneClass("ok"), "split-panel success");
  assert.equal(getOperationalSignalToneClass("warning"), "split-panel");
});

test("operational diagnostics panel helper prioritizes warning signal while preserving latest ok recovery", () => {
  const summary = summarizeOperationalSignals([
    {
      action: "workspace.subscription.checkout_synced",
      createdAt: "23/05 11:00",
      summary: "Checkout sincronizado com sucesso.",
    },
    {
      action: "subscription.asaas.payment_overdue",
      createdAt: "23/05 10:00",
      summary: "Pagamento da assinatura entrou em atraso.",
    },
    {
      action: "workspace.subscription.checkout_created",
      createdAt: "23/05 09:00",
      summary: "Checkout criado para a assinatura.",
    },
  ]);

  assert.equal(summary.primary?.action, "subscription.asaas.payment_overdue");
  assert.equal(summary.primaryTone, "warning");
  assert.equal(summary.recovery?.action, "workspace.subscription.checkout_synced");
});
