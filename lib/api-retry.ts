/**
 * API Retry Utility with Exponential Backoff and Circuit Breaker
 * 
 * Provides resilient API call handling with:
 * - Configurable retry attempts with exponential backoff
 * - Circuit breaker pattern to prevent cascading failures
 * - Jitter to prevent thundering herd
 */

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError?: Error
  ) {
    super(message);
    this.name = "RetryError";
  }
}

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

type RetryConfig = {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitterMs?: number;
  retryableStatuses?: number[];
  shouldRetry?: (error: unknown) => boolean;
};

type CircuitBreakerConfig = {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxAttempts?: number;
};

enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;

  constructor(private config: Required<CircuitBreakerConfig>) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
      } else {
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN. Will retry after ${Math.ceil((this.config.resetTimeoutMs - (now - this.lastFailureTime)) / 1000)}s`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
    }
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        this.state = CircuitState.OPEN;
      }
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(name: string, config: CircuitBreakerConfig): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(
      name,
      new CircuitBreaker({
        failureThreshold: config.failureThreshold ?? 5,
        resetTimeoutMs: config.resetTimeoutMs ?? 60000,
        halfOpenMaxAttempts: config.halfOpenMaxAttempts ?? 3,
      })
    );
  }
  return circuitBreakers.get(name)!;
}

function calculateDelay(attempt: number, config: Required<RetryConfig>): number {
  const exponentialDelay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelayMs
  );
  const jitter = Math.random() * config.jitterMs;
  return exponentialDelay + jitter;
}

function isRetryableError(error: unknown, config: Required<RetryConfig>): boolean {
  if (config.shouldRetry !== defaultShouldRetry) {
    return config.shouldRetry(error);
  }

  if (error instanceof CircuitBreakerError) {
    return false;
  }

  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    return config.retryableStatuses.includes(status);
  }

  // Retry on network errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("fetch failed")
    );
  }

  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultShouldRetry(error: unknown): boolean {
  void error;
  return false;
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const fullConfig: Required<RetryConfig> = {
    maxAttempts: config.maxAttempts ?? 3,
    initialDelayMs: config.initialDelayMs ?? 1000,
    maxDelayMs: config.maxDelayMs ?? 30000,
    backoffMultiplier: config.backoffMultiplier ?? 2,
    jitterMs: config.jitterMs ?? 100,
    retryableStatuses: config.retryableStatuses ?? [408, 429, 500, 502, 503, 504],
    shouldRetry: config.shouldRetry ?? defaultShouldRetry,
  };

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === fullConfig.maxAttempts || !isRetryableError(error, fullConfig)) {
        throw new RetryError(
          `Failed after ${attempt} attempt(s): ${lastError.message}`,
          attempt,
          lastError
        );
      }

      const delay = calculateDelay(attempt, fullConfig);
      await sleep(delay);
    }
  }

  throw new RetryError(
    `Failed after ${fullConfig.maxAttempts} attempts`,
    fullConfig.maxAttempts,
    lastError
  );
}

/**
 * Execute a function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  config: CircuitBreakerConfig = {}
): Promise<T> {
  const breaker = getCircuitBreaker(name, config);
  return breaker.execute(fn);
}

/**
 * Execute a function with both retry logic and circuit breaker protection
 */
export async function withRetryAndCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  retryConfig: RetryConfig = {},
  circuitConfig: CircuitBreakerConfig = {}
): Promise<T> {
  return withCircuitBreaker(name, () => withRetry(fn, retryConfig), circuitConfig);
}

/**
 * Get circuit breaker state for monitoring
 */
export function getCircuitBreakerState(name: string) {
  const breaker = circuitBreakers.get(name);
  return breaker ? breaker.getState() : null;
}

/**
 * Get all circuit breaker states for monitoring
 */
export function getAllCircuitBreakerStates() {
  const states: Record<string, ReturnType<CircuitBreaker["getState"]>> = {};
  for (const [name, breaker] of circuitBreakers.entries()) {
    states[name] = breaker.getState();
  }
  return states;
}

// Made with Bob
