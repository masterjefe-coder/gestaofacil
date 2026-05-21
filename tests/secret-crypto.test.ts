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
