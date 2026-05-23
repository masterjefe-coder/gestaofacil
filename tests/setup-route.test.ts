import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server";
import { GET as getSetup, POST as postSetup, setupRouteDeps } from "@/app/api/setup/route";
import { REQUEST_ID_HEADER } from "@/lib/request-tracing";

const originalDeps = {
  requireApiModuleAccess: setupRouteDeps.requireApiModuleAccess,
  getWorkspaceSetup: setupRouteDeps.getWorkspaceSetup,
  updateWorkspaceSetup: setupRouteDeps.updateWorkspaceSetup,
};

function restoreSetupRouteDeps() {
  setupRouteDeps.requireApiModuleAccess = originalDeps.requireApiModuleAccess;
  setupRouteDeps.getWorkspaceSetup = originalDeps.getWorkspaceSetup;
  setupRouteDeps.updateWorkspaceSetup = originalDeps.updateWorkspaceSetup;
}

test("setup route GET forwards unauthorized response with request id", async () => {
  setupRouteDeps.requireApiModuleAccess = async () =>
    NextResponse.json({ error: "Sessao invalida ou ausente." }, { status: 401 });

  try {
    const requestId = "setup-get-unauthorized-request-id";
    const response = await getSetup(new Request("http://localhost/api/setup", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error, "Sessao invalida ou ausente.");
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreSetupRouteDeps();
  }
});

test("setup route GET returns setup payload with request id", async () => {
  setupRouteDeps.requireApiModuleAccess = async () => null;
  setupRouteDeps.getWorkspaceSetup = async () => ({
    name: "Gestao Facil",
    slug: "gestao-facil",
    niche: "Servicos",
    legalName: "Gestao Facil LTDA",
    tradeName: "Gestao Facil",
    document: "12345678000190",
    city: "Sao Paulo",
    state: "SP",
    municipalCode: "3550308",
    serviceDescription: "Operacao comercial",
    defaultFiscalServiceCode: "0107",
    defaultPixKey: "pix@gestaofacil.app",
    defaultPaymentMessage: "Obrigado",
    asaasAccountId: "",
    asaasWalletId: "",
    asaasUseOwnAccount: false,
    asaasSplitEnabled: false,
  });

  try {
    const requestId = "setup-get-request-id";
    const response = await getSetup(new Request("http://localhost/api/setup", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.setup.slug, "gestao-facil");
    assert.equal(payload.setup.municipalCode, "3550308");
  } finally {
    restoreSetupRouteDeps();
  }
});

test("setup route POST rejects missing required fields", async () => {
  setupRouteDeps.requireApiModuleAccess = async () => null;

  try {
    const requestId = "setup-post-invalid-request-id";
    const response = await postSetup(new Request("http://localhost/api/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({
        slug: "gestao-facil",
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /obrigatorios ausentes/i);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreSetupRouteDeps();
  }
});

test("setup route POST rejects invalid json payload", async () => {
  setupRouteDeps.requireApiModuleAccess = async () => null;

  try {
    const requestId = "setup-post-invalid-json-request-id";
    const response = await postSetup(new Request("http://localhost/api/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: "{invalid",
    }));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /json invalido/i);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreSetupRouteDeps();
  }
});

test("setup route POST updates setup payload with normalized optional fields", async () => {
  setupRouteDeps.requireApiModuleAccess = async () => null;
  setupRouteDeps.updateWorkspaceSetup = async (input) => ({
    workspace: {
      name: input.name,
      slug: input.slug,
      niche: input.niche,
    },
    company: {
      legalName: input.legalName,
      tradeName: input.tradeName,
      document: input.document,
      city: input.city,
      state: input.state,
      municipalCode: "3550308",
      serviceDescription: input.serviceDescription,
      defaultFiscalServiceCode: input.defaultFiscalServiceCode || "",
      defaultPixKey: input.defaultPixKey,
      defaultPaymentMessage: input.defaultPaymentMessage,
    },
  });

  try {
    const requestId = "setup-post-success-request-id";
    const response = await postSetup(new Request("http://localhost/api/setup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({
        name: "Gestao Facil",
        slug: "gestao-facil",
        tradeName: "Gestao Facil",
        document: "12345678000190",
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.setup.workspace.slug, "gestao-facil");
    assert.equal(payload.setup.company.city, "");
    assert.equal(payload.setup.company.defaultPaymentMessage, "");
  } finally {
    restoreSetupRouteDeps();
  }
});
