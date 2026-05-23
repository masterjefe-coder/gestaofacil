import assert from "node:assert/strict";
import test from "node:test";
import {
  checkDistributedRateLimit,
  cleanupDistributedRateLimitBuckets,
  distributedRateLimitDeps,
} from "@/lib/distributed-rate-limit";

type BucketRecord = {
  scope: string;
  identifier: string;
  windowKey: string;
  count: number;
  resetAt: Date;
};

function createFakeRateLimitPrisma() {
  const buckets = new Map<string, BucketRecord>();
  const keyOf = (scope: string, identifier: string, windowKey: string) => `${scope}:${identifier}:${windowKey}`;

  const rateLimitBucket = {
    findUnique: async ({ where }: { where: { scope_identifier_windowKey: { scope: string; identifier: string; windowKey: string } } }) => {
      const { scope, identifier, windowKey } = where.scope_identifier_windowKey;
      return buckets.get(keyOf(scope, identifier, windowKey)) || null;
    },
    create: async ({ data }: { data: BucketRecord }) => {
      buckets.set(keyOf(data.scope, data.identifier, data.windowKey), { ...data });
      return data;
    },
    update: async ({ where }: { where: { scope_identifier_windowKey: { scope: string; identifier: string; windowKey: string } }; data: { count: { increment: number } } }) => {
      const { scope, identifier, windowKey } = where.scope_identifier_windowKey;
      const key = keyOf(scope, identifier, windowKey);
      const existing = buckets.get(key);

      if (!existing) {
        throw new Error("Bucket ausente.");
      }

      const updated = {
        ...existing,
        count: existing.count + 1,
      };
      buckets.set(key, updated);
      return updated;
    },
    deleteMany: async ({ where }: { where: { resetAt: { lt: Date } } }) => {
      let count = 0;

      for (const [key, bucket] of buckets.entries()) {
        if (bucket.resetAt < where.resetAt.lt) {
          buckets.delete(key);
          count += 1;
        }
      }

      return { count };
    },
  };

  return {
    buckets,
    prisma: {
      $transaction: async <T>(fn: (tx: { rateLimitBucket: typeof rateLimitBucket }) => Promise<T>) => fn({ rateLimitBucket }),
      rateLimitBucket,
    },
  };
}

const originalPrisma = distributedRateLimitDeps.prisma;

test("distributed rate limit creates and enforces bucket windows", async () => {
  const fake = createFakeRateLimitPrisma();
  distributedRateLimitDeps.prisma = fake.prisma as unknown as typeof distributedRateLimitDeps.prisma;
  try {
    const first = await checkDistributedRateLimit({
      scope: "webhook",
      identifier: "client-a",
      windowMs: 60_000,
      maxRequests: 2,
    });
    const second = await checkDistributedRateLimit({
      scope: "webhook",
      identifier: "client-a",
      windowMs: 60_000,
      maxRequests: 2,
    });
    const third = await checkDistributedRateLimit({
      scope: "webhook",
      identifier: "client-a",
      windowMs: 60_000,
      maxRequests: 2,
    });

    assert.equal(first.allowed, true);
    assert.equal(first.remaining, 1);
    assert.equal(second.allowed, true);
    assert.equal(second.remaining, 0);
    assert.equal(third.allowed, false);
    assert.equal(third.remaining, 0);
  } finally {
    distributedRateLimitDeps.prisma = originalPrisma;
  }
});

test("distributed rate limit cleanup removes expired buckets", async () => {
  const fake = createFakeRateLimitPrisma();
  distributedRateLimitDeps.prisma = fake.prisma as unknown as typeof distributedRateLimitDeps.prisma;
  try {
    fake.buckets.set("api:client-b:old", {
      scope: "api",
      identifier: "client-b",
      windowKey: "old",
      count: 1,
      resetAt: new Date("2026-05-23T09:00:00.000Z"),
    });
    fake.buckets.set("api:client-b:new", {
      scope: "api",
      identifier: "client-b",
      windowKey: "new",
      count: 1,
      resetAt: new Date("2026-05-23T11:00:00.000Z"),
    });

    await cleanupDistributedRateLimitBuckets(new Date("2026-05-23T10:00:00.000Z"));

    assert.equal(fake.buckets.has("api:client-b:old"), false);
    assert.equal(fake.buckets.has("api:client-b:new"), true);
  } finally {
    distributedRateLimitDeps.prisma = originalPrisma;
  }
});
