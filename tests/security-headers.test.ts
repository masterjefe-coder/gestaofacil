import assert from "node:assert/strict";
import test from "node:test";
import { buildContentSecurityPolicy, getDefaultSecurityHeaders } from "@/lib/security-headers";

test("content security policy stays strict in production", () => {
  const policy = buildContentSecurityPolicy({
    isDevelopment: false,
    appBaseUrl: "https://gestaofacil.app",
    evolutionApiBaseUrl: "https://evolution.example.com",
  });

  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /worker-src 'self' blob:/);
  assert.match(policy, /connect-src 'self' https:\/\/gestaofacil\.app https:\/\/evolution\.example\.com/);
  assert.doesNotMatch(policy, /unsafe-eval/);
  assert.match(policy, /upgrade-insecure-requests/);
});

test("content security policy keeps dev tooling allowances scoped to development", () => {
  const policy = buildContentSecurityPolicy({
    isDevelopment: true,
    appBaseUrl: "http://127.0.0.1:3000",
  });

  assert.match(policy, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
  assert.match(policy, /connect-src 'self' ws: wss: http:\/\/localhost:\* http:\/\/127\.0\.0\.1:\*/);
  assert.doesNotMatch(policy, /upgrade-insecure-requests/);
});

test("default security headers expose csp and transport protections", () => {
  const headers = getDefaultSecurityHeaders();

  assert.equal(headers.some((header) => header.key === "Content-Security-Policy"), true);
  assert.equal(headers.some((header) => header.key === "Strict-Transport-Security"), true);
  assert.equal(headers.some((header) => header.key === "Permissions-Policy"), true);
});
