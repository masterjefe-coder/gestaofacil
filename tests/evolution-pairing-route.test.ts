import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server";
import { GET as getEvolutionPairing, evolutionPairingRouteDeps } from "@/app/api/evolution/pairing/route";
import { REQUEST_ID_HEADER } from "@/lib/request-tracing";
import { EvolutionApiError } from "@/lib/evolution-api";

const originalDeps = {
  requireApiSession: evolutionPairingRouteDeps.requireApiSession,
  getCurrentWorkspaceContext: evolutionPairingRouteDeps.getCurrentWorkspaceContext,
  connectEvolutionInstance: evolutionPairingRouteDeps.connectEvolutionInstance,
};

function restoreEvolutionPairingDeps() {
  evolutionPairingRouteDeps.requireApiSession = originalDeps.requireApiSession;
  evolutionPairingRouteDeps.getCurrentWorkspaceContext = originalDeps.getCurrentWorkspaceContext;
  evolutionPairingRouteDeps.connectEvolutionInstance = originalDeps.connectEvolutionInstance;
}

test("evolution pairing route forwards unauthorized response with request id", async () => {
  evolutionPairingRouteDeps.requireApiSession = async () =>
    NextResponse.json({ error: "Sessao invalida ou ausente." }, { status: 401 });

  try {
    const requestId = "evolution-pairing-unauthorized-request-id";
    const response = await getEvolutionPairing(new Request("http://localhost/api/evolution/pairing?instance=gf-main", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error, "Sessao invalida ou ausente.");
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreEvolutionPairingDeps();
  }
});

test("evolution pairing route rejects members without setup management access", async () => {
  evolutionPairingRouteDeps.requireApiSession = async () => null;
  evolutionPairingRouteDeps.getCurrentWorkspaceContext = async () => ({
    userId: "user-1",
    email: "member@gestaofacil.app",
    workspaceId: "workspace-1",
    workspaceRole: "MEMBER",
  });

  try {
    const requestId = "evolution-pairing-forbidden-request-id";
    const response = await getEvolutionPairing(new Request("http://localhost/api/evolution/pairing?instance=gf-main", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.match(payload.error, /owner ou admin/i);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreEvolutionPairingDeps();
  }
});

test("evolution pairing route rejects missing instance name", async () => {
  evolutionPairingRouteDeps.requireApiSession = async () => null;
  evolutionPairingRouteDeps.getCurrentWorkspaceContext = async () => ({
    userId: "user-1",
    email: "owner@gestaofacil.app",
    workspaceId: "workspace-1",
    workspaceRole: "OWNER",
  });

  try {
    const requestId = "evolution-pairing-missing-instance-request-id";
    const response = await getEvolutionPairing(new Request("http://localhost/api/evolution/pairing", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /informe/i);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreEvolutionPairingDeps();
  }
});

test("evolution pairing route returns pairing payload with request id", async () => {
  evolutionPairingRouteDeps.requireApiSession = async () => null;
  evolutionPairingRouteDeps.getCurrentWorkspaceContext = async () => ({
    userId: "user-1",
    email: "owner@gestaofacil.app",
    workspaceId: "workspace-1",
    workspaceRole: "OWNER",
  });
  evolutionPairingRouteDeps.connectEvolutionInstance = async () => ({
    pairingCode: "123-456",
    base64: "data:image/png;base64,ZmFrZQ==",
    code: "RAW123",
    count: 1,
  });

  try {
    const requestId = "evolution-pairing-success-request-id";
    const response = await getEvolutionPairing(new Request("http://localhost/api/evolution/pairing?instance=gf-main", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.ok, true);
    assert.equal(payload.instanceName, "gf-main");
    assert.equal(payload.pairingCode, "123-456");
    assert.equal(payload.rawCode, "RAW123");
  } finally {
    restoreEvolutionPairingDeps();
  }
});

test("evolution pairing route surfaces integration failures as 500 with request id", async () => {
  evolutionPairingRouteDeps.requireApiSession = async () => null;
  evolutionPairingRouteDeps.getCurrentWorkspaceContext = async () => ({
    userId: "user-1",
    email: "owner@gestaofacil.app",
    workspaceId: "workspace-1",
    workspaceRole: "OWNER",
  });
  evolutionPairingRouteDeps.connectEvolutionInstance = async () => {
    throw new EvolutionApiError("Nao foi possivel gerar o pareamento agora.");
  };

  try {
    const requestId = "evolution-pairing-error-request-id";
    const response = await getEvolutionPairing(new Request("http://localhost/api/evolution/pairing?instance=gf-main", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /pareamento/i);
  } finally {
    restoreEvolutionPairingDeps();
  }
});
