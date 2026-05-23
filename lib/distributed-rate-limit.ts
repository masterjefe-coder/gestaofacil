import { prisma } from "@/lib/prisma";

export const distributedRateLimitDeps = {
  prisma,
};

export type DistributedRateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
};

function buildWindowKey(windowMs: number, now: number) {
  return `${windowMs}:${Math.floor(now / windowMs)}`;
}

export async function checkDistributedRateLimit(input: {
  scope: string;
  identifier: string;
  windowMs: number;
  maxRequests: number;
}): Promise<DistributedRateLimitResult> {
  const now = Date.now();
  const windowKey = buildWindowKey(input.windowMs, now);
  const resetAt = new Date((Math.floor(now / input.windowMs) + 1) * input.windowMs);

  const result = await distributedRateLimitDeps.prisma.$transaction(async (tx) => {
    const existing = await tx.rateLimitBucket.findUnique({
      where: {
        scope_identifier_windowKey: {
          scope: input.scope,
          identifier: input.identifier,
          windowKey,
        },
      },
    });

    if (!existing) {
      await tx.rateLimitBucket.create({
        data: {
          scope: input.scope,
          identifier: input.identifier,
          windowKey,
          count: 1,
          resetAt,
        },
      });

      return {
        allowed: true,
        count: 1,
      };
    }

    if (existing.count >= input.maxRequests) {
      return {
        allowed: false,
        count: existing.count,
      };
    }

    const updated = await tx.rateLimitBucket.update({
      where: {
        scope_identifier_windowKey: {
          scope: input.scope,
          identifier: input.identifier,
          windowKey,
        },
      },
      data: {
        count: {
          increment: 1,
        },
      },
    });

    return {
      allowed: true,
      count: updated.count,
    };
  });

  return {
    allowed: result.allowed,
    remaining: Math.max(0, input.maxRequests - result.count),
    resetAt: resetAt.getTime(),
    limit: input.maxRequests,
  };
}

export async function cleanupDistributedRateLimitBuckets(now = new Date()) {
  await distributedRateLimitDeps.prisma.rateLimitBucket.deleteMany({
    where: {
      resetAt: {
        lt: now,
      },
    },
  });
}
