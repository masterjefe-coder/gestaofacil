import test from "node:test";
import assert from "node:assert/strict";
import { describeRetryAfter } from "@/lib/auth-security";
import { canUsePublicDemoCredentials } from "@/lib/runtime-safety";

test("describeRetryAfter formats seconds and minutes for lock feedback", () => {
  assert.equal(describeRetryAfter(45), "45s");
  assert.equal(describeRetryAfter(61), "2 min");
  assert.equal(describeRetryAfter(180), "3 min");
});

test("public demo credentials require explicit flag", () => {
  const previousMode = process.env.GESTAO_FACIL_DATA_MODE;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousDemoFlag = process.env.GESTAO_FACIL_ENABLE_PUBLIC_DEMO;

  delete process.env.DATABASE_URL;
  process.env.GESTAO_FACIL_DATA_MODE = "local";
  delete process.env.GESTAO_FACIL_ENABLE_PUBLIC_DEMO;
  assert.equal(canUsePublicDemoCredentials(), false);

  process.env.GESTAO_FACIL_ENABLE_PUBLIC_DEMO = "true";
  assert.equal(canUsePublicDemoCredentials(), true);

  process.env.GESTAO_FACIL_DATA_MODE = previousMode;
  process.env.DATABASE_URL = previousDatabaseUrl;
  process.env.GESTAO_FACIL_ENABLE_PUBLIC_DEMO = previousDemoFlag;
});
