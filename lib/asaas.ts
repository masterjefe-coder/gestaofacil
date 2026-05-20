import { parseCurrencyToNumber } from "@/lib/demo-data-codecs";
import type { ExternalChargeBilling } from "@/lib/types";

type AsaasEnvironment = "sandbox" | "production";
type AsaasBillingType = "PIX" | "UNDEFINED" | "BOLETO";

type AsaasCustomer = {
  id: string;
};

type AsaasPayment = {
  id: string;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
};

type AsaasPixQrCode = {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
};

type AsaasListResponse<T> = {
  data?: T[];
};

type AsaasErrorResponse = {
  errors?: Array<{
    code?: string;
    description?: string;
  }>;
};

export class AsaasApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsaasApiError";
  }
}

function getAsaasConfig() {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  const environment = (process.env.ASAAS_ENVIRONMENT?.trim().toLowerCase() === "production" ? "production" : "sandbox") as AsaasEnvironment;
  const baseUrl = environment === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
  const enabled = Boolean(apiKey);

  return {
    apiKey,
    environment,
    baseUrl,
    enabled,
  };
}

function resolveAppBaseUrl() {
  const explicit = process.env.APP_BASE_URL?.trim();

  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const evolutionWebhookUrl = process.env.EVOLUTION_WEBHOOK_URL?.trim();

  if (evolutionWebhookUrl) {
    try {
      return new URL(evolutionWebhookUrl).origin;
    } catch {
      return null;
    }
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }

  return null;
}

export function getAsaasIntegrationStatus() {
  const config = getAsaasConfig();
  const webhookToken = process.env.ASAAS_WEBHOOK_AUTH_TOKEN?.trim();
  const appBaseUrl = resolveAppBaseUrl();
  const webhookUrl = appBaseUrl ? `${appBaseUrl}/api/asaas/webhook` : null;

  return {
    enabled: config.enabled,
    environment: config.environment,
    webhookConfigured: Boolean(webhookToken && webhookUrl),
    webhookUrl,
    webhookTokenConfigured: Boolean(webhookToken),
    helper: config.enabled
      ? `Asaas configurado em ${config.environment === "production" ? "producao" : "sandbox"}.`
      : "Asaas ainda nao configurado neste ambiente.",
  };
}

function normalizeDigits(value: string | undefined) {
  return (value || "").replace(/\D/g, "");
}

function truncate(value: string, max: number) {
  return value.length > max ? value.slice(0, max) : value;
}

function resolveBillingType(paymentMethod: string): AsaasBillingType {
  const normalized = paymentMethod.toLowerCase();

  if (normalized.includes("boleto")) {
    return "BOLETO";
  }

  if (normalized.includes("link")) {
    return "UNDEFINED";
  }

  return "PIX";
}

async function parseAsaasResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & AsaasErrorResponse) | null;

  if (!response.ok) {
    const message = body?.errors?.map((item) => item.description || item.code).filter(Boolean).join(" | ")
      || `Falha na API do Asaas (${response.status}).`;
    throw new AsaasApiError(message);
  }

  if (!body) {
    throw new AsaasApiError("API do Asaas respondeu sem corpo JSON.");
  }

  return body as T;
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getAsaasConfig();

  if (!config.apiKey) {
    throw new AsaasApiError("ASAAS_API_KEY nao configurada.");
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      "access_token": config.apiKey,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  return parseAsaasResponse<T>(response);
}

async function findAsaasCustomer(externalReference: string, document?: string): Promise<AsaasCustomer | null> {
  const params = new URLSearchParams({
    externalReference,
    limit: "1",
    offset: "0",
  });

  const documentDigits = normalizeDigits(document);

  if (documentDigits) {
    params.set("cpfCnpj", documentDigits);
  }

  const response = await asaasFetch<AsaasListResponse<AsaasCustomer>>(`/customers?${params.toString()}`, {
    method: "GET",
  });

  return response.data?.[0] || null;
}

async function ensureAsaasCustomer(input: {
  externalReference: string;
  name: string;
  document?: string;
  phone?: string;
}): Promise<AsaasCustomer> {
  const existing = await findAsaasCustomer(input.externalReference, input.document);

  if (existing) {
    return existing;
  }

  const documentDigits = normalizeDigits(input.document);
  const mobilePhone = normalizeDigits(input.phone);

  if (!documentDigits) {
    throw new AsaasApiError(`Cliente ${input.name} ainda nao possui CPF/CNPJ para criar cobranca no Asaas.`);
  }

  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: truncate(input.name, 100),
      cpfCnpj: documentDigits,
      mobilePhone: mobilePhone || undefined,
      externalReference: input.externalReference,
      notificationDisabled: false,
    }),
  });
}

async function createAsaasPayment(input: {
  customerId: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
}): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: input.value,
      dueDate: input.dueDate,
      description: truncate(input.description, 500),
      externalReference: input.externalReference,
    }),
  });
}

async function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasFetch<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`, {
    method: "GET",
  });
}

export async function createAsaasCharge(input: {
  externalReference: string;
  customerReference: string;
  customerName: string;
  customerDocument?: string;
  customerPhone?: string;
  amount: string;
  dueDate?: string;
  description: string;
  paymentMethod: string;
}): Promise<{ paymentLink?: string; externalBilling: ExternalChargeBilling }> {
  const config = getAsaasConfig();

  if (!config.enabled) {
    throw new AsaasApiError("Asaas ainda nao esta configurado neste ambiente.");
  }

  const dueDate = input.dueDate || new Date().toISOString().slice(0, 10);
  const billingType = resolveBillingType(input.paymentMethod);
  const customer = await ensureAsaasCustomer({
    externalReference: input.customerReference,
    name: input.customerName,
    document: input.customerDocument,
    phone: input.customerPhone,
  });
  const payment = await createAsaasPayment({
    customerId: customer.id,
    billingType,
    value: parseCurrencyToNumber(input.amount),
    dueDate,
    description: input.description,
    externalReference: input.externalReference,
  });

  let pixQrCode: AsaasPixQrCode | null = null;

  if (billingType === "PIX") {
    pixQrCode = await getPixQrCode(payment.id);
  }

  const paymentLink = payment.invoiceUrl || payment.bankSlipUrl || undefined;

  return {
    paymentLink,
    externalBilling: {
      provider: "Asaas",
      environment: config.environment,
      customerId: customer.id,
      paymentId: payment.id,
      billingType,
      invoiceUrl: payment.invoiceUrl || undefined,
      bankSlipUrl: payment.bankSlipUrl || undefined,
      pixCopyPaste: pixQrCode?.payload,
      pixQrCodeBase64: pixQrCode?.encodedImage,
      pixExpirationDate: pixQrCode?.expirationDate,
    },
  };
}
