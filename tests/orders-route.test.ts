import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server";
import { GET as getOrders, POST as postOrders, ordersRouteDeps } from "@/app/api/orders/route";
import { REQUEST_ID_HEADER } from "@/lib/request-tracing";

const originalDeps = {
  requireApiModuleAccess: ordersRouteDeps.requireApiModuleAccess,
  listOrders: ordersRouteDeps.listOrders,
  ensureOrderFromQuote: ordersRouteDeps.ensureOrderFromQuote,
  updateOrderStatus: ordersRouteDeps.updateOrderStatus,
};

function restoreOrdersRouteDeps() {
  ordersRouteDeps.requireApiModuleAccess = originalDeps.requireApiModuleAccess;
  ordersRouteDeps.listOrders = originalDeps.listOrders;
  ordersRouteDeps.ensureOrderFromQuote = originalDeps.ensureOrderFromQuote;
  ordersRouteDeps.updateOrderStatus = originalDeps.updateOrderStatus;
}

test("orders route GET forwards unauthorized response with request id", async () => {
  ordersRouteDeps.requireApiModuleAccess = async () =>
    NextResponse.json({ error: "Sessao invalida ou ausente." }, { status: 401 });

  try {
    const requestId = "orders-get-unauthorized-request-id";
    const response = await getOrders(new Request("http://localhost/api/orders", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error, "Sessao invalida ou ausente.");
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreOrdersRouteDeps();
  }
});

test("orders route GET lists orders with request id", async () => {
  ordersRouteDeps.requireApiModuleAccess = async () => null;
  ordersRouteDeps.listOrders = async () => ([
    {
      id: "order-1",
      customer: "Cliente A",
      title: "Projeto mensal",
      amount: "R$ 2.500",
      status: "Pendente",
      sourceQuoteId: "quote-1",
      note: "",
    },
  ]);

  try {
    const requestId = "orders-get-request-id";
    const response = await getOrders(new Request("http://localhost/api/orders", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.orders.length, 1);
    assert.equal(payload.orders[0]?.id, "order-1");
  } finally {
    restoreOrdersRouteDeps();
  }
});

test("orders route POST returns 404 when quote is missing", async () => {
  ordersRouteDeps.requireApiModuleAccess = async () => null;
  ordersRouteDeps.ensureOrderFromQuote = async () => null;

  try {
    const requestId = "orders-post-quote-not-found-request-id";
    const response = await postOrders(new Request("http://localhost/api/orders", {
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
    restoreOrdersRouteDeps();
  }
});

test("orders route POST creates order from quote with request id", async () => {
  ordersRouteDeps.requireApiModuleAccess = async () => null;
  ordersRouteDeps.ensureOrderFromQuote = async () => ({
    id: "order-1",
    customer: "Cliente A",
    title: "Projeto mensal",
    amount: "R$ 2.500",
    status: "Pendente",
    sourceQuoteId: "quote-1",
    note: "",
  });

  try {
    const requestId = "orders-post-create-request-id";
    const response = await postOrders(new Request("http://localhost/api/orders", {
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
    assert.equal(payload.order.sourceQuoteId, "quote-1");
  } finally {
    restoreOrdersRouteDeps();
  }
});

test("orders route POST rejects update without required fields", async () => {
  ordersRouteDeps.requireApiModuleAccess = async () => null;

  try {
    const requestId = "orders-post-invalid-update-request-id";
    const response = await postOrders(new Request("http://localhost/api/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({
        id: "order-1",
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /obrigatorios ausentes/i);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreOrdersRouteDeps();
  }
});

test("orders route POST returns 404 when update target is missing", async () => {
  ordersRouteDeps.requireApiModuleAccess = async () => null;
  ordersRouteDeps.updateOrderStatus = async () => null;

  try {
    const requestId = "orders-post-update-not-found-request-id";
    const response = await postOrders(new Request("http://localhost/api/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({
        id: "order-missing",
        status: "Concluido",
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.match(payload.error, /pedido nao encontrado/i);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreOrdersRouteDeps();
  }
});

test("orders route POST updates order status with request id", async () => {
  ordersRouteDeps.requireApiModuleAccess = async () => null;
  ordersRouteDeps.updateOrderStatus = async (id, input) => ({
    id,
    customer: "Cliente A",
    title: "Projeto mensal",
    amount: "R$ 2.500",
    status: input.status,
    sourceQuoteId: "quote-1",
    note: input.note || "",
  });

  try {
    const requestId = "orders-post-update-request-id";
    const response = await postOrders(new Request("http://localhost/api/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({
        id: "order-1",
        status: "Concluido",
        note: "Finalizado",
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.order.status, "Concluido");
    assert.equal(payload.order.note, "Finalizado");
  } finally {
    restoreOrdersRouteDeps();
  }
});
