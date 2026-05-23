import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiInputError,
  parseChargePayload,
  parseCustomerPayload,
  parseOrderPayload,
  parseQuotePayload,
  parseSetupPayload,
} from "@/lib/api-inputs";

test("setup payload trims values and keeps optional fields normalized", () => {
  const payload = parseSetupPayload({
    name: "  Gestao Facil  ",
    slug: "  gestao-facil ",
    tradeName: " GF ",
    document: " 123 ",
    city: " Sao Paulo ",
  });

  assert.equal(payload.name, "Gestao Facil");
  assert.equal(payload.slug, "gestao-facil");
  assert.equal(payload.tradeName, "GF");
  assert.equal(payload.document, "123");
  assert.equal(payload.city, "Sao Paulo");
  assert.equal(payload.niche, "");
});

test("quote payload rejects invalid status outside the real route domain", () => {
  assert.throws(
    () =>
      parseQuotePayload({
        customer: "Cliente A",
        title: "Plano",
        amount: "R$ 1.500",
        status: "Rascunho",
      }),
    (error: unknown) => error instanceof ApiInputError && /status/i.test(error.message),
  );
});

test("customer payload requires non-empty segment and city", () => {
  assert.throws(
    () =>
      parseCustomerPayload({
        name: "Cliente A",
        segment: "   ",
        city: "Sao Paulo",
      }),
    (error: unknown) => error instanceof ApiInputError && /obrigatorios/i.test(error.message),
  );
});

test("order payload discriminates quote creation and status update", () => {
  const fromQuote = parseOrderPayload({ quoteId: " quote-1 " });
  const update = parseOrderPayload({ id: " order-1 ", status: "Concluido", note: " Finalizado " });

  assert.deepEqual(fromQuote, {
    mode: "create-from-quote",
    quoteId: "quote-1",
  });
  assert.deepEqual(update, {
    mode: "update-status",
    id: "order-1",
    status: "Concluido",
    note: "Finalizado",
  });
});

test("charge payload falls back to payment method when source is absent", () => {
  const payload = parseChargePayload({
    customer: "Cliente A",
    amount: "R$ 300",
    paymentMethod: "Boleto",
  });

  assert.deepEqual(payload, {
    mode: "create-manual",
    customer: "Cliente A",
    amount: "R$ 300",
    dueLabel: "",
    dueDate: undefined,
    status: "Pendente",
    source: "Boleto",
  });
});
