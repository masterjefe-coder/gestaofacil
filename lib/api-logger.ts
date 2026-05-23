/**
 * Structured API Logging Utility
 * 
 * Provides comprehensive logging for API requests and responses with:
 * - Request ID tracking for correlation
 * - Structured log format for easy parsing
 * - Log levels (DEBUG, INFO, WARN, ERROR)
 * - Performance metrics
 * - Sensitive data masking
 */

import { randomUUID } from "crypto";

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

type LogContext = {
  requestId?: string;
  correlationId?: string;
  userId?: string;
  workspaceId?: string;
  [key: string]: unknown;
};

type ApiLogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
};

type ApiRequestLog = {
  requestId: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  startTime: number;
};

type ApiResponseLog = {
  requestId: string;
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  duration: number;
  error?: Error;
};

const SENSITIVE_HEADERS = [
  "authorization",
  "apikey",
  "access_token",
  "x-api-key",
  "cookie",
  "set-cookie",
];

const SENSITIVE_FIELDS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "accessToken",
  "refreshToken",
  "cpfCnpj",
  "cpf",
  "cnpj",
  "creditCard",
  "cvv",
];

function maskSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    // Mask if it looks like a token or key
    if (data.length > 20 && /^[A-Za-z0-9_-]+$/.test(data)) {
      return `${data.slice(0, 4)}...${data.slice(-4)}`;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }

  if (typeof data === "object") {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
        masked[key] = "***MASKED***";
      } else {
        masked[key] = maskSensitiveData(value);
      }
    }
    return masked;
  }

  return data;
}

function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      masked[key] = "***MASKED***";
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export function summarizeExternalErrorDetails(
  value: string | null | undefined,
  maxLength = 240,
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  const masked = maskSensitiveData(normalized);
  const safeValue = typeof masked === "string" ? masked : normalized;

  if (safeValue.length <= maxLength) {
    return safeValue;
  }

  return `${safeValue.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatLogEntry(entry: ApiLogEntry): string {
  return JSON.stringify(entry);
}

function shouldLog(level: LogLevel): boolean {
  const configuredLevel = process.env.LOG_LEVEL?.toUpperCase() || "INFO";
  const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
  const configuredIndex = levels.indexOf(configuredLevel as LogLevel);
  const currentIndex = levels.indexOf(level);
  return currentIndex >= configuredIndex;
}

class ApiLogger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, error?: Error) {
    if (!shouldLog(level)) {
      return;
    }

    const entry: ApiLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      metadata: metadata ? maskSensitiveData(metadata) as Record<string, unknown> : undefined,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
          }
        : undefined,
    };

    const formatted = formatLogEntry(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  debug(message: string, metadata?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, metadata, error);
  }

  logApiRequest(request: Omit<ApiRequestLog, "requestId" | "startTime">): string {
    const requestId = this.context.requestId || randomUUID();

    this.info("API Request", {
      requestId,
      method: request.method,
      url: request.url,
      headers: request.headers ? maskHeaders(request.headers) : undefined,
      body: request.body ? maskSensitiveData(request.body) : undefined,
    });

    return requestId;
  }

  logApiResponse(response: ApiResponseLog) {
    const level = response.error ? LogLevel.ERROR : response.status >= 400 ? LogLevel.WARN : LogLevel.INFO;

    this.log(
      level,
      response.error ? "API Request Failed" : "API Response",
      {
        requestId: response.requestId,
        status: response.status,
        duration: `${response.duration}ms`,
        headers: response.headers ? maskHeaders(response.headers) : undefined,
        body: response.body ? maskSensitiveData(response.body) : undefined,
      },
      response.error
    );
  }

  child(additionalContext: LogContext): ApiLogger {
    return new ApiLogger({ ...this.context, ...additionalContext });
  }
}

// Global logger instance
let globalLogger: ApiLogger | null = null;

export function getLogger(context?: LogContext): ApiLogger {
  if (context) {
    return new ApiLogger(context);
  }
  if (!globalLogger) {
    globalLogger = new ApiLogger();
  }
  return globalLogger;
}

export function createRequestLogger(requestId?: string): ApiLogger {
  return getLogger({ requestId: requestId || randomUUID() });
}

/**
 * Wrapper for API calls with automatic logging
 */
export async function withApiLogging<T>(
  name: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const logger = getLogger(context);
  const requestId = randomUUID();
  const startTime = Date.now();

  logger.info(`${name} - Starting`, { requestId });

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    logger.info(`${name} - Success`, {
      requestId,
      durationMs: duration,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(
      `${name} - Failed`,
      error instanceof Error ? error : new Error(String(error)),
      {
        requestId,
        durationMs: duration,
      }
    );

    throw error;
  }
}

export { ApiLogger };

// Made with Bob
