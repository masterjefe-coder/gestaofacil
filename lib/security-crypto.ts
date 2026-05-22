import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Timing-safe string comparison to prevent timing attacks
 * @param a First string to compare
 * @param b Second string to compare
 * @returns true if strings are equal, false otherwise
 */
export function timingSafeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) {
    return false;
  }

  try {
    const bufferA = Buffer.from(a, "utf8");
    const bufferB = Buffer.from(b, "utf8");

    // If lengths differ, use a dummy comparison to maintain constant time
    if (bufferA.length !== bufferB.length) {
      // Compare against a buffer of the same length as bufferA to maintain timing
      timingSafeEqual(bufferA, Buffer.alloc(bufferA.length));
      return false;
    }

    return timingSafeEqual(bufferA, bufferB);
  } catch {
    return false;
  }
}

/**
 * Generate HMAC signature for webhook verification
 * @param payload The payload to sign (string or object)
 * @param secret The secret key
 * @returns HMAC signature as hex string
 */
export function generateHmacSignature(payload: string | Record<string, unknown>, secret: string): string {
  const data = typeof payload === "string" ? payload : JSON.stringify(payload);
  return createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

/**
 * Verify HMAC signature for webhook
 * @param payload The payload to verify
 * @param signature The received signature
 * @param secret The secret key
 * @returns true if signature is valid
 */
export function verifyHmacSignature(
  payload: string | Record<string, unknown>,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateHmacSignature(payload, secret);
  return timingSafeCompare(signature, expectedSignature);
}

/**
 * Verify webhook timestamp to prevent replay attacks
 * @param timestamp The timestamp from the webhook (ISO string or Unix timestamp)
 * @param maxAgeSeconds Maximum age in seconds (default: 5 minutes)
 * @returns true if timestamp is within acceptable range
 */
export function verifyWebhookTimestamp(
  timestamp: string | number | null | undefined,
  maxAgeSeconds: number = 300
): boolean {
  if (!timestamp) {
    return false;
  }

  try {
    const webhookTime = typeof timestamp === "number" 
      ? timestamp * 1000 // Convert Unix timestamp to milliseconds
      : new Date(timestamp).getTime();

    if (!Number.isFinite(webhookTime)) {
      return false;
    }

    const now = Date.now();
    const age = Math.abs(now - webhookTime);

    return age <= maxAgeSeconds * 1000;
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure random token
 * @param length Length of the token in bytes (default: 32)
 * @returns Hex string token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

/**
 * Generate CSRF token
 * @returns CSRF token string
 */
export function generateCsrfToken(): string {
  return generateSecureToken(32);
}

/**
 * Verify CSRF token
 * @param token The token to verify
 * @param expectedToken The expected token
 * @returns true if tokens match
 */
export function verifyCsrfToken(token: string | null | undefined, expectedToken: string | null | undefined): boolean {
  return timingSafeCompare(token, expectedToken);
}

// Made with Bob
