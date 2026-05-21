import test from "node:test";
import assert from "node:assert/strict";
import { summarizeUserAgent } from "@/lib/access-activity";

test("summarizeUserAgent extracts browser and operating system", () => {
  const result = summarizeUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0 Safari/537.36",
  );

  assert.equal(result, "Chrome • Windows");
});

test("summarizeUserAgent falls back when user agent is missing", () => {
  assert.equal(summarizeUserAgent(""), "Dispositivo não informado");
});
