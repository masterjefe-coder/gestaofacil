import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkspaceContextFromMembership, resolvePreferredWorkspaceId } from "@/lib/auth-session";

test("resolvePreferredWorkspaceId prioritizes cookie over session workspace", () => {
  assert.equal(resolvePreferredWorkspaceId({
    cookieWorkspaceId: "workspace-cookie",
    sessionWorkspaceId: "workspace-session",
  }), "workspace-cookie");
});

test("resolvePreferredWorkspaceId falls back to session workspace", () => {
  assert.equal(resolvePreferredWorkspaceId({
    cookieWorkspaceId: "",
    sessionWorkspaceId: "workspace-session",
  }), "workspace-session");
});

test("buildWorkspaceContextFromMembership maps membership fields into context", () => {
  const context = buildWorkspaceContextFromMembership({
    userId: "user-1",
    userEmail: "ana@empresa.com.br",
    workspaceId: "workspace-1",
    role: "ADMIN",
  });

  assert.deepEqual(context, {
    userId: "user-1",
    email: "ana@empresa.com.br",
    workspaceId: "workspace-1",
    workspaceRole: "ADMIN",
  });
});
