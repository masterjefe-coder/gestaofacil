/**
 * Idempotency Key Management
 * 
 * Provides idempotency key generation and tracking to prevent duplicate operations:
 * - Generate unique idempotency keys
 * - Track processed keys to prevent duplicates
 * - Automatic expiration of old keys
 * - Support for different operation types
 */

import { randomUUID } from "crypto";
import { createHash } from "crypto";

type IdempotencyRecord = {
  key: string;
  operationType: string;
  result?: unknown;
  createdAt: number;
  expiresAt: number;
};

// In-memory store (should be replaced with Redis in production)
const idempotencyStore = new Map<string, IdempotencyRecord>();

// Default TTL: 24 hours
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a unique idempotency key
 */
export function generateIdempotencyKey(prefix?: string): string {
  const uuid = randomUUID();
  return prefix ? `${prefix}-${uuid}` : uuid;
}

/**
 * Generate a deterministic idempotency key from input data
 * Useful for ensuring the same input always generates the same key
 */
export function generateDeterministicKey(
  operationType: string,
  data: Record<string, unknown>
): string {
  const sortedData = Object.keys(data)
    .sort()
    .reduce((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {} as Record<string, unknown>);

  const dataString = JSON.stringify(sortedData);
  const hash = createHash("sha256").update(dataString).digest("hex");
  
  return `${operationType}-${hash.slice(0, 16)}`;
}

/**
 * Check if an idempotency key has been processed
 */
export function isKeyProcessed(key: string): boolean {
  cleanupExpiredKeys();
  return idempotencyStore.has(key);
}

/**
 * Get the result of a previously processed idempotency key
 */
export function getProcessedResult<T = unknown>(key: string): T | null {
  cleanupExpiredKeys();
  const record = idempotencyStore.get(key);
  return record ? (record.result as T) : null;
}

/**
 * Mark an idempotency key as processed with its result
 */
export function markKeyProcessed(
  key: string,
  operationType: string,
  result?: unknown,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  const now = Date.now();
  const record: IdempotencyRecord = {
    key,
    operationType,
    result,
    createdAt: now,
    expiresAt: now + ttlMs,
  };
  
  idempotencyStore.set(key, record);
}

/**
 * Remove expired idempotency keys
 */
function cleanupExpiredKeys(): void {
  const now = Date.now();
  for (const [key, record] of idempotencyStore.entries()) {
    if (record.expiresAt < now) {
      idempotencyStore.delete(key);
    }
  }
}

/**
 * Clear all idempotency keys (useful for testing)
 */
export function clearAllKeys(): void {
  idempotencyStore.clear();
}

/**
 * Get statistics about idempotency store
 */
export function getIdempotencyStats() {
  cleanupExpiredKeys();
  return {
    totalKeys: idempotencyStore.size,
    oldestKey: Array.from(idempotencyStore.values())
      .sort((a, b) => a.createdAt - b.createdAt)[0]?.createdAt,
    newestKey: Array.from(idempotencyStore.values())
      .sort((a, b) => b.createdAt - a.createdAt)[0]?.createdAt,
  };
}

/**
 * Wrapper for idempotent operations
 * Automatically handles key checking and result caching
 */
export async function withIdempotency<T>(
  key: string,
  operationType: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<{ result: T; wasProcessed: boolean }> {
  // Check if already processed
  if (isKeyProcessed(key)) {
    const cachedResult = getProcessedResult<T>(key);
    if (cachedResult !== null) {
      return { result: cachedResult, wasProcessed: true };
    }
  }

  // Execute the operation
  const result = await fn();

  // Store the result
  markKeyProcessed(key, operationType, result, ttlMs);

  return { result, wasProcessed: false };
}

/**
 * Extract idempotency key from request headers
 */
export function extractIdempotencyKey(headers: Headers | Record<string, string>): string | null {
  if (headers instanceof Headers) {
    return headers.get("idempotency-key") || headers.get("x-idempotency-key");
  }
  return headers["idempotency-key"] || headers["x-idempotency-key"] || null;
}

/**
 * Validate idempotency key format
 */
export function isValidIdempotencyKey(key: string): boolean {
  // Must be between 1 and 255 characters
  if (!key || key.length < 1 || key.length > 255) {
    return false;
  }

  // Must contain only alphanumeric characters, hyphens, and underscores
  return /^[a-zA-Z0-9_-]+$/.test(key);
}

/**
 * Create idempotency middleware for API routes
 */
export function createIdempotencyMiddleware(operationType: string) {
  return async function <T>(
    request: Request,
    handler: () => Promise<T>
  ): Promise<{ result: T; wasProcessed: boolean; idempotencyKey: string }> {
    // Extract or generate idempotency key
    let idempotencyKey = extractIdempotencyKey(request.headers);
    
    if (!idempotencyKey) {
      idempotencyKey = generateIdempotencyKey(operationType);
    } else if (!isValidIdempotencyKey(idempotencyKey)) {
      throw new Error("Invalid idempotency key format");
    }

    // Execute with idempotency
    const { result, wasProcessed } = await withIdempotency(
      idempotencyKey,
      operationType,
      handler
    );

    return { result, wasProcessed, idempotencyKey };
  };
}

// Keep background cleanup from blocking process shutdown in CLI/test contexts.
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(cleanupExpiredKeys, 60 * 60 * 1000);

  if (typeof cleanupTimer === "object" && cleanupTimer !== null && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// Made with Bob
