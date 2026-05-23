import assert from "node:assert/strict";
import test from "node:test";
import { POST as postLogoutTrack, logoutTrackRouteDeps } from "@/app/api/auth/logout-track/route";
import { REQUEST_ID_HEADER } from "@/lib/request-tracing";

const originalDeps = {
  getCurrentWorkspaceContext: logoutTrackRouteDeps.getCurrentWorkspaceContext,
  recordAuditEvent: logoutTrackRouteDeps.recordAuditEvent,
};

function restoreLogoutTrackRouteDeps() {
  logoutTrackRouteDeps.getCurrentWorkspaceContext = originalDeps.getCurrentWorkspaceContext;
  logoutTrackRouteDeps.recordAuditEvent = originalDeps.recordAuditEvent;
}

test("logout track route records logout activity and returns tracked true with request id", async () => {
  let recordedPayload: unknown;

  logoutTrackRouteDeps.getCurrentWorkspaceContext = async () => ({
    userId: "user-1",
    email: "owner@gestaofacil.app",
    workspaceId: "workspace-1",
    workspaceRole: "OWNER",
  });
  logoutTrackRouteDeps.recordAuditEvent = async (payload) => {
    recordedPayload = payload;
    return null;
  };

  try {
    const requestId = "logout-track-success-request-id";
    const response = await postLogoutTrack(new Request("http://localhost/api/auth/logout-track", {
      method: "POST",
      headers: {
        [REQUEST_ID_HEADER]: requestId,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/136.0",
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.tracked, true);
    assert.equal(
      (recordedPayload as { action: string }).action,
      "auth.logout.requested",
    );
    assert.equal(
      (recordedPayload as { payload: { metadata: { userAgent: string } } }).payload.metadata.userAgent,
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/136.0",
    );
  } finally {
    restoreLogoutTrackRouteDeps();
  }
});

test("logout track route falls back to tracked false when context lookup fails", async () => {
  logoutTrackRouteDeps.getCurrentWorkspaceContext = async () => {
    throw new Error("Sessao indisponivel");
  };

  try {
    const requestId = "logout-track-failure-request-id";
    const response = await postLogoutTrack(new Request("http://localhost/api/auth/logout-track", {
      method: "POST",
      headers: {
        [REQUEST_ID_HEADER]: requestId,
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get(REQUEST_ID_HEADER), requestId);
    assert.equal(payload.tracked, false);
  } finally {
    restoreLogoutTrackRouteDeps();
  }
});
