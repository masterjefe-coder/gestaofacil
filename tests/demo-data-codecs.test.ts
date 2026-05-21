import test from "node:test";
import assert from "node:assert/strict";
import { buildChargeDueLabel, decodeChargeMeta, encodeChargeMeta, inferPaymentMethod, mapChargeStatus, mapDbChargeStatus } from "@/lib/demo-data-codecs";

test("buildChargeDueLabel prioritizes explicit label", () => {
  assert.equal(buildChargeDueLabel({
    dueLabel: "vence sexta",
    dueDate: "2026-05-21",
    status: "Hoje",
  }), "vence sexta");
});

test("buildChargeDueLabel falls back to today for due today", () => {
  assert.equal(buildChargeDueLabel({
    status: "Hoje",
  }), "vence hoje");
});

test("encodeChargeMeta and decodeChargeMeta preserve external billing and followups", () => {
  const encoded = encodeChargeMeta({
    dueLabel: "vence hoje",
    source: "Pix",
    followUps: [{
      id: "f1",
      createdAt: "2026-05-20T12:00:00.000Z",
      channel: "WhatsApp",
      outcome: "Sem resposta",
      note: "teste",
    }],
    cadence: {
      cadenceLabel: "Cadencia",
      executionLabel: "Executar",
      completedStepLabel: "Feito",
      nextStepLabel: "Proximo",
    },
    externalBilling: {
      provider: "Asaas",
      environment: "production",
      paymentId: "pay_1",
      invoiceUrl: "https://example.com/pay",
    },
    integrationWarning: {
      provider: "Asaas",
      stage: "charge_creation",
      message: "Falha de teste",
      createdAt: "2026-05-20T12:00:00.000Z",
    },
  });

  const decoded = decodeChargeMeta(encoded, {
    dueLabel: "fallback",
    source: "fallback",
  });

  assert.equal(decoded.dueLabel, "vence hoje");
  assert.equal(decoded.followUps.length, 1);
  assert.equal(decoded.externalBilling?.paymentId, "pay_1");
  assert.equal(decoded.integrationWarning?.message, "Falha de teste");
});

test("inferPaymentMethod maps link and boleto correctly", () => {
  assert.equal(inferPaymentMethod("Link de pagamento via pedido"), "Link de pagamento");
  assert.equal(inferPaymentMethod("Boleto manual"), "Boleto");
  assert.equal(inferPaymentMethod("Pix copia e cola"), "Pix");
});

test("charge status mapping preserves overdue charges", () => {
  assert.equal(mapChargeStatus("Vencida"), "OVERDUE");
  assert.equal(mapDbChargeStatus("OVERDUE"), "Vencida");
});
