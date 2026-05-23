import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server";
import { GET as getCharges, POST as postCharges, chargesRouteDeps } from "@/app/api/charges/route";
import { REQUEST_ID_HEADER } from "@/lib/request-tracing";

const originalDeps = {
  requireApiModuleAccess: chargesRouteDeps.requireApiModuleAccess,
  listCharges: chargesRouteDeps.listCharges,
  createChargeFromQuote: chargesRouteDeps.createChargeFromQuote,
  createCharge: chargesRouteDeps.createCharge,
};

function restoreChargesRouteDeps() {
  chargesRouteDeps.requireApiModuleAccess = originalDeps.requireApiModuleAccess;
  chargesRouteDeps.listCharges = originalDeps.listCharges;
  chargesRouteDeps.createChargeFromQuote = originalDeps.createChargeFromQuote;
  chargesRouteDeps.createCharge = originalDeps.createCharge;
}

test("charges route GET forwards unauthorized response with request id", async () => {
  chargesRouteDeps.requireApiModuleAccess = async () =>
    NextResponse.json({ error: "Sessao invalida ou ausente." }, { status: 401 });

  try {
    const requestId = "charges-get-unauthorized-request-id";
    const response = await getCharges(new Request("http://localhost/api/charges", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error, "Sessao invalida ou ausente.");
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreChargesRouteDeps();
  }
});

test("charges route GET lists charges with request id", async () => {
  chargesRouteDeps.requireApiModuleAccess = async () => null;
  chargesRouteDeps.listCharges = async () => ([
    {
      id: "charge-1",
      customer: "Cliente A",
      amount: "R$ 1.200",
      dueLabel: "Hoje",
      dueDate: "2026-05-23",
      status: "Pendente",
      source: "Pix",
      paymentLink: undefined,
      followUps: [],
    },
  ]);

  try {
    const requestId = "charges-get-request-id";
    const response = await getCharges(new Request("http://localhost/api/charges", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.charges.length, 1);
    assert.equal(payload.charges[0]?.id, "charge-1");
  } finally {
    restoreChargesRouteDeps();
  }
});

test("charges route POST returns 404 when quote is missing", async () => {
  chargesRouteDeps.requireApiModuleAccess = async () => null;
  chargesRouteDeps.createChargeFromQuote = async () => null;

  try {
    const requestId = "charges-post-quote-not-found-request-id";
    const response = await postCharges(new Request("http://localhost/api/charges", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({
        quoteId: "quote-missing",
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.match(payload.error, /orcamento nao encontrado/i);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreChargesRouteDeps();
  }
});

test("charges route POST creates charge from quote with request id", async () => {
  chargesRouteDeps.requireApiModuleAccess = async () => null;
  chargesRouteDeps.createChargeFromQuote = async () => ({
    id: "charge-1",
    customer: "Cliente A",
    amount: "R$ 1.200",
    dueLabel: "Hoje",
    dueDate: "2026-05-23",
    status: "Pendente",
    source: "Pix",
    paymentLink: "https://pay.example.com/charge-1",
    followUps: [],
  });

  try {
    const requestId = "charges-post-create-from-quote-request-id";
    const response = await postCharges(new Request("http://localhost/api/charges", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({
        quoteId: "quote-1",
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.charge.paymentLink, "https://pay.example.com/charge-1");
  } finally {
    restoreChargesRouteDeps();
  }
});

test("charges route POST rejects manual creation without required fields", async () => {
  chargesRouteDeps.requireApiModuleAccess = async () => null;

  try {
    const requestId = "charges-post-invalid-request-id";
    const response = await postCharges(new Request("http://localhost/api/charges", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({
        customer: "Cliente A",
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /obrigatorios ausentes/i);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreChargesRouteDeps();
  }
});

test("charges route POST creates manual charge with defaults and request id", async () => {
  chargesRouteDeps.requireApiModuleAccess = async () => null;
  chargesRouteDeps.createCharge = async (input) => ({
    id: "charge-1",
    customer: input.customer,
    amount: input.amount,
    dueLabel: input.dueLabel,
    dueDate: input.dueDate,
    status: input.status,
    source: input.source,
    paymentLink: undefined,
    followUps: [],
  });

  try {
    const requestId = "charges-post-manual-request-id";
    const response = await postCharges(new Request("http://localhost/api/charges", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({
        customer: "Cliente A",
        amount: "R$ 1.200",
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.charge.status, "Pendente");
    assert.equal(payload.charge.source, "Pix");
  } finally {
    restoreChargesRouteDeps();
  }
});
