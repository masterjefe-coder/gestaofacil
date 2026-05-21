import { prisma } from "@/lib/prisma";

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

export class AuthRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = "AuthRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function describeRetryAfter(seconds: number) {
  if (seconds <= 60) {
    return `${seconds}s`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `${minutes} min`;
}

export async function assertLoginAttemptAllowed(identifierInput: string) {
  const identifier = normalizeIdentifier(identifierInput);

  if (!identifier) {
    return;
  }

  const record = await prisma.authThrottle.findUnique({
    where: { identifier },
  });

  if (!record?.lockedUntil) {
    return;
  }

  const now = Date.now();
  const lockedUntil = record.lockedUntil.getTime();

  if (lockedUntil <= now) {
    await prisma.authThrottle.update({
      where: { id: record.id },
      data: {
        attemptCount: 0,
        lockedUntil: null,
        firstAttemptAt: new Date(),
        lastAttemptAt: new Date(),
      },
    });
    return;
  }

  throw new AuthRateLimitError(
    "Muitas tentativas de login. Aguarde antes de tentar novamente.",
    Math.ceil((lockedUntil - now) / 1000),
  );
}

export async function registerFailedLoginAttempt(identifierInput: string) {
  const identifier = normalizeIdentifier(identifierInput);

  if (!identifier) {
    return null;
  }

  const now = new Date();
  const existing = await prisma.authThrottle.findUnique({
    where: { identifier },
  });

  if (!existing) {
    return prisma.authThrottle.create({
      data: {
        identifier,
        attemptCount: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      },
    });
  }

  const withinWindow = now.getTime() - existing.firstAttemptAt.getTime() <= ATTEMPT_WINDOW_MS;
  const attemptCount = withinWindow ? existing.attemptCount + 1 : 1;
  const shouldLock = attemptCount >= MAX_ATTEMPTS;

  return prisma.authThrottle.update({
    where: { id: existing.id },
    data: {
      attemptCount,
      firstAttemptAt: withinWindow ? existing.firstAttemptAt : now,
      lastAttemptAt: now,
      lockedUntil: shouldLock ? new Date(now.getTime() + LOCK_WINDOW_MS) : existing.lockedUntil,
    },
  });
}

export async function clearFailedLoginAttempts(identifierInput: string) {
  const identifier = normalizeIdentifier(identifierInput);

  if (!identifier) {
    return;
  }

  await prisma.authThrottle.deleteMany({
    where: { identifier },
  });
}
