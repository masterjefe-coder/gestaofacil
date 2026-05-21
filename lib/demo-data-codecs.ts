import type {
  Charge,
  ChargeFollowUpEntry,
  ChargeIntegrationWarning,
  Customer,
  EntityCadenceState,
  ExternalChargeBilling,
  Quote,
} from "@/lib/types";

const CUSTOMER_META_PREFIX = "GF_CUSTOMER_META::";
const QUOTE_META_PREFIX = "GF_QUOTE_META::";
const CHARGE_META_PREFIX = "GF_CHARGE_META::";

type CustomerMeta = {
  segment: string;
  status: Customer["status"];
  note: string;
};

type QuoteMeta = {
  dueLabel: string;
  summary: string;
  uiStatus: Quote["status"];
  cadence?: EntityCadenceState;
};

type ChargeMeta = {
  dueLabel: string;
  source: string;
  followUps: ChargeFollowUpEntry[];
  cadence?: EntityCadenceState;
  externalBilling?: ExternalChargeBilling;
  integrationWarning?: ChargeIntegrationWarning;
};

function sanitizeCadence(value: Partial<EntityCadenceState> | undefined): EntityCadenceState | undefined {
  if (!value) {
    return undefined;
  }

  const cadenceLabel = value.cadenceLabel?.trim();
  const executionLabel = value.executionLabel?.trim();
  const completedStepLabel = value.completedStepLabel?.trim();
  const nextStepLabel = value.nextStepLabel?.trim();

  if (!cadenceLabel || !executionLabel || !completedStepLabel || !nextStepLabel) {
    return undefined;
  }

  return {
    cadenceLabel,
    executionLabel,
    completedStepLabel,
    nextStepLabel,
  };
}

function parsePrefixedJson<T>(value: string | null, prefix: string): Partial<T> | null {
  if (!value || !value.startsWith(prefix)) {
    return null;
  }

  try {
    return JSON.parse(value.slice(prefix.length)) as Partial<T>;
  } catch {
    return null;
  }
}

export function parseCurrencyToNumber(value: string) {
  return Number(
    value
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim(),
  );
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function mapCustomerStatus(status: string | undefined): Customer["status"] {
  switch (status) {
    case "Recorrente":
      return "Recorrente";
    case "Aguardando retorno":
      return "Aguardando retorno";
    default:
      return "Ativo";
  }
}

export function encodeCustomerNotes(input: CustomerInputLike) {
  return `${CUSTOMER_META_PREFIX}${JSON.stringify({
    segment: input.segment,
    status: input.status,
    note: input.note || "Novo cliente criado no dashboard.",
  } satisfies CustomerMeta)}`;
}

export function decodeCustomerNotes(notes: string | null): CustomerMeta {
  const parsed = parsePrefixedJson<CustomerMeta>(notes, CUSTOMER_META_PREFIX);

  if (parsed) {
    return {
      segment: parsed.segment?.trim() || "Servico",
      status: mapCustomerStatus(parsed.status),
      note: parsed.note?.trim() || "Cliente sem observacoes.",
    };
  }

  if (!notes) {
    return {
      segment: "Servico",
      status: "Ativo",
      note: "Cliente sem observacoes.",
    };
  }

  const [segment, rawNote] = notes.split("|");

  return {
    segment: segment?.trim() || "Servico",
    status: "Ativo",
    note: rawNote?.trim() || "Cliente sem observacoes.",
  };
}

export function mapQuoteStatus(status: Quote["status"]) {
  switch (status) {
    case "Aprovado":
      return "APPROVED" as const;
    case "Follow-up":
      return "SENT" as const;
    default:
      return "SENT" as const;
  }
}

export function encodeQuoteSummary(input: QuoteInputLike) {
  return `${QUOTE_META_PREFIX}${JSON.stringify({
    dueLabel: input.dueLabel || "Acompanhar este orcamento",
    summary: input.summary || "Orcamento criado no dashboard.",
    uiStatus: input.status,
    cadence: input.cadence,
  } satisfies QuoteMeta)}`;
}

export function decodeQuoteSummary(value: string | null, fallbackStatus: "Enviado" | "Aprovado") {
  const parsed = parsePrefixedJson<QuoteMeta>(value, QUOTE_META_PREFIX);

  if (parsed) {
    return {
      dueLabel: parsed.dueLabel?.trim() || "Acompanhar este orcamento",
      summary: parsed.summary?.trim() || "Orcamento sem resumo.",
      status: parsed.uiStatus || fallbackStatus,
      cadence: sanitizeCadence(parsed.cadence),
    };
  }

  if (!value) {
    return {
      dueLabel: "Acompanhar este orcamento",
      summary: "Orcamento sem resumo.",
      status: fallbackStatus,
      cadence: undefined,
    };
  }

  const [dueLabel, summary] = value.split("|||");

  return {
    dueLabel: dueLabel || "Acompanhar este orcamento",
    summary: summary || "Orcamento sem resumo.",
    status: fallbackStatus,
    cadence: undefined,
  };
}

export function mapChargeStatus(status: Charge["status"]) {
  switch (status) {
    case "Hoje":
      return "DUE_TODAY" as const;
    case "Pago":
      return "PAID" as const;
    case "Vencida":
      return "OVERDUE" as const;
    default:
      return "PENDING" as const;
  }
}

export function mapDbChargeStatus(status: "DUE_TODAY" | "PAID" | "PENDING" | "OVERDUE" | "CANCELED"): Charge["status"] {
  switch (status) {
    case "DUE_TODAY":
      return "Hoje";
    case "PAID":
      return "Pago";
    case "OVERDUE":
      return "Vencida";
    default:
      return "Pendente";
  }
}

export function encodeChargeMeta(input: ChargeInputLike) {
  return `${CHARGE_META_PREFIX}${JSON.stringify({
    dueLabel: input.dueLabel || "acompanhar cobranca",
    source: input.source,
    followUps: input.followUps || [],
    cadence: input.cadence,
    externalBilling: input.externalBilling,
    integrationWarning: input.integrationWarning,
  } satisfies ChargeMeta)}`;
}

export function decodeChargeMeta(
  value: string | null,
  fallback: {
    dueLabel: string;
    source: string;
    followUps?: ChargeFollowUpEntry[];
    cadence?: EntityCadenceState;
    externalBilling?: ExternalChargeBilling;
    integrationWarning?: ChargeIntegrationWarning;
  },
) {
  const parsed = parsePrefixedJson<ChargeMeta>(value, CHARGE_META_PREFIX);

  if (parsed) {
    return {
      dueLabel: parsed.dueLabel?.trim() || fallback.dueLabel,
      source: parsed.source?.trim() || fallback.source,
      followUps: Array.isArray(parsed.followUps) ? parsed.followUps.filter(isFollowUpEntry) : (fallback.followUps || []),
      cadence: sanitizeCadence(parsed.cadence) || fallback.cadence,
      externalBilling: isExternalBilling(parsed.externalBilling) ? parsed.externalBilling : fallback.externalBilling,
      integrationWarning: isIntegrationWarning(parsed.integrationWarning) ? parsed.integrationWarning : fallback.integrationWarning,
    };
  }

  return {
    dueLabel: fallback.dueLabel,
    source: fallback.source,
    followUps: fallback.followUps || [],
    cadence: fallback.cadence,
    externalBilling: fallback.externalBilling,
    integrationWarning: fallback.integrationWarning,
  };
}

function isFollowUpEntry(value: unknown): value is ChargeFollowUpEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.channel === "string" &&
    typeof candidate.outcome === "string" &&
    typeof candidate.note === "string"
  );
}

function isExternalBilling(value: unknown): value is ExternalChargeBilling {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return candidate.provider === "Asaas"
    && (candidate.environment === "sandbox" || candidate.environment === "production");
}

function isIntegrationWarning(value: unknown): value is ChargeIntegrationWarning {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return candidate.provider === "Asaas"
    && candidate.stage === "charge_creation"
    && typeof candidate.message === "string"
    && typeof candidate.createdAt === "string";
}

export function inferPaymentMethod(source: string) {
  const normalized = source.toLowerCase();

  if (normalized.includes("boleto")) {
    return "Boleto";
  }

  if (normalized.includes("link")) {
    return "Link de pagamento";
  }

  return "Pix";
}

export function parseDueDateInput(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = new Date(`${normalized}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateInput(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDueDateLabel(date: Date | string) {
  const parsed = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "acompanhar cobranca";
  }

  return `vence ${new Intl.DateTimeFormat("pt-BR").format(parsed)}`;
}

export function buildChargeDueLabel(input: { dueLabel?: string; dueDate?: string; status?: Charge["status"] }) {
  if (input.dueLabel?.trim()) {
    return input.dueLabel.trim();
  }

  if (input.dueDate) {
    return formatDueDateLabel(input.dueDate);
  }

  if (input.status === "Hoje") {
    return "vence hoje";
  }

  if (input.status === "Pago") {
    return "recebido";
  }

  return "acompanhar cobranca";
}

export function inferDueDateFromLabel(label: string | undefined, now = new Date()) {
  if (!label) {
    return null;
  }

  const normalized = label.toLowerCase();
  const base = new Date(now);
  base.setHours(12, 0, 0, 0);

  if (normalized.includes("hoje")) {
    return base;
  }

  if (normalized.includes("amanha")) {
    const nextDay = new Date(base);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
  }

  if (normalized.includes("ontem")) {
    const previousDay = new Date(base);
    previousDay.setDate(previousDay.getDate() - 1);
    return previousDay;
  }

  return null;
}

type CustomerInputLike = Pick<Customer, "segment" | "status" | "note">;
type QuoteInputLike = Pick<Quote, "dueLabel" | "summary" | "status" | "cadence">;
type ChargeInputLike = Pick<Charge, "dueLabel" | "source" | "cadence" | "externalBilling" | "integrationWarning"> & { followUps?: ChargeFollowUpEntry[] };
