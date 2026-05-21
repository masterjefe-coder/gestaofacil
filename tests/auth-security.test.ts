import test from "node:test";
import assert from "node:assert/strict";
import { describeRetryAfter } from "@/lib/auth-security";

test("describeRetryAfter formats seconds and minutes for lock feedback", () => {
  assert.equal(describeRetryAfter(45), "45s");
  assert.equal(describeRetryAfter(61), "2 min");
  assert.equal(describeRetryAfter(180), "3 min");
});
