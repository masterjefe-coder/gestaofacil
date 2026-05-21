import test from "node:test";
import assert from "node:assert/strict";
import { buildPasswordResetUrl, hashPasswordResetToken } from "@/lib/password-reset";

test("hashPasswordResetToken is deterministic and opaque", () => {
  const first = hashPasswordResetToken("reset-token-123");
  const second = hashPasswordResetToken("reset-token-123");

  assert.equal(first, second);
  assert.notEqual(first, "reset-token-123");
  assert.equal(first.length, 64);
});

test("buildPasswordResetUrl uses configured public base url", () => {
  process.env.APP_BASE_URL = "https://app.gestaofacil.test/";
  assert.equal(buildPasswordResetUrl("abc123"), "https://app.gestaofacil.test/redefinir-senha?token=abc123");
  delete process.env.APP_BASE_URL;
});
