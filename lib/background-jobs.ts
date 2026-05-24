import { randomUUID } from "node:crypto";
import type { BackgroundJob, BackgroundJobStatus, Prisma } from "@prisma/client";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { isLocalDataMode } from "@/lib/data-mode";
import { prisma } from "@/lib/prisma";

const localJobs = new Map<string, BackgroundJob>();

export const backgroundJobDeps = {
  getCurrentWorkspaceContext,
  isLocalDataMode,
  prisma,
};

export type BackgroundJobPayload = Prisma.JsonObject;

export type EnqueueJobInput = {
  type: string;
  payload: BackgroundJobPayload;
  dedupeKey?: string;
  scheduledFor?: Date;
  availableAt?: Date;
  maxAttempts?: number;
  workspaceId?: string;
};

export type LeaseJobsInput = {
  workerId: string;
  limit?: number;
  types?: string[];
};

function toLocalJob(input: EnqueueJobInput): BackgroundJob {
  const now = new Date();

  return {
    id: randomUUID(),
    type: input.type,
    payload: input.payload,
    status: "PENDING",
    dedupeKey: input.dedupeKey || null,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    scheduledFor: input.scheduledFor || now,
    availableAt: input.availableAt || input.scheduledFor || now,
    lockedAt: null,
    lockedBy: null,
    lastError: null,
    completedAt: null,
    failedAt: null,
    createdAt: now,
    updatedAt: now,
    workspaceId: input.workspaceId || null,
  };
}

async function resolveWorkspaceId(workspaceId?: string) {
  if (workspaceId) {
    return workspaceId;
  }

  if (backgroundJobDeps.isLocalDataMode()) {
    return undefined;
  }

  try {
    const context = await backgroundJobDeps.getCurrentWorkspaceContext();
    return context.workspaceId;
  } catch {
    return undefined;
  }
}

export async function enqueueBackgroundJob(input: EnqueueJobInput) {
  const workspaceId = await resolveWorkspaceId(input.workspaceId);

  if (backgroundJobDeps.isLocalDataMode()) {
    const existing = input.dedupeKey
      ? [...localJobs.values()].find((job) => job.type === input.type && job.dedupeKey === input.dedupeKey)
      : null;

    if (existing && existing.status !== "COMPLETED" && existing.status !== "CANCELED") {
      return existing;
    }

    const job = toLocalJob({ ...input, workspaceId });
    localJobs.set(job.id, job);
    return job;
  }

  if (input.dedupeKey) {
    const existing = await backgroundJobDeps.prisma.backgroundJob.findFirst({
      where: {
        type: input.type,
        dedupeKey: input.dedupeKey,
        status: {
          in: ["PENDING", "RUNNING", "FAILED"],
        },
      },
    });

    if (existing) {
      return existing;
    }
  }

  return backgroundJobDeps.prisma.backgroundJob.create({
    data: {
      type: input.type,
      payload: input.payload,
      dedupeKey: input.dedupeKey,
      scheduledFor: input.scheduledFor,
      availableAt: input.availableAt || input.scheduledFor,
      maxAttempts: input.maxAttempts ?? 3,
      workspaceId,
    },
  });
}

export async function leaseBackgroundJobs(input: LeaseJobsInput) {
  const limit = input.limit ?? 10;
  const now = new Date();

  if (backgroundJobDeps.isLocalDataMode()) {
    const leased: BackgroundJob[] = [];

    for (const job of localJobs.values()) {
      if (leased.length >= limit) {
        break;
      }

      if (job.status !== "PENDING" && job.status !== "FAILED") {
        continue;
      }

      if (job.availableAt > now) {
        continue;
      }

      if (input.types?.length && !input.types.includes(job.type)) {
        continue;
      }

      const next: BackgroundJob = {
        ...job,
        status: "RUNNING",
        attempts: job.attempts + 1,
        lockedAt: now,
        lockedBy: input.workerId,
        updatedAt: now,
      };
      localJobs.set(job.id, next);
      leased.push(next);
    }

    return leased;
  }

  const jobs = await backgroundJobDeps.prisma.backgroundJob.findMany({
    where: {
      status: {
        in: ["PENDING", "FAILED"],
      },
      availableAt: {
        lte: now,
      },
      ...(input.types?.length
        ? {
            type: {
              in: input.types,
            },
          }
        : {}),
    },
    orderBy: [
      { availableAt: "asc" },
      { createdAt: "asc" },
    ],
    take: limit,
  });

  const leased: BackgroundJob[] = [];

  for (const job of jobs) {
    const updated = await backgroundJobDeps.prisma.backgroundJob.updateMany({
      where: {
        id: job.id,
        status: job.status,
      },
      data: {
        status: "RUNNING",
        attempts: {
          increment: 1,
        },
        lockedAt: now,
        lockedBy: input.workerId,
      },
    });

    if (updated.count === 1) {
      const leasedJob = await backgroundJobDeps.prisma.backgroundJob.findUnique({ where: { id: job.id } });

      if (leasedJob) {
        leased.push(leasedJob);
      }
    }
  }

  return leased;
}

export async function completeBackgroundJob(id: string) {
  const now = new Date();

  if (backgroundJobDeps.isLocalDataMode()) {
    const job = localJobs.get(id);

    if (!job) {
      return null;
    }

    const next: BackgroundJob = {
      ...job,
      status: "COMPLETED",
      completedAt: now,
      lockedAt: null,
      lockedBy: null,
      updatedAt: now,
    };
    localJobs.set(id, next);
    return next;
  }

  return backgroundJobDeps.prisma.backgroundJob.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: now,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
}

export async function failBackgroundJob(id: string, errorMessage: string, retryDelayMs = 0) {
  const now = new Date();
  const availableAt = new Date(now.getTime() + retryDelayMs);

  if (backgroundJobDeps.isLocalDataMode()) {
    const job = localJobs.get(id);

    if (!job) {
      return null;
    }

    const nextStatus: BackgroundJobStatus = job.attempts >= job.maxAttempts ? "FAILED" : "PENDING";
    const next: BackgroundJob = {
      ...job,
      status: nextStatus,
      lastError: errorMessage,
      failedAt: now,
      availableAt,
      lockedAt: null,
      lockedBy: null,
      updatedAt: now,
    };
    localJobs.set(id, next);
    return next;
  }

  const job = await backgroundJobDeps.prisma.backgroundJob.findUnique({ where: { id } });

  if (!job) {
    return null;
  }

  const nextStatus: BackgroundJobStatus = job.attempts >= job.maxAttempts ? "FAILED" : "PENDING";

  return backgroundJobDeps.prisma.backgroundJob.update({
    where: { id },
    data: {
      status: nextStatus,
      lastError: errorMessage,
      failedAt: now,
      availableAt,
      lockedAt: null,
      lockedBy: null,
    },
  });
}

export async function listBackgroundJobStats() {
  if (backgroundJobDeps.isLocalDataMode()) {
    const values = [...localJobs.values()];
    return {
      pendingCount: values.filter((job) => job.status === "PENDING").length,
      runningCount: values.filter((job) => job.status === "RUNNING").length,
      failedCount: values.filter((job) => job.status === "FAILED").length,
      completedCount: values.filter((job) => job.status === "COMPLETED").length,
    };
  }

  try {
    const [pendingCount, runningCount, failedCount, completedCount] = await Promise.all([
      backgroundJobDeps.prisma.backgroundJob.count({ where: { status: "PENDING" } }),
      backgroundJobDeps.prisma.backgroundJob.count({ where: { status: "RUNNING" } }),
      backgroundJobDeps.prisma.backgroundJob.count({ where: { status: "FAILED" } }),
      backgroundJobDeps.prisma.backgroundJob.count({ where: { status: "COMPLETED" } }),
    ]);

    return {
      pendingCount,
      runningCount,
      failedCount,
      completedCount,
    };
  } catch (error) {
    const isMissingTable =
      typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === "P2021";

    if (isMissingTable) {
      return {
        pendingCount: 0,
        runningCount: 0,
        failedCount: 0,
        completedCount: 0,
      };
    }

    throw error;
  }
}

export function resetBackgroundJobsForTests() {
  localJobs.clear();
}
