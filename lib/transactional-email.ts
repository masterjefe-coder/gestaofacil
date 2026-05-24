import { withRetryAndCircuitBreaker } from "@/lib/api-retry";
import { getLogger, summarizeExternalErrorDetails } from "@/lib/api-logger";

type TransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type TransactionalEmailStatus = {
  enabled: boolean;
  apiKeyConfigured: boolean;
  fromConfigured: boolean;
  fromAddress?: string;
  fromDisplayName?: string;
  helper: string;
};

const logger = getLogger({ service: "transactional-email" });

export const transactionalEmailDeps = {
  fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
};

export function parseEmailFromAddress(value: string | undefined) {
  const normalized = value?.trim() || "";

  if (!normalized) {
    return {
      valid: false as const,
      address: undefined,
      displayName: undefined,
    };
  }

  const match = normalized.match(/^(?:(.+?)\s*<)?([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>?$/);

  if (!match) {
    return {
      valid: false as const,
      address: undefined,
      displayName: undefined,
    };
  }

  return {
    valid: true as const,
    address: match[2].trim().toLowerCase(),
    displayName: match[1]?.trim() || undefined,
  };
}

export function getTransactionalEmailStatus(): TransactionalEmailStatus {
  const apiKeyConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const from = parseEmailFromAddress(process.env.EMAIL_FROM);
  const fromConfigured = from.valid;
  const enabled = apiKeyConfigured && fromConfigured;

  return {
    enabled,
    apiKeyConfigured,
    fromConfigured,
    fromAddress: from.address,
    fromDisplayName: from.displayName,
    helper: enabled
      ? "Email transacional pronto para convites, recuperacao de senha e alertas."
      : "Configure RESEND_API_KEY e um EMAIL_FROM valido para liberar envios transacionais.",
  };
}

export function isTransactionalEmailConfigured() {
  return getTransactionalEmailStatus().enabled;
}

export async function sendTransactionalEmail(input: TransactionalEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = parseEmailFromAddress(process.env.EMAIL_FROM);

  if (!apiKey || !from.valid || !from.address) {
    throw new Error("Configure RESEND_API_KEY e EMAIL_FROM para envio transacional.");
  }

  return withRetryAndCircuitBreaker(
    "transactional-email",
    async () => {
      logger.info("Transactional email request", {
        to: input.to,
        subject: input.subject,
        fromAddress: from.address,
      });

      const response = await transactionalEmailDeps.fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM?.trim(),
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
        cache: "no-store",
      });

      const body = await response.json().catch(() => null) as {
        id?: string;
        message?: string;
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        const detail = body?.error?.message || body?.message || `Falha no envio transacional (${response.status}).`;
        const error = new Error(detail) as Error & { status?: number };
        error.status = response.status;

        logger.error("Transactional email request failed", error, {
          to: input.to,
          subject: input.subject,
          fromAddress: from.address,
          status: response.status,
          detailSummary: summarizeExternalErrorDetails(detail),
        });

        throw error;
      }

      logger.info("Transactional email sent", {
        to: input.to,
        subject: input.subject,
        fromAddress: from.address,
        emailId: body?.id || null,
      });

      return {
        id: body?.id || null,
      };
    },
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      retryableStatuses: [408, 429, 500, 502, 503, 504],
    },
    {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
    },
  );
}
