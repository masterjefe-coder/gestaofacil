import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server";
import { GET as getQuotes, POST as postQuotes, quotesRouteDeps } from "@/app/api/quotes/route";
import { REQUEST_ID_HEADER } from "@/lib/request-tracing";

const originalDeps = {
  requireApiModuleAccess: quotesRouteDeps.requireApiModuleAccess,
  listQuotes: quotesRouteDeps.listQuotes,
  createQuote: quotesRouteDeps.createQuote,
};

function restoreQuotesRouteDeps() {
  quotesRouteDeps.requireApiModuleAccess = originalDeps.requireApiModuleAccess;
  quotesRouteDeps.listQuotes = originalDeps.listQuotes;
  quotesRouteDeps.createQuote = originalDeps.createQuote;
}

test("quotes route GET forwards unauthorized response with request id", async () => {
  quotesRouteDeps.requireApiModuleAccess = async () =>
    NextResponse.json({ error: "Sessao invalida ou ausente." }, { status: 401 });

  try {
    const requestId = "quotes-get-unauthorized-request-id";
    const response = await getQuotes(new Request("http://localhost/api/quotes", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error, "Sessao invalida ou ausente.");
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreQuotesRouteDeps();
  }
});

test("quotes route GET lists quotes with request id", async () => {
  quotesRouteDeps.requireApiModuleAccess = async () => null;
  quotesRouteDeps.listQuotes = async () => ([
    {
      id: "quote-1",
      customer: "Cliente A",
      title: "Plano mensal",
      amount: "R$ 1.500",
      status: "Enviado",
      dueLabel: "Hoje",
      summary: "Setup inicial incluso",
    },
  ]);

  try {
    const requestId = "quotes-get-request-id";
    const response = await getQuotes(new Request("http://localhost/api/quotes", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.quotes.length, 1);
    assert.equal(payload.quotes[0]?.title, "Plano mensal");
  } finally {
    restoreQuotesRouteDeps();
  }
});

test("quotes route POST rejects missing required fields", async () => {
  quotesRouteDeps.requireApiModuleAccess = async () => null;

  try {
    const requestId = "quotes-post-invalid-request-id";
    const response = await postQuotes(new Request("http://localhost/api/quotes", {
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
    restoreQuotesRouteDeps();
  }
});

test("quotes route POST creates quote with defaults and request id", async () => {
  quotesRouteDeps.requireApiModuleAccess = async () => null;
  quotesRouteDeps.createQuote = async (input) => ({
    id: "quote-1",
    customer: input.customer,
    title: input.title,
    amount: input.amount,
    status: input.status,
    dueLabel: input.dueLabel,
    summary: input.summary,
  });

  try {
    const requestId = "quotes-post-success-request-id";
    const response = await postQuotes(new Request("http://localhost/api/quotes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({
        customer: "Cliente A",
        title: "Plano mensal",
        amount: "R$ 1.500",
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.quote.status, "Enviado");
    assert.equal(payload.quote.summary, "");
  } finally {
    restoreQuotesRouteDeps();
  }
});

test("quotes route POST rejects invalid status outside the route domain", async () => {
  quotesRouteDeps.requireApiModuleAccess = async () => null;

  try {
    const requestId = "quotes-post-invalid-status-request-id";
    const response = await postQuotes(new Request("http://localhost/api/quotes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({
        customer: "Cliente A",
        title: "Plano mensal",
        amount: "R$ 1.500",
        status: "Rascunho",
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /status/i);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreQuotesRouteDeps();
  }
});
