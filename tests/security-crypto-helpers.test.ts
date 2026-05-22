import test from "node:test";
import assert from "node:assert/strict";
import {
  generateHmacSignature,
  generateSecureToken,
  timingSafeCompare,
  verifyCsrfToken,
  verifyHmacSignature,
  verifyWebhookTimestamp,
} from "@/lib/security-crypto";

test("timingSafeCompare matches equal values and rejects different ones", () => {
  assert.equal(timingSafeCompare("abc123", "abc123"), true);
  assert.equal(timingSafeCompare("abc123", "xyz123"), false);
  assert.equal(timingSafeCompare("short", "longer-value"), false);
  assert.equal(timingSafeCompare(null, "abc123"), false);
});

test("verifyWebhookTimestamp accepts recent timestamps and rejects invalid ones", () => {
  const recentIso = new Date().toISOString();
  const recentUnix = Math.floor(Date.now() / 1000);
  const expiredIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  assert.equal(verifyWebhookTimestamp(recentIso), true);
  assert.equal(verifyWebhookTimestamp(recentUnix), true);
  assert.equal(verifyWebhookTimestamp(expiredIso, 300), false);
  assert.equal(verifyWebhookTimestamp("invalid-date"), false);
});

test("HMAC helpers sign and verify payloads consistently", () => {
  const secret = "webhook-secret";
  const payload = { event: "PAYMENT_RECEIVED", id: "pay_123" };
  const signature = generateHmacSignature(payload, secret);

  assert.equal(verifyHmacSignature(payload, signature, secret), true);
  assert.equal(verifyHmacSignature(payload, `${signature}x`, secret), false);
});

test("secure token helpers generate non-empty hex tokens", () => {
  const token = generateSecureToken(16);

  assert.equal(token.length, 32);
  assert.match(token, /^[a-f0-9]+$/);
  assert.equal(verifyCsrfToken(token, token), true);
  assert.equal(verifyCsrfToken(token, `${token}00`), false);
});
