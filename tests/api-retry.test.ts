import assert from "node:assert/strict";
import test from "node:test";
import {
  CircuitBreakerError,
  getAllRetryTelemetryStates,
  resetAllCircuitBreakerStates,
  withRetry,
  withRetryAndCircuitBreaker,
} from "@/lib/api-retry";

test("retry telemetry records retries and final success", async () => {
  resetAllCircuitBreakerStates();
  let attempts = 0;

  const result = await withRetry(async () => {
    attempts += 1;

    if (attempts < 3) {
      const error = new Error("transient timeout");
      throw error;
    }

    return "ok";
  }, {
    telemetryKey: "retry-test",
    maxAttempts: 3,
    initialDelayMs: 1,
    jitterMs: 0,
    shouldRetry: () => true,
  });

  assert.equal(result, "ok");
  const telemetry = getAllRetryTelemetryStates()["retry-test"];
  assert.equal(telemetry?.totalCalls, 1);
  assert.equal(telemetry?.successCount, 1);
  assert.equal(telemetry?.failureCount, 0);
  assert.equal(telemetry?.retriedCalls, 1);
  assert.equal(telemetry?.totalAttempts, 3);
  assert.equal(telemetry?.lastOutcome, "success");
});

test("retry telemetry records circuit-open rejections separately", async () => {
  resetAllCircuitBreakerStates();

  try {
    await withRetryAndCircuitBreaker(
      "breaker-test",
      async () => {
        throw new Error("upstream down");
      },
      {
        maxAttempts: 1,
      },
      {
        failureThreshold: 1,
        resetTimeoutMs: 60000,
      },
    );
  } catch {
    // First failure opens the breaker.
  }

  await assert.rejects(
    () =>
      withRetryAndCircuitBreaker(
        "breaker-test",
        async () => "ok",
        {
          maxAttempts: 1,
        },
        {
          failureThreshold: 1,
          resetTimeoutMs: 60000,
        },
      ),
    (error: unknown) => error instanceof CircuitBreakerError || error instanceof Error,
  );

  const telemetry = getAllRetryTelemetryStates()["breaker-test"];
  assert.equal(telemetry?.totalCalls, 2);
  assert.equal(telemetry?.failureCount, 1);
  assert.equal(telemetry?.circuitOpenRejections, 1);
  assert.equal(telemetry?.lastOutcome, "circuit-open");
});
