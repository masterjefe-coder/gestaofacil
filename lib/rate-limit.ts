import { NextRequest, NextResponse } from "next/server";

/**
 * In-memory rate limiter using a Map
 * For production, consider using Redis (Upstash) for distributed rate limiting
 */
class RateLimiter {
  private requests: Map<string, { count: number; resetAt: number }>;
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 60) {
    this.requests = new Map();
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Check if a request should be rate limited
   * @param identifier Unique identifier (IP, user ID, etc.)
   * @returns Object with allowed status and remaining requests
   */
  check(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const record = this.requests.get(identifier);

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      this.cleanup(now);
    }

    if (!record || now > record.resetAt) {
      // New window
      const resetAt = now + this.windowMs;
      this.requests.set(identifier, { count: 1, resetAt });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt };
    }

    if (record.count >= this.maxRequests) {
      // Rate limit exceeded
      return { allowed: false, remaining: 0, resetAt: record.resetAt };
    }

    // Increment count
    record.count++;
    this.requests.set(identifier, record);
    return { allowed: true, remaining: this.maxRequests - record.count, resetAt: record.resetAt };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(now: number): void {
    for (const [key, value] of this.requests.entries()) {
      if (now > value.resetAt) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Reset rate limit for a specific identifier
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * Get current stats for an identifier
   */
  getStats(identifier: string): { count: number; resetAt: number } | null {
    return this.requests.get(identifier) || null;
  }
}

// Rate limiter instances for different endpoint types
const rateLimiters = {
  // Strict limits for authentication endpoints
  auth: new RateLimiter(15 * 60 * 1000, 5), // 5 requests per 15 minutes
  
  // Moderate limits for API endpoints
  api: new RateLimiter(60 * 1000, 60), // 60 requests per minute
  
  // Generous limits for webhooks (external services)
  webhook: new RateLimiter(60 * 1000, 100), // 100 requests per minute
  
  // Very strict limits for password reset
  passwordReset: new RateLimiter(60 * 60 * 1000, 3), // 3 requests per hour
  
  // Moderate limits for general endpoints
  general: new RateLimiter(60 * 1000, 100), // 100 requests per minute
};

/**
 * Get client identifier from request
 * Uses IP address, with fallback to user agent
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from headers (for proxies/load balancers)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  
  const ip = cfConnectingIp || realIp || forwardedFor?.split(",")[0] || "unknown";
  
  // For additional uniqueness, include user agent hash
  const userAgent = request.headers.get("user-agent") || "unknown";
  
  return `${ip}:${hashString(userAgent)}`;
}

/**
 * Simple hash function for strings
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Rate limit middleware for API routes
 * @param request NextRequest object
 * @param type Type of rate limiter to use
 * @returns NextResponse if rate limited, null if allowed
 */
export function rateLimit(
  request: NextRequest,
  type: keyof typeof rateLimiters = "general"
): NextResponse | null {
  const identifier = getClientIdentifier(request);
  const limiter = rateLimiters[type];
  const result = limiter.check(identifier);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    
    return NextResponse.json(
      {
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": limiter["maxRequests"].toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(result.resetAt).toISOString(),
        },
      }
    );
  }

  return null;
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  request: NextRequest,
  type: keyof typeof rateLimiters = "general"
): NextResponse {
  const identifier = getClientIdentifier(request);
  const limiter = rateLimiters[type];
  const stats = limiter.getStats(identifier);

  if (stats) {
    response.headers.set("X-RateLimit-Limit", limiter["maxRequests"].toString());
    response.headers.set("X-RateLimit-Remaining", (limiter["maxRequests"] - stats.count).toString());
    response.headers.set("X-RateLimit-Reset", new Date(stats.resetAt).toISOString());
  }

  return response;
}

/**
 * Wrapper function to apply rate limiting to API route handlers
 */
export function withRateLimit(
  handler: (request: NextRequest, ...args: unknown[]) => Promise<NextResponse>,
  type: keyof typeof rateLimiters = "general"
): (request: NextRequest, ...args: unknown[]) => Promise<NextResponse> {
  return async (request: NextRequest, ...args: unknown[]) => {
    const rateLimitResponse = rateLimit(request, type);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const response = await handler(request, ...args);
    return addRateLimitHeaders(response, request, type);
  };
}

/**
 * Reset rate limit for testing purposes
 */
export function resetRateLimit(identifier: string, type: keyof typeof rateLimiters = "general"): void {
  rateLimiters[type].reset(identifier);
}

/**
 * Get rate limiter stats for monitoring
 */
export function getRateLimiterStats() {
  return {
    auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
    api: { windowMs: 60 * 1000, maxRequests: 60 },
    webhook: { windowMs: 60 * 1000, maxRequests: 100 },
    passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 3 },
    general: { windowMs: 60 * 1000, maxRequests: 100 },
  };
}

// Made with Bob
