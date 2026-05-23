import assert from "node:assert/strict";
import test from "node:test";
import {
  backgroundJobDeps,
  completeBackgroundJob,
  enqueueBackgroundJob,
  failBackgroundJob,
  leaseBackgroundJobs,
  listBackgroundJobStats,
  resetBackgroundJobsForTests,
} from "@/lib/background-jobs";

const originalDeps = {
  getCurrentWorkspaceContext: backgroundJobDeps.getCurrentWorkspaceContext,
  isLocalDataMode: backgroundJobDeps.isLocalDataMode,
};

function restoreBackgroundJobDeps() {
  backgroundJobDeps.getCurrentWorkspaceContext = originalDeps.getCurrentWorkspaceContext;
  backgroundJobDeps.isLocalDataMode = originalDeps.isLocalDataMode;
  resetBackgroundJobsForTests();
}

test("background jobs dedupe active local jobs and expose queue stats", async () => {
  restoreBackgroundJobDeps();
  try {
    backgroundJobDeps.isLocalDataMode = () => true;

    const first = await enqueueBackgroundJob({
      type: "asaas.charge.retry",
      dedupeKey: "charge:1",
      payload: { chargeId: "charge-1" },
    });
    const second = await enqueueBackgroundJob({
      type: "asaas.charge.retry",
      dedupeKey: "charge:1",
      payload: { chargeId: "charge-1" },
    });
    const stats = await listBackgroundJobStats();

    assert.equal(second.id, first.id);
    assert.deepEqual(stats, {
      pendingCount: 1,
      runningCount: 0,
      failedCount: 0,
      completedCount: 0,
    });
  } finally {
    restoreBackgroundJobDeps();
  }
});

test("background jobs lease, retry and eventually fail in local mode", async () => {
  restoreBackgroundJobDeps();
  try {
    backgroundJobDeps.isLocalDataMode = () => true;

    const created = await enqueueBackgroundJob({
      type: "asaas.charge.retry",
      payload: { chargeId: "charge-2" },
      maxAttempts: 2,
    });

    const [leasedOnce] = await leaseBackgroundJobs({ workerId: "worker-a", limit: 1 });
    assert.equal(leasedOnce?.id, created.id);
    assert.equal(leasedOnce?.status, "RUNNING");
    assert.equal(leasedOnce?.attempts, 1);

    const retried = await failBackgroundJob(created.id, "temporary upstream failure");
    assert.equal(retried?.status, "PENDING");
    assert.equal(retried?.lastError, "temporary upstream failure");

    const [leasedTwice] = await leaseBackgroundJobs({ workerId: "worker-a", limit: 1 });
    assert.equal(leasedTwice?.id, created.id);
    assert.equal(leasedTwice?.attempts, 2);

    const failed = await failBackgroundJob(created.id, "permanent upstream failure");
    assert.equal(failed?.status, "FAILED");

    const stats = await listBackgroundJobStats();
    assert.deepEqual(stats, {
      pendingCount: 0,
      runningCount: 0,
      failedCount: 1,
      completedCount: 0,
    });
  } finally {
    restoreBackgroundJobDeps();
  }
});

test("background jobs can be completed in local mode", async () => {
  restoreBackgroundJobDeps();
  try {
    backgroundJobDeps.isLocalDataMode = () => true;

    const created = await enqueueBackgroundJob({
      type: "diagnostics.refresh",
      payload: { scope: "dashboard" },
    });

    await leaseBackgroundJobs({ workerId: "worker-b", limit: 1 });
    const completed = await completeBackgroundJob(created.id);

    assert.equal(completed?.status, "COMPLETED");
    assert.ok(completed?.completedAt instanceof Date);
  } finally {
    restoreBackgroundJobDeps();
  }
});
