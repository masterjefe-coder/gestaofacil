import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server";
import { GET as getCustomers, POST as postCustomers, customersRouteDeps } from "@/app/api/customers/route";
import { REQUEST_ID_HEADER } from "@/lib/request-tracing";

const originalDeps = {
  requireApiModuleAccess: customersRouteDeps.requireApiModuleAccess,
  listCustomers: customersRouteDeps.listCustomers,
  createCustomer: customersRouteDeps.createCustomer,
};

function restoreCustomersRouteDeps() {
  customersRouteDeps.requireApiModuleAccess = originalDeps.requireApiModuleAccess;
  customersRouteDeps.listCustomers = originalDeps.listCustomers;
  customersRouteDeps.createCustomer = originalDeps.createCustomer;
}

test("customers route GET forwards unauthorized response with request id", async () => {
  customersRouteDeps.requireApiModuleAccess = async () =>
    NextResponse.json({ error: "Sessao invalida ou ausente." }, { status: 401 });

  try {
    const requestId = "customers-get-unauthorized-request-id";
    const response = await getCustomers(new Request("http://localhost/api/customers", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error, "Sessao invalida ou ausente.");
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreCustomersRouteDeps();
  }
});

test("customers route GET lists customers with request id", async () => {
  customersRouteDeps.requireApiModuleAccess = async () => null;
  customersRouteDeps.listCustomers = async () => ([
    {
      id: "customer-1",
      name: "Cliente A",
      phone: "5511999999999",
      document: "12345678900",
      segment: "Clinica",
      city: "Sao Paulo",
      status: "Ativo",
      lastSale: "2026-05-20",
      openAmount: "R$ 0",
      note: "Cliente recorrente",
    },
  ]);

  try {
    const requestId = "customers-get-request-id";
    const response = await getCustomers(new Request("http://localhost/api/customers", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.customers.length, 1);
    assert.equal(payload.customers[0]?.name, "Cliente A");
  } finally {
    restoreCustomersRouteDeps();
  }
});

test("customers route POST rejects missing required fields", async () => {
  customersRouteDeps.requireApiModuleAccess = async () => null;

  try {
    const requestId = "customers-post-invalid-request-id";
    const response = await postCustomers(new Request("http://localhost/api/customers", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({
        name: "Cliente A",
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /obrigatorios ausentes/i);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreCustomersRouteDeps();
  }
});

test("customers route POST creates customer with defaults and request id", async () => {
  customersRouteDeps.requireApiModuleAccess = async () => null;
  customersRouteDeps.createCustomer = async (input) => ({
    id: "customer-1",
    name: input.name,
    phone: input.phone,
    document: input.document,
    segment: input.segment,
    city: input.city,
    status: input.status,
    lastSale: "2026-05-23",
    openAmount: "R$ 0",
    note: input.note,
  });

  try {
    const requestId = "customers-post-success-request-id";
    const response = await postCustomers(new Request("http://localhost/api/customers", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({
        name: "Cliente A",
        segment: "Clinica",
        city: "Sao Paulo",
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.customer.status, "Ativo");
    assert.equal(payload.customer.note, "");
  } finally {
    restoreCustomersRouteDeps();
  }
});

test("customers route POST rejects blank required values after normalization", async () => {
  customersRouteDeps.requireApiModuleAccess = async () => null;

  try {
    const requestId = "customers-post-blank-required-request-id";
    const response = await postCustomers(new Request("http://localhost/api/customers", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({
        name: "Cliente A",
        segment: "   ",
        city: "Sao Paulo",
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /obrigatorios ausentes/i);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreCustomersRouteDeps();
  }
});
