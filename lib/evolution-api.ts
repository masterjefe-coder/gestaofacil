import { withRetryAndCircuitBreaker } from "@/lib/api-retry";
import { getLogger, summarizeExternalErrorDetails } from "@/lib/api-logger";
import { generateIdempotencyKey } from "@/lib/idempotency";

const logger = getLogger({ service: "evolution-api" });

type EvolutionConfig = {
  enabled: boolean;
  defaultInstanceEnabled: boolean;
  baseUrl?: string;
  apiKey?: string;
  instance?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  timeoutMs: number;
};

export class EvolutionApiError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = "EvolutionApiError";
  }
}

export type EvolutionInstanceSummary = {
  instanceName: string;
  instanceId?: string;
  token?: string;
  owner?: string;
  profileName?: string;
  profileStatus?: string;
  status?: string;
  serverUrl?: string;
  apikey?: string;
  integration?: string;
  webhookUrl?: string;
};

type EvolutionFetchInstanceEntry =
  | {
      instance?: {
        instanceName?: string;
        instanceId?: string;
        owner?: string;
        profileName?: string;
        profileStatus?: string;
        status?: string;
        serverUrl?: string;
        apikey?: string;
        token?: string;
        integration?: {
          integration?: string;
          webhook_wa_business?: string;
        };
      };
    }
  | {
      id?: string;
      name?: string;
      connectionStatus?: string;
      ownerJid?: string | null;
      profileName?: string | null;
      profilePicUrl?: string | null;
      integration?: string | null;
      token?: string;
    };

type EvolutionFetchLegacyEntry = Extract<EvolutionFetchInstanceEntry, { instance?: unknown }>;
type EvolutionFetchFlatEntry = Exclude<EvolutionFetchInstanceEntry, EvolutionFetchLegacyEntry>;

function isLegacyEvolutionInstanceEntry(entry: EvolutionFetchInstanceEntry): entry is EvolutionFetchLegacyEntry {
  return "instance" in entry;
}

function parseTimeout(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000;
}

function getConfig(): EvolutionConfig {
  const baseUrl = process.env.EVOLUTION_API_BASE_URL?.trim();
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instance = process.env.EVOLUTION_API_INSTANCE?.trim();
  const webhookUrl = process.env.EVOLUTION_WEBHOOK_URL?.trim();
  const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();

  return {
    enabled: Boolean(baseUrl && apiKey),
    defaultInstanceEnabled: Boolean(baseUrl && apiKey && instance),
    baseUrl,
    apiKey,
    instance,
    webhookUrl,
    webhookSecret,
    timeoutMs: parseTimeout(process.env.EVOLUTION_API_TIMEOUT_MS),
  };
}

function ensureConfig() {
  const config = getConfig();

  if (!config.enabled || !config.baseUrl || !config.apiKey || !config.instance) {
    throw new EvolutionApiError("Integração com Evolution API ainda não está configurada no ambiente.");
  }

  return config;
}

export function normalizeWhatsappNumber(value: string | undefined) {
  const digits = (value || "").replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.startsWith("55")) {
    return digits;
  }

  if (digits.length >= 10 && digits.length <= 11) {
    return `55${digits}`;
  }

  return digits;
}

export function getEvolutionIntegrationStatus() {
  const config = getConfig();

  return {
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    instance: config.instance,
    webhookUrl: config.webhookUrl,
    webhookConfigured: Boolean(config.webhookUrl && config.webhookSecret),
    timeoutMs: config.timeoutMs,
    helper: config.defaultInstanceEnabled
      ? "WhatsApp pronto para enviar mensagens e acompanhar respostas."
      : config.enabled
        ? "O canal já responde, mas ainda falta escolher qual número será o principal."
        : "Conecte o WhatsApp da empresa para liberar mensagens e lembretes automáticos.",
  };
}

async function evolutionRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getConfig();

  if (!config.enabled || !config.baseUrl || !config.apiKey) {
    throw new EvolutionApiError("Integração com Evolution API ainda não está configurada no ambiente.");
  }

  const baseUrl = String(config.baseUrl);
  const apiKey = String(config.apiKey);
  const requestId = generateIdempotencyKey("evolution");

  return withRetryAndCircuitBreaker(
    "evolution-api",
    async () => {
      const headers = new Headers(init?.headers);
      headers.set("apikey", apiKey);
      headers.set("x-request-id", requestId);

      if (init?.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      logger.info("Evolution API request", {
        requestId,
        method: init?.method || "GET",
        path,
      });

      const startTime = Date.now();

      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(config.timeoutMs),
        cache: "no-store",
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const details = await response.text();
        const detailSummary = summarizeExternalErrorDetails(details);
        logger.error("Evolution API request failed", undefined, {
          requestId,
          status: response.status,
          duration,
          detailSummary,
          detailLength: details.length,
        });
        throw new EvolutionApiError(
          detailSummary
            ? `Evolution API recusou a operação (${response.status}). ${detailSummary}`
            : `Evolution API recusou a operação (${response.status}).`,
          response.status
        );
      }

      logger.info("Evolution API request successful", {
        requestId,
        status: response.status,
        duration,
      });

      return response.json() as Promise<T>;
    },
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      retryableStatuses: [408, 429, 500, 502, 503, 504],
    },
    {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
    }
  );
}

function getWebhookConfig() {
  const config = getConfig();

  if (!config.webhookUrl || !config.webhookSecret) {
    return null;
  }

  return {
    enabled: true,
    url: config.webhookUrl,
    byEvents: false,
    base64: false,
    headers: {
      authorization: `Bearer ${config.webhookSecret}`,
      "Content-Type": "application/json",
    },
    events: [
      "QRCODE_UPDATED",
      "CONNECTION_UPDATE",
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "SEND_MESSAGE",
    ],
  };
}

export async function fetchEvolutionInstances(): Promise<EvolutionInstanceSummary[]> {
  const payload = await evolutionRequest<EvolutionFetchInstanceEntry[]>("/instance/fetchInstances", {
    method: "GET",
  });

  return payload
    .map((entry) => {
      if (isLegacyEvolutionInstanceEntry(entry) && entry.instance) {
        return {
          instanceName: entry.instance.instanceName || "",
          instanceId: entry.instance.instanceId,
          token: entry.instance.token,
          owner: entry.instance.owner,
          profileName: entry.instance.profileName,
          profileStatus: entry.instance.profileStatus,
          status: entry.instance.status,
          serverUrl: entry.instance.serverUrl,
          apikey: entry.instance.apikey,
          integration: entry.instance.integration?.integration,
          webhookUrl: entry.instance.integration?.webhook_wa_business,
        } satisfies EvolutionInstanceSummary;
      }

      const flatEntry = entry as EvolutionFetchFlatEntry;

      return {
        instanceName: flatEntry.name || "",
        instanceId: flatEntry.id,
        token: flatEntry.token,
        owner: flatEntry.ownerJid || undefined,
        profileName: flatEntry.profileName || undefined,
        status: flatEntry.connectionStatus || undefined,
        integration: flatEntry.integration || undefined,
      } satisfies EvolutionInstanceSummary;
    })
    .filter((instance) => Boolean(instance.instanceName));
}

export async function createEvolutionInstance(input: { instanceName: string; number?: string }) {
  const webhook = getWebhookConfig();

  return evolutionRequest<unknown>("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: input.instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: false,
      number: input.number || undefined,
      rejectCall: true,
      msgCall: "No momento não consigo atender ligação por aqui. Me chama por mensagem que sigo com você.",
      groupsIgnore: true,
      alwaysOnline: false,
      readMessages: false,
      readStatus: true,
      syncFullHistory: false,
      webhook: webhook || undefined,
    }),
  });
}

export async function connectEvolutionInstance(instanceName: string) {
  return evolutionRequest<{ pairingCode?: string; code?: string; base64?: string; count?: number }>(
    `/instance/connect/${encodeURIComponent(instanceName)}`,
    { method: "GET" },
  );
}

export async function getEvolutionConnectionState(instanceName: string) {
  return evolutionRequest<{ instance?: { state?: string; statusReason?: number } }>(
    `/instance/connectionState/${encodeURIComponent(instanceName)}`,
    { method: "GET" },
  );
}

export async function deleteEvolutionInstance(instanceName: string) {
  return evolutionRequest<{ status?: string; error?: boolean; response?: { message?: string } }>(
    `/instance/delete/${encodeURIComponent(instanceName)}`,
    { method: "DELETE" },
  );
}

export async function probeEvolutionApi() {
  const config = getConfig();

  if (!config.enabled || !config.baseUrl) {
    return {
      configured: false,
      reachable: false,
      summary: "Integração ainda não configurada neste ambiente.",
    };
  }

  try {
    const headers = config.apiKey ? { apikey: config.apiKey } : undefined;
    const response = await fetch(new URL("/instance/fetchInstances", config.baseUrl).toString(), {
      method: "GET",
      ...(headers ? { headers } : {}),
      signal: AbortSignal.timeout(config.timeoutMs),
      cache: "no-store",
    });

    return {
      configured: true,
      reachable: response.ok,
      summary: response.ok
        ? "A Evolution respondeu ao endpoint autenticado e a integração está acessível a partir do app."
        : `A Evolution respondeu ao endpoint autenticado com status ${response.status}.`,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      summary: error instanceof Error ? error.message : "Falha ao alcançar a Evolution API.",
    };
  }
}

export async function sendEvolutionTextMessage(input: {
  number: string;
  text: string;
  idempotencyKey?: string;
}) {
  const config = ensureConfig();
  const instance = String(config.instance);
  const normalizedNumber = normalizeWhatsappNumber(input.number);

  if (!normalizedNumber) {
    throw new EvolutionApiError("Cliente sem número de WhatsApp válido para envio.");
  }

  const idempotencyKey = input.idempotencyKey || generateIdempotencyKey("evolution-msg");

  logger.info("Sending Evolution text message", {
    idempotencyKey,
    number: normalizedNumber,
    textLength: input.text.length,
  });

  return evolutionRequest(`/message/sendText/${instance}`, {
    method: "POST",
    body: JSON.stringify({
      number: normalizedNumber,
      text: input.text,
    }),
    headers: {
      "x-idempotency-key": idempotencyKey,
    },
  });
}
