import { parseCurrencyToNumber } from "@/lib/demo-data-codecs";
import type { ExternalChargeBilling } from "@/lib/types";

type AsaasEnvironment = "sandbox" | "production";
type AsaasBillingType = "PIX" | "UNDEFINED" | "BOLETO";

type AsaasCustomer = {
  id: string;
};

type AsaasWallet = {
  id: string;
};

type AsaasSubaccountDocument = {
  status?: string;
  type?: string;
  sent?: boolean;
  pending?: boolean;
  action?: string;
  url?: string;
};

type AsaasMyAccountStatus = {
  id?: string;
  commercialInfo?: {
    status?: string;
  };
  documentation?: {
    status?: string;
  };
  bankAccountInfo?: {
    status?: string;
  };
  generalApproval?: string;
};

type AsaasCreateSubaccountResponse = {
  id?: string;
  apiKey?: string;
  walletId?: string;
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

function getAsaasConfigForApiKey(apiKeyOverride?: string) {
  const apiKey = apiKeyOverride?.trim() || process.env.ASAAS_API_KEY?.trim();
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

function resolveAsaasWebhookUrl() {
  const baseUrl = resolveAppBaseUrl();
  return baseUrl ? `${baseUrl}/api/asaas/webhook` : null;
}

export function getAsaasIntegrationStatus() {
  const config = getAsaasConfig();
  const webhookToken = process.env.ASAAS_WEBHOOK_AUTH_TOKEN?.trim();
  const webhookUrl = resolveAsaasWebhookUrl();

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

function buildAsaasWebhookConfig() {
  const webhookUrl = resolveAsaasWebhookUrl();
  const accessToken = process.env.ASAAS_WEBHOOK_AUTH_TOKEN?.trim();

  if (!webhookUrl || !accessToken) {
    return null;
  }

  return {
    name: "Gestao Facil",
    url: webhookUrl,
    email: "",
    interrupted: false,
    enabled: true,
    apiVersion: 3,
    authToken: accessToken,
    sendType: "SEQUENTIALLY",
    events: [
      "PAYMENT_CREATED",
      "PAYMENT_UPDATED",
      "PAYMENT_OVERDUE",
      "PAYMENT_RECEIVED",
      "PAYMENT_CONFIRMED",
      "PAYMENT_DELETED",
    ],
  };
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

async function asaasFetchWithApiKey<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const config = getAsaasConfigForApiKey(apiKey);

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

function resolvePlatformSplitConfig() {
  const walletId = process.env.ASAAS_PLATFORM_WALLET_ID?.trim();
  const percent = process.env.ASAAS_PLATFORM_SPLIT_PERCENT?.trim();
  const fixed = process.env.ASAAS_PLATFORM_SPLIT_FIXED_VALUE?.trim();

  if (!walletId) {
    return null;
  }

  if (percent) {
    return {
      walletId,
      percentualValue: Number(percent),
    };
  }

  if (fixed) {
    return {
      walletId,
      fixedValue: Number(fixed),
    };
  }

  return null;
}

export async function inspectAsaasAccount(apiKey: string) {
  const wallets = await asaasFetchWithApiKey<AsaasWallet[]>(apiKey, "/wallets", {
    method: "GET",
  });

  const firstWallet = Array.isArray(wallets) ? wallets[0] : null;

  return {
    walletId: firstWallet?.id,
  };
}

export async function getAsaasAccountStatus(apiKey: string) {
  const status = await asaasFetchWithApiKey<AsaasMyAccountStatus>(apiKey, "/myAccount/status", {
    method: "GET",
  });

  return {
    accountId: status.id,
    generalApproval: status.generalApproval || undefined,
    commercialStatus: status.commercialInfo?.status || undefined,
    documentationStatus: status.documentation?.status || undefined,
    bankAccountStatus: status.bankAccountInfo?.status || undefined,
  };
}

export async function listAsaasPendingDocuments(apiKey: string) {
  const documents = await asaasFetchWithApiKey<AsaasSubaccountDocument[]>(apiKey, "/myAccount/documents", {
    method: "GET",
  });

  return Array.isArray(documents)
    ? documents.map((item) => ({
      type: item.type || "Documento",
      status: item.status || undefined,
      action: item.action || undefined,
      sent: Boolean(item.sent),
      pending: Boolean(item.pending),
      url: item.url || undefined,
    }))
    : [];
}

export async function createAsaasSubaccount(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  companyType?: string;
  birthDate?: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
  postalCode: string;
}) {
  const rootApiKey = process.env.ASAAS_API_KEY?.trim();

  if (!rootApiKey) {
    throw new AsaasApiError("ASAAS_API_KEY da conta principal nao configurada para criar subcontas.");
  }

  const webhook = buildAsaasWebhookConfig();
  const payload = {
    name: truncate(input.name, 100),
    email: input.email,
    cpfCnpj: normalizeDigits(input.cpfCnpj),
    mobilePhone: normalizeDigits(input.mobilePhone),
    companyType: input.companyType || undefined,
    birthDate: input.birthDate || undefined,
    incomeValue: input.incomeValue,
    address: truncate(input.address, 100),
    addressNumber: truncate(input.addressNumber, 20),
    complement: input.complement ? truncate(input.complement, 50) : undefined,
    province: truncate(input.province, 60),
    postalCode: normalizeDigits(input.postalCode),
    webhook,
  };

  const response = await asaasFetchWithApiKey<AsaasCreateSubaccountResponse>(rootApiKey, "/accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    accountId: response.id || "",
    apiKey: response.apiKey || "",
    walletId: response.walletId || "",
  };
}

async function findAsaasCustomer(apiKey: string, externalReference: string, document?: string): Promise<AsaasCustomer | null> {
  const params = new URLSearchParams({
    externalReference,
    limit: "1",
    offset: "0",
  });

  const documentDigits = normalizeDigits(document);

  if (documentDigits) {
    params.set("cpfCnpj", documentDigits);
  }

  const response = await asaasFetchWithApiKey<AsaasListResponse<AsaasCustomer>>(apiKey, `/customers?${params.toString()}`, {
    method: "GET",
  });

  return response.data?.[0] || null;
}

async function ensureAsaasCustomer(input: {
  apiKey: string;
  externalReference: string;
  name: string;
  document?: string;
  phone?: string;
}): Promise<AsaasCustomer> {
  const existing = await findAsaasCustomer(input.apiKey, input.externalReference, input.document);

  if (existing) {
    return existing;
  }

  const documentDigits = normalizeDigits(input.document);
  const mobilePhone = normalizeDigits(input.phone);

  if (!documentDigits) {
    throw new AsaasApiError(`Cliente ${input.name} ainda nao possui CPF/CNPJ para criar cobranca no Asaas.`);
  }

  return asaasFetchWithApiKey<AsaasCustomer>(input.apiKey, "/customers", {
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

type AsaasPaymentSplit =
  | { walletId: string; percentualValue: number }
  | { walletId: string; fixedValue: number };

async function createAsaasPayment(input: {
  apiKey?: string;
  customerId: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
  split?: AsaasPaymentSplit[];
}): Promise<AsaasPayment> {
  return asaasFetchWithApiKey<AsaasPayment>(input.apiKey || process.env.ASAAS_API_KEY?.trim() || "", "/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: input.value,
      dueDate: input.dueDate,
      description: truncate(input.description, 500),
      externalReference: input.externalReference,
      split: input.split,
    }),
  });
}

async function getPixQrCode(paymentId: string, apiKey?: string): Promise<AsaasPixQrCode> {
  return asaasFetchWithApiKey<AsaasPixQrCode>(apiKey || process.env.ASAAS_API_KEY?.trim() || "", `/payments/${paymentId}/pixQrCode`, {
    method: "GET",
  });
}

export async function createAsaasCharge(input: {
  apiKey?: string;
  externalReference: string;
  customerReference: string;
  customerName: string;
  customerDocument?: string;
  customerPhone?: string;
  amount: string;
  dueDate?: string;
  description: string;
  paymentMethod: string;
  splitEnabled?: boolean;
}): Promise<{ paymentLink?: string; externalBilling: ExternalChargeBilling }> {
  const config = getAsaasConfigForApiKey(input.apiKey);

  if (!config.enabled) {
    throw new AsaasApiError("Asaas ainda nao esta configurado neste ambiente.");
  }

  const dueDate = input.dueDate || new Date().toISOString().slice(0, 10);
  const billingType = resolveBillingType(input.paymentMethod);
  const customer = await ensureAsaasCustomer({
    apiKey: config.apiKey || "",
    externalReference: input.customerReference,
    name: input.customerName,
    document: input.customerDocument,
    phone: input.customerPhone,
  });
  const splitConfig = input.splitEnabled ? resolvePlatformSplitConfig() : null;
  const split = splitConfig ? [splitConfig] : undefined;
  const payment = await createAsaasPayment({
    apiKey: config.apiKey || undefined,
    customerId: customer.id,
    billingType,
    value: parseCurrencyToNumber(input.amount),
    dueDate,
    description: input.description,
    externalReference: input.externalReference,
    split,
  });

  let pixQrCode: AsaasPixQrCode | null = null;

  if (billingType === "PIX") {
    pixQrCode = await getPixQrCode(payment.id, config.apiKey || undefined);
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
