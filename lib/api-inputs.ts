type JsonObject = Record<string, unknown>;

export class ApiInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiInputError";
  }
}

type SetupPayload = {
  name: string;
  slug: string;
  niche: string;
  legalName: string;
  tradeName: string;
  document: string;
  city: string;
  state: string;
  evolutionInstanceName?: string;
  serviceDescription: string;
  defaultFiscalServiceCode: string;
  defaultPixKey: string;
  defaultPaymentMessage: string;
};

type QuotePayload = {
  customer: string;
  title: string;
  amount: string;
  status: "Enviado" | "Aprovado" | "Follow-up";
  dueLabel: string;
  summary: string;
};

type CustomerPayload = {
  name: string;
  document?: string;
  segment: string;
  city: string;
  status: "Ativo" | "Aguardando retorno" | "Recorrente";
  note: string;
};

type OrderPayload =
  | {
      mode: "create-from-quote";
      quoteId: string;
    }
  | {
      mode: "update-status";
      id: string;
      status: "Pendente" | "Agendado" | "Em execucao" | "Concluido";
      note?: string;
    };

type ChargePayload =
  | {
      mode: "create-from-quote";
      quoteId: string;
      paymentMethod: string;
      dueLabel: string;
      dueDate?: string;
      status: "Pendente" | "Hoje" | "Pago";
    }
  | {
      mode: "create-manual";
      customer: string;
      amount: string;
      dueLabel: string;
      dueDate?: string;
      status: "Pendente" | "Hoje" | "Pago";
      source: string;
    };

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readRequiredString(body: JsonObject, key: string) {
  const value = toTrimmedString(body[key]);

  if (!value) {
    throw new ApiInputError("Dados obrigatorios ausentes.");
  }

  return value;
}

function readOptionalString(body: JsonObject, key: string) {
  const value = body[key];

  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new ApiInputError(`Campo invalido: ${key}.`);
  }

  return value.trim();
}

function readOptionalMaybeString(body: JsonObject, key: string) {
  const value = readOptionalString(body, key);
  return value || undefined;
}

function readOptionalEnum<T extends string>(
  body: JsonObject,
  key: string,
  options: readonly T[],
  fallback: T,
) {
  const value = body[key];

  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value !== "string") {
    throw new ApiInputError(`Campo invalido: ${key}.`);
  }

  const trimmed = value.trim() as T;

  if (!options.includes(trimmed)) {
    throw new ApiInputError(`Valor invalido para ${key}.`);
  }

  return trimmed;
}

function readRequiredEnum<T extends string>(
  body: JsonObject,
  key: string,
  options: readonly T[],
) {
  const value = readRequiredString(body, key) as T;

  if (!options.includes(value)) {
    throw new ApiInputError(`Valor invalido para ${key}.`);
  }

  return value;
}

export async function readJsonObject(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiInputError("Corpo JSON invalido.");
  }

  if (!isObject(body)) {
    throw new ApiInputError("Corpo da requisicao deve ser um objeto JSON.");
  }

  return body;
}

export function parseSetupPayload(body: JsonObject): SetupPayload {
  return {
    name: readRequiredString(body, "name"),
    slug: readRequiredString(body, "slug"),
    niche: readOptionalString(body, "niche"),
    legalName: readOptionalString(body, "legalName"),
    tradeName: readRequiredString(body, "tradeName"),
    document: readRequiredString(body, "document"),
    city: readOptionalString(body, "city"),
    state: readOptionalString(body, "state"),
    evolutionInstanceName: readOptionalString(body, "evolutionInstanceName") || undefined,
    serviceDescription: readOptionalString(body, "serviceDescription"),
    defaultFiscalServiceCode: readOptionalString(body, "defaultFiscalServiceCode"),
    defaultPixKey: readOptionalString(body, "defaultPixKey"),
    defaultPaymentMessage: readOptionalString(body, "defaultPaymentMessage"),
  };
}

export function parseQuotePayload(body: JsonObject): QuotePayload {
  return {
    customer: readRequiredString(body, "customer"),
    title: readRequiredString(body, "title"),
    amount: readRequiredString(body, "amount"),
    status: readOptionalEnum(body, "status", ["Enviado", "Aprovado", "Follow-up"], "Enviado"),
    dueLabel: readOptionalString(body, "dueLabel"),
    summary: readOptionalString(body, "summary"),
  };
}

export function parseCustomerPayload(body: JsonObject): CustomerPayload {
  return {
    name: readRequiredString(body, "name"),
    document: readOptionalMaybeString(body, "document"),
    segment: readRequiredString(body, "segment"),
    city: readRequiredString(body, "city"),
    status: readOptionalEnum(body, "status", ["Ativo", "Aguardando retorno", "Recorrente"], "Ativo"),
    note: readOptionalString(body, "note"),
  };
}

export function parseOrderPayload(body: JsonObject): OrderPayload {
  const quoteId = readOptionalString(body, "quoteId");

  if (quoteId) {
    return {
      mode: "create-from-quote",
      quoteId,
    };
  }

  return {
    mode: "update-status",
    id: readRequiredString(body, "id"),
    status: readRequiredEnum(body, "status", ["Pendente", "Agendado", "Em execucao", "Concluido"]),
    note: readOptionalMaybeString(body, "note"),
  };
}

export function parseChargePayload(body: JsonObject): ChargePayload {
  const quoteId = readOptionalString(body, "quoteId");

  if (quoteId) {
    return {
      mode: "create-from-quote",
      quoteId,
      paymentMethod: readOptionalString(body, "paymentMethod") || "Pix",
      dueLabel: readOptionalString(body, "dueLabel"),
      dueDate: readOptionalMaybeString(body, "dueDate"),
      status: readOptionalEnum(body, "status", ["Pendente", "Hoje", "Pago"], "Pendente"),
    };
  }

  const paymentMethod = readOptionalString(body, "paymentMethod");

  return {
    mode: "create-manual",
    customer: readRequiredString(body, "customer"),
    amount: readRequiredString(body, "amount"),
    dueLabel: readOptionalString(body, "dueLabel"),
    dueDate: readOptionalMaybeString(body, "dueDate"),
    status: readOptionalEnum(body, "status", ["Pendente", "Hoje", "Pago"], "Pendente"),
    source: readOptionalString(body, "source") || paymentMethod || "Pix",
  };
}
