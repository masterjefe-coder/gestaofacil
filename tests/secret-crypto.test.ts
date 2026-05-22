import test from "node:test";
import assert from "node:assert/strict";
import { decryptWorkspaceSecret, encryptWorkspaceSecret, isEncryptedSecret } from "@/lib/secret-crypto";

test("encryptWorkspaceSecret round-trips a workspace secret", () => {
  process.env.WORKSPACE_SECRET_KEY = "test-workspace-secret";

  const encrypted = encryptWorkspaceSecret("asaas_live_key_123");
  const decrypted = decryptWorkspaceSecret(encrypted);

  assert.equal(isEncryptedSecret(encrypted), true);
  assert.equal(decrypted, "asaas_live_key_123");
});

test("decryptWorkspaceSecret preserves legacy plaintext values", () => {
  assert.equal(decryptWorkspaceSecret("legacy-plain-key"), "legacy-plain-key");
});

test("decryptWorkspaceSecret supports legacy auth secret ciphertext while new encryption requires workspace key", () => {
  const previousWorkspaceKey = process.env.WORKSPACE_SECRET_KEY;
  const previousAuthSecret = process.env.AUTH_SECRET;

  delete process.env.WORKSPACE_SECRET_KEY;
  process.env.AUTH_SECRET = "legacy-auth-secret";

  assert.throws(() => encryptWorkspaceSecret("legacy-asaas-key"), /WORKSPACE_SECRET_KEY/);

  process.env.WORKSPACE_SECRET_KEY = "workspace-secret";
  const encrypted = encryptWorkspaceSecret("legacy-asaas-key");
  assert.equal(decryptWorkspaceSecret(encrypted), "legacy-asaas-key");

  process.env.WORKSPACE_SECRET_KEY = previousWorkspaceKey;
  process.env.AUTH_SECRET = previousAuthSecret;
});
