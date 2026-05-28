import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server";
import { GET as getEvolutionStatus, evolutionStatusRouteDeps } from "@/app/api/evolution/status/route";
import { REQUEST_ID_HEADER } from "@/lib/request-tracing";
import { EvolutionApiError } from "@/lib/evolution-api";

const originalDeps = {
  requireApiSession: evolutionStatusRouteDeps.requireApiSession,
  getCurrentWorkspaceContext: evolutionStatusRouteDeps.getCurrentWorkspaceContext,
  getEvolutionConnectionState: evolutionStatusRouteDeps.getEvolutionConnectionState,
  getWorkspaceEvolutionInstanceName: evolutionStatusRouteDeps.getWorkspaceEvolutionInstanceName,
};

function restoreEvolutionStatusDeps() {
  evolutionStatusRouteDeps.requireApiSession = originalDeps.requireApiSession;
  evolutionStatusRouteDeps.getCurrentWorkspaceContext = originalDeps.getCurrentWorkspaceContext;
  evolutionStatusRouteDeps.getEvolutionConnectionState = originalDeps.getEvolutionConnectionState;
  evolutionStatusRouteDeps.getWorkspaceEvolutionInstanceName = originalDeps.getWorkspaceEvolutionInstanceName;
}

test("evolution status route forwards unauthorized response with request id", async () => {
  evolutionStatusRouteDeps.requireApiSession = async () =>
    NextResponse.json({ error: "Sessao invalida ou ausente." }, { status: 401 });

  try {
    const requestId = "evolution-status-unauthorized-request-id";
    const response = await getEvolutionStatus(new Request("http://localhost/api/evolution/status?instance=gf-main", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error, "Sessao invalida ou ausente.");
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreEvolutionStatusDeps();
  }
});

test("evolution status route rejects members without setup management access", async () => {
  evolutionStatusRouteDeps.requireApiSession = async () => null;
  evolutionStatusRouteDeps.getCurrentWorkspaceContext = async () => ({
    userId: "user-1",
    email: "member@gestaofacil.app",
    workspaceId: "workspace-1",
    workspaceRole: "MEMBER",
  });

  try {
    const requestId = "evolution-status-forbidden-request-id";
    const response = await getEvolutionStatus(new Request("http://localhost/api/evolution/status?instance=gf-main", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.match(payload.error, /owner ou admin/i);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreEvolutionStatusDeps();
  }
});

test("evolution status route rejects missing instance name", async () => {
  evolutionStatusRouteDeps.requireApiSession = async () => null;
  evolutionStatusRouteDeps.getCurrentWorkspaceContext = async () => ({
    userId: "user-1",
    email: "owner@gestaofacil.app",
    workspaceId: "workspace-1",
    workspaceRole: "OWNER",
  });
  evolutionStatusRouteDeps.getWorkspaceEvolutionInstanceName = async () => "gf-main";

  try {
    const requestId = "evolution-status-missing-instance-request-id";
    const response = await getEvolutionStatus(new Request("http://localhost/api/evolution/status", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /informe/i);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
  } finally {
    restoreEvolutionStatusDeps();
  }
});

test("evolution status route returns connection state with request id", async () => {
  evolutionStatusRouteDeps.requireApiSession = async () => null;
  evolutionStatusRouteDeps.getCurrentWorkspaceContext = async () => ({
    userId: "user-1",
    email: "owner@gestaofacil.app",
    workspaceId: "workspace-1",
    workspaceRole: "OWNER",
  });
  evolutionStatusRouteDeps.getWorkspaceEvolutionInstanceName = async () => "gf-main";
  evolutionStatusRouteDeps.getEvolutionConnectionState = async () => ({
    instance: {
      state: "open",
    },
  });

  try {
    const requestId = "evolution-status-success-request-id";
    const response = await getEvolutionStatus(new Request("http://localhost/api/evolution/status?instance=gf-main", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.ok, true);
    assert.equal(payload.instanceName, "gf-main");
    assert.equal(payload.state, "open");
    assert.equal(payload.connected, true);
  } finally {
    restoreEvolutionStatusDeps();
  }
});

test("evolution status route surfaces integration failures as 500 with request id", async () => {
  evolutionStatusRouteDeps.requireApiSession = async () => null;
  evolutionStatusRouteDeps.getCurrentWorkspaceContext = async () => ({
    userId: "user-1",
    email: "owner@gestaofacil.app",
    workspaceId: "workspace-1",
    workspaceRole: "OWNER",
  });
  evolutionStatusRouteDeps.getWorkspaceEvolutionInstanceName = async () => "gf-main";
  evolutionStatusRouteDeps.getEvolutionConnectionState = async () => {
    throw new EvolutionApiError("Evolution API recusou a operacao (503).");
  };

  try {
    const requestId = "evolution-status-error-request-id";
    const response = await getEvolutionStatus(new Request("http://localhost/api/evolution/status?instance=gf-main", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /503/);
  } finally {
    restoreEvolutionStatusDeps();
  }
});

test("evolution status route rejects requests for another workspace instance", async () => {
  evolutionStatusRouteDeps.requireApiSession = async () => null;
  evolutionStatusRouteDeps.getCurrentWorkspaceContext = async () => ({
    userId: "user-1",
    email: "owner@gestaofacil.app",
    workspaceId: "workspace-1",
    workspaceRole: "OWNER",
  });
  evolutionStatusRouteDeps.getWorkspaceEvolutionInstanceName = async () => "gf-main";

  try {
    const requestId = "evolution-status-wrong-instance-request-id";
    const response = await getEvolutionStatus(new Request("http://localhost/api/evolution/status?instance=other-company", {
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.match(payload.error, /WhatsApp principal desta empresa/i);
  } finally {
    restoreEvolutionStatusDeps();
  }
});
