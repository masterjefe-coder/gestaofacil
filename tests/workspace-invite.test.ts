import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkspaceInviteUrl, getWorkspaceInviteDeliveryStatus, getWorkspaceInviteStatus, hashWorkspaceInviteToken } from "@/lib/workspace-invite-repository";

test("hashWorkspaceInviteToken is deterministic and opaque", () => {
  const first = hashWorkspaceInviteToken("invite-token-123");
  const second = hashWorkspaceInviteToken("invite-token-123");

  assert.equal(first, second);
  assert.notEqual(first, "invite-token-123");
  assert.equal(first.length, 64);
});

test("getWorkspaceInviteStatus prioritizes accepted and revoked states", () => {
  const expiresAt = new Date("2026-06-01T12:00:00.000Z");

  assert.equal(getWorkspaceInviteStatus({
    acceptedAt: new Date("2026-05-20T12:00:00.000Z"),
    revokedAt: new Date("2026-05-19T12:00:00.000Z"),
    expiresAt,
  }), "Aceito");

  assert.equal(getWorkspaceInviteStatus({
    acceptedAt: null,
    revokedAt: new Date("2026-05-19T12:00:00.000Z"),
    expiresAt,
  }), "Revogado");
});

test("getWorkspaceInviteStatus marks expired and pending invites correctly", () => {
  const now = new Date("2026-05-21T12:00:00.000Z");

  assert.equal(getWorkspaceInviteStatus({
    expiresAt: new Date("2026-05-20T11:59:59.000Z"),
    now,
  }), "Expirado");

  assert.equal(getWorkspaceInviteStatus({
    expiresAt: new Date("2026-05-25T11:59:59.000Z"),
    now,
  }), "Pendente");
});

test("buildWorkspaceInviteUrl uses public base url when available", () => {
  process.env.APP_BASE_URL = "https://app.gestaofacil.test/";
  assert.equal(buildWorkspaceInviteUrl("abc123"), "https://app.gestaofacil.test/convite?token=abc123");
  delete process.env.APP_BASE_URL;
});

test("getWorkspaceInviteDeliveryStatus distinguishes pending, sent and failed deliveries", () => {
  assert.equal(getWorkspaceInviteDeliveryStatus({
    sendCount: 0,
    lastSentAt: null,
    lastDeliveryError: null,
  }), "Pendente");

  assert.equal(getWorkspaceInviteDeliveryStatus({
    sendCount: 1,
    lastSentAt: new Date("2026-05-21T12:00:00.000Z"),
    lastDeliveryError: null,
  }), "Enviado");

  assert.equal(getWorkspaceInviteDeliveryStatus({
    sendCount: 1,
    lastSentAt: new Date("2026-05-21T12:00:00.000Z"),
    lastDeliveryError: "Falha",
  }), "Falhou");
});
