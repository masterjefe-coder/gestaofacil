import test from "node:test";
import assert from "node:assert/strict";
import { buildWebhookSummary, computeNextChargeState, computeNextSubscriptionState, parseChargeReference, parseSubscriptionReference } from "@/lib/asaas-webhook";
import type { Charge } from "@/lib/types";

function createCharge(overrides: Partial<Charge> = {}): Charge {
  return {
    id: "charge-1",
    customer: "Maria",
    amount: "R$ 150",
    dueLabel: "vence em 25/05",
    dueDate: "2026-05-25",
    status: "Pendente",
    source: "Pix",
    followUps: [],
    ...overrides,
  };
}

test("parseChargeReference supports local and database references", () => {
  assert.deepEqual(parseChargeReference("gf_charge:local:charge-1"), {
    mode: "local",
    chargeId: "charge-1",
  });

  assert.deepEqual(parseChargeReference("gf_charge:workspace-1:charge-2"), {
    mode: "database",
    workspaceId: "workspace-1",
    chargeId: "charge-2",
  });
});

test("parseSubscriptionReference rejects invalid references", () => {
  assert.equal(parseSubscriptionReference("gf_charge:local:charge-1"), null);
  assert.equal(parseSubscriptionReference("gf_subscription"), null);
  assert.deepEqual(parseSubscriptionReference("gf_subscription:workspace-1:anything"), {
    mode: "database",
    workspaceId: "workspace-1",
  });
});

test("computeNextChargeState marks received payments as paid", () => {
  const nextState = computeNextChargeState(createCharge(), {
    id: "pay_1",
    customer: "cus_1",
    invoiceUrl: "https://example.com/pay",
    paymentDate: "2026-05-21",
  }, "PAYMENT_RECEIVED");

  assert.equal(nextState.status, "Pago");
  assert.equal(nextState.dueLabel, "recebido");
  assert.equal(nextState.paymentLink, "https://example.com/pay");
  assert.equal(nextState.externalBilling?.paymentId, "pay_1");
});

test("computeNextChargeState preserves overdue status and updates due label", () => {
  const nextState = computeNextChargeState(createCharge({
    status: "Hoje",
    dueDate: "2026-05-21",
    dueLabel: "vence hoje",
  }), {
    dueDate: "2026-05-28",
    bankSlipUrl: "https://example.com/boleto",
  }, "PAYMENT_OVERDUE");

  assert.equal(nextState.status, "Vencida");
  assert.equal(nextState.dueLabel, "vence 27/05/2026");
  assert.equal(nextState.paymentLink, "https://example.com/boleto");
});

test("computeNextSubscriptionState updates status and notes from webhook events", () => {
  const overdueState = computeNextSubscriptionState({
    status: "ACTIVE",
    notes: "ok",
  }, {
    subscription: "sub_1",
    bankSlipUrl: "https://example.com/subscription",
  }, "PAYMENT_OVERDUE");

  assert.equal(overdueState.status, "PAST_DUE");
  assert.equal(overdueState.asaasSubscriptionId, "sub_1");
  assert.equal(overdueState.notes, "Assinatura com pagamento pendente segundo o webhook do Asaas.");

  const paidState = computeNextSubscriptionState({
    status: "PAST_DUE",
    notes: "old",
  }, {
    invoiceUrl: "https://example.com/invoice",
  }, "PAYMENT_CONFIRMED");

  assert.equal(paidState.status, "ACTIVE");
  assert.equal(paidState.asaasPaymentLink, "https://example.com/invoice");
  assert.equal(paidState.notes, "Pagamento confirmado pelo webhook do Asaas.");
});

test("buildWebhookSummary describes overdue events clearly", () => {
  assert.equal(
    buildWebhookSummary("PAYMENT_OVERDUE", {
      customer: "Maria",
      amount: "R$ 150",
    }),
    "Asaas marcou a cobranca de R$ 150 para Maria como vencida.",
  );
});
