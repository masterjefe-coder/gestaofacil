import assert from "node:assert/strict";
import test from "node:test";
import { summarizeExternalErrorDetails } from "@/lib/api-logger";

test("summarizeExternalErrorDetails normalizes whitespace and trims long provider messages", () => {
  const summary = summarizeExternalErrorDetails("  provider   failed \n with   too much detail  ", 24);

  assert.equal(summary, "provider failed with ...");
});

test("summarizeExternalErrorDetails masks token-like values", () => {
  const summary = summarizeExternalErrorDetails("abcdefghijklmnopqrstuvwx123456");

  assert.equal(summary, "abcd...3456");
});

test("summarizeExternalErrorDetails returns null for empty values", () => {
  assert.equal(summarizeExternalErrorDetails("   "), null);
  assert.equal(summarizeExternalErrorDetails(undefined), null);
});
