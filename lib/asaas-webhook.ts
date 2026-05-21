import { recordAuditEvent } from "@/lib/audit-repository";
import { buildChargeDueLabel, decodeChargeMeta, encodeChargeMeta, formatDateInput, formatDueDateLabel, mapDbChargeStatus } from "@/lib/demo-data-codecs";
import { isLocalDataMode } from "@/lib/data-mode";
import { prisma } from "@/lib/prisma";
import { readDemoWorkspaceData, writeDemoWorkspaceData } from "@/lib/demo-store";
import type { Charge, ExternalChargeBilling, SubscriptionStatusCode } from "@/lib/types";

export type AsaasWebhookPayload = {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    subscription?: string;
    customer?: string;
    value?: number;
    netValue?: number;
    originalValue?: number;
    billingType?: "PIX" | "UNDEFINED" | "BOLETO";
    status?: string;
    dueDate?: string;
    paymentDate?: string;
    clientPaymentDate?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    externalReference?: string;
    description?: string;
  } | null;
};

export type ChargeReference =
  | { mode: "local"; chargeId: string }
  | { mode: "database"; workspaceId: string; chargeId: string };

export type SubscriptionReference =
  | { mode: "local"; workspaceKey: string }
  | { mode: "database"; workspaceId: string };

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseChargeReference(externalReference: string): ChargeReference | null {
  const parts = externalReference.split(":");

  if (parts.length !== 3 || parts[0] !== "gf_charge") {
    return null;
  }

  if (parts[1] === "local") {
    return parts[2] ? { mode: "local", chargeId: parts[2] } : null;
  }

  return parts[1] && parts[2]
    ? { mode: "database", workspaceId: parts[1], chargeId: parts[2] }
    : null;
}

export function parseSubscriptionReference(externalReference: string): SubscriptionReference | null {
  const parts = externalReference.split(":");

  if (parts.length !== 3 || parts[0] !== "gf_subscription") {
    return null;
  }

  if (parts[1] === "local") {
    return parts[2] ? { mode: "local", workspaceKey: parts[2] } : null;
  }

  return parts[1]
    ? { mode: "database", workspaceId: parts[1] }
    : null;
}

export function isReceivedEvent(event: string) {
  return event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED";
}

export function isDeletedEvent(event: string) {
  return event === "PAYMENT_DELETED";
}

export function isRestoredEvent(event: string) {
  return event === "PAYMENT_RESTORED";
}

export function buildWebhookSummary(event: string, charge: { customer: string; amount: string }) {
  switch (event) {
    case "PAYMENT_RECEIVED":
      return `Asaas informou recebimento da cobranca de ${charge.amount} para ${charge.customer}.`;
    case "PAYMENT_CONFIRMED":
      return `Asaas confirmou pagamento da cobranca de ${charge.amount} para ${charge.customer}.`;
    case "PAYMENT_OVERDUE":
      return `Asaas marcou a cobranca de ${charge.amount} para ${charge.customer} como vencida.`;
    case "PAYMENT_UPDATED":
      return `Asaas atualizou dados da cobranca de ${charge.amount} para ${charge.customer}.`;
    case "PAYMENT_DELETED":
      return `Asaas informou remocao da cobranca de ${charge.amount} para ${charge.customer}.`;
    case "PAYMENT_RESTORED":
      return `Asaas restaurou a cobranca de ${charge.amount} para ${charge.customer}.`;
    default:
      return `Asaas enviou o evento ${event} para a cobranca de ${charge.amount} para ${charge.customer}.`;
  }
}

export function buildExternalBilling(current: ExternalChargeBilling | undefined, payload: NonNullable<AsaasWebhookPayload["payment"]>): ExternalChargeBilling {
  return {
    provider: "Asaas",
    environment: current?.environment || (process.env.ASAAS_ENVIRONMENT?.trim().toLowerCase() === "production" ? "production" : "sandbox"),
    customerId: getString(payload.customer) || current?.customerId,
    paymentId: getString(payload.id) || current?.paymentId,
    billingType: payload.billingType || current?.billingType,
    invoiceUrl: getString(payload.invoiceUrl) || current?.invoiceUrl,
    bankSlipUrl: getString(payload.bankSlipUrl) || current?.bankSlipUrl,
    pixCopyPaste: current?.pixCopyPaste,
    pixQrCodeBase64: current?.pixQrCodeBase64,
    pixExpirationDate: current?.pixExpirationDate,
  };
}

export function computeNextChargeState(current: Charge, payload: NonNullable<AsaasWebhookPayload["payment"]>, event: string): Pick<Charge, "status" | "dueDate" | "dueLabel" | "paymentLink" | "externalBilling"> {
  const externalBilling = buildExternalBilling(current.externalBilling, payload);
  const dueDate = getString(payload.dueDate) || current.dueDate;
  const paymentLink = getString(payload.invoiceUrl) || getString(payload.bankSlipUrl) || current.paymentLink;

  if (isReceivedEvent(event)) {
    return {
      status: "Pago",
      dueDate,
      dueLabel: "recebido",
      paymentLink,
      externalBilling,
    };
  }

  if (event === "PAYMENT_OVERDUE") {
    return {
      status: "Vencida",
      dueDate,
      dueLabel: dueDate ? formatDueDateLabel(dueDate) : current.dueLabel,
      paymentLink,
      externalBilling,
    };
  }

  if (isDeletedEvent(event)) {
    return {
      status: "Pendente",
      dueDate,
      dueLabel: current.dueLabel,
      paymentLink,
      externalBilling,
    };
  }

  if (isRestoredEvent(event) || event === "PAYMENT_UPDATED" || event === "PAYMENT_CREATED") {
    return {
      status: current.status === "Pago" ? "Pago" : "Pendente",
      dueDate,
      dueLabel: dueDate ? buildChargeDueLabel({ dueDate, status: current.status }) : current.dueLabel,
      paymentLink,
      externalBilling,
    };
  }

  return {
    status: current.status,
    dueDate,
    dueLabel: current.dueLabel,
    paymentLink,
    externalBilling,
  };
}

export function computeNextSubscriptionState(current: {
  status: SubscriptionStatusCode;
  asaasSubscriptionId?: string | null;
  asaasPaymentLink?: string | null;
  notes?: string | null;
}, payload: NonNullable<AsaasWebhookPayload["payment"]>, event: string) {
  return {
    status: isReceivedEvent(event)
      ? "ACTIVE"
      : event === "PAYMENT_OVERDUE"
        ? "PAST_DUE"
        : current.status,
    asaasSubscriptionId: getString(payload.subscription) || current.asaasSubscriptionId || undefined,
    asaasPaymentLink: getString(payload.invoiceUrl) || getString(payload.bankSlipUrl) || current.asaasPaymentLink || undefined,
    notes: (isReceivedEvent(event)
      ? "Pagamento confirmado pelo webhook do Asaas."
      : event === "PAYMENT_OVERDUE"
        ? "Assinatura com pagamento pendente segundo o webhook do Asaas."
        : current.notes) || undefined,
  };
}

async function hasProcessedWebhookEvent(workspaceId: string, eventId: string) {
  const existing = await prisma.auditEvent.findFirst({
    where: {
      workspaceId,
      entityType: "asaas",
      entityId: eventId,
    },
    select: { id: true },
  });

  return Boolean(existing);
}

async function applyLocalWebhook(reference: Extract<ChargeReference, { mode: "local" }>, payload: NonNullable<AsaasWebhookPayload["payment"]>, event: string) {
  const data = await readDemoWorkspaceData();
  const index = data.charges.findIndex((charge) => charge.id === reference.chargeId);

  if (index === -1) {
    return { stored: false, reason: "charge_not_found", mode: "local" as const };
  }

  const current = data.charges[index];
  const nextState = computeNextChargeState(current, payload, event);
  const updated: Charge = {
    ...current,
    status: nextState.status,
    dueDate: nextState.dueDate,
    dueLabel: nextState.dueLabel,
    paymentLink: nextState.paymentLink,
    externalBilling: nextState.externalBilling,
  };

  data.charges[index] = updated;
  await writeDemoWorkspaceData(data);

  return {
    stored: true,
    mode: "local" as const,
    chargeId: updated.id,
    workspaceId: null,
    event,
  };
}

async function applyLocalSubscriptionWebhook(reference: Extract<SubscriptionReference, { mode: "local" }>, payload: NonNullable<AsaasWebhookPayload["payment"]>, event: string) {
  const data = await readDemoWorkspaceData();

  if (reference.workspaceKey !== data.workspace.slug) {
    return { stored: false, reason: "subscription_not_found", mode: "local" as const };
  }

  const current = data.subscription;

  data.subscription = {
    ...current,
    ...computeNextSubscriptionState(current, payload, event),
  };

  await writeDemoWorkspaceData(data);

  return {
    stored: true,
    mode: "local" as const,
    workspaceId: null,
    event,
  };
}

async function applyDatabaseWebhook(reference: Extract<ChargeReference, { mode: "database" }>, eventId: string, payload: NonNullable<AsaasWebhookPayload["payment"]>, event: string) {
  if (await hasProcessedWebhookEvent(reference.workspaceId, eventId)) {
    return {
      stored: true,
      duplicate: true,
      mode: "database" as const,
      workspaceId: reference.workspaceId,
      chargeId: reference.chargeId,
      event,
    };
  }

  const existing = await prisma.charge.findFirst({
    where: {
      id: reference.chargeId,
      workspaceId: reference.workspaceId,
    },
    include: {
      customer: true,
      order: true,
    },
  });

  if (!existing) {
    return { stored: false, reason: "charge_not_found", mode: "database" as const, workspaceId: reference.workspaceId };
  }

  const currentMeta = decodeChargeMeta(existing.pixCode, {
    dueLabel: existing.dueDate ? formatDueDateLabel(existing.dueDate) : "acompanhar cobranca",
    source: existing.paymentMethod,
    followUps: [],
    cadence: undefined,
    externalBilling: undefined,
  });

  const current: Charge = {
    id: existing.id,
    customer: existing.customer.name,
    amount: new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(existing.amount)),
    dueLabel: currentMeta.dueLabel,
    dueDate: existing.dueDate ? formatDateInput(existing.dueDate) : undefined,
    status: mapDbChargeStatus(existing.status),
    source: currentMeta.source,
    paymentLink: existing.paymentLink || currentMeta.externalBilling?.invoiceUrl || currentMeta.externalBilling?.bankSlipUrl,
    followUps: currentMeta.followUps,
    cadence: currentMeta.cadence,
    externalBilling: currentMeta.externalBilling,
  };

  const nextState = computeNextChargeState(current, payload, event);

    await prisma.charge.update({
      where: { id: existing.id },
      data: {
      status:
        nextState.status === "Pago"
          ? "PAID"
          : nextState.status === "Vencida"
            ? "OVERDUE"
            : nextState.status === "Hoje"
              ? "DUE_TODAY"
              : nextState.status === "Pendente"
                ? "PENDING"
                : existing.status,
        dueDate: nextState.dueDate ? new Date(`${nextState.dueDate}T12:00:00`) : existing.dueDate,
        paidAt: isReceivedEvent(event) ? new Date() : null,
        paymentLink: nextState.paymentLink || null,
        pixCode: encodeChargeMeta({
          dueLabel: nextState.dueLabel,
        source: current.source,
        followUps: current.followUps,
        cadence: current.cadence,
        externalBilling: nextState.externalBilling,
      }),
    },
  });

  await recordAuditEvent({
    action: `asaas.${event.toLowerCase()}`,
    entityType: "asaas",
    entityId: eventId,
    workspaceId: reference.workspaceId,
    actorId: null,
    payload: {
      summary: buildWebhookSummary(event, current),
      metadata: {
        chargeId: existing.id,
        paymentId: getString(payload.id) || null,
        billingType: payload.billingType || null,
        paymentStatus: getString(payload.status) || null,
        paymentDate: getString(payload.paymentDate) || getString(payload.clientPaymentDate) || null,
      },
    },
  });

  await recordAuditEvent({
    action: `charge.asaas.${event.toLowerCase()}`,
    entityType: "charge",
    entityId: existing.id,
    workspaceId: reference.workspaceId,
    actorId: null,
    payload: {
      summary: buildWebhookSummary(event, current),
      metadata: {
        paymentId: getString(payload.id) || null,
        billingType: payload.billingType || null,
        paymentStatus: getString(payload.status) || null,
        paymentDate: getString(payload.paymentDate) || getString(payload.clientPaymentDate) || null,
      },
    },
  });

  return {
    stored: true,
    duplicate: false,
    mode: "database" as const,
    workspaceId: reference.workspaceId,
    chargeId: existing.id,
    event,
  };
}

async function applyDatabaseSubscriptionWebhook(reference: Extract<SubscriptionReference, { mode: "database" }>, eventId: string, payload: NonNullable<AsaasWebhookPayload["payment"]>, event: string) {
  if (await hasProcessedWebhookEvent(reference.workspaceId, eventId)) {
    return {
      stored: true,
      duplicate: true,
      mode: "database" as const,
      workspaceId: reference.workspaceId,
      event,
    };
  }

  const subscription = await prisma.workspaceSubscription.findUnique({
    where: { workspaceId: reference.workspaceId },
  });

  if (!subscription) {
    return { stored: false, reason: "subscription_not_found", mode: "database" as const, workspaceId: reference.workspaceId };
  }

  const nextState = computeNextSubscriptionState(subscription, payload, event);

  await prisma.workspaceSubscription.update({
    where: { workspaceId: reference.workspaceId },
    data: {
      status: nextState.status,
      asaasSubscriptionId: nextState.asaasSubscriptionId ?? null,
      asaasPaymentLink: nextState.asaasPaymentLink ?? null,
      currentPeriodStart: isReceivedEvent(event) ? new Date() : subscription.currentPeriodStart,
      notes: nextState.notes ?? null,
    },
  });

  await recordAuditEvent({
    action: `subscription.asaas.${event.toLowerCase()}`,
    entityType: "workspace_subscription",
    entityId: subscription.id,
    workspaceId: reference.workspaceId,
    actorId: null,
    payload: {
      summary: `Asaas enviou ${event} para a assinatura do workspace.`,
      metadata: {
        subscriptionId: getString(payload.subscription) || null,
        paymentId: getString(payload.id) || null,
        dueDate: getString(payload.dueDate) || null,
        paymentDate: getString(payload.paymentDate) || getString(payload.clientPaymentDate) || null,
      },
    },
  });

  return {
    stored: true,
    duplicate: false,
    mode: "database" as const,
    workspaceId: reference.workspaceId,
    event,
  };
}

export async function handleAsaasWebhook(payload: AsaasWebhookPayload) {
  const eventId = getString(payload.id);
  const event = getString(payload.event);
  const payment = payload.payment || null;
  const externalReference = getString(payment?.externalReference);

  if (!eventId || !event || !payment) {
    return {
      stored: false,
      reason: "invalid_payload",
      event: event || null,
    };
  }

  const chargeReference = externalReference ? parseChargeReference(externalReference) : null;
  const subscriptionReference = externalReference ? parseSubscriptionReference(externalReference) : null;

  if (chargeReference) {
    if (chargeReference.mode === "local" || isLocalDataMode()) {
      return applyLocalWebhook(chargeReference.mode === "local" ? chargeReference : { mode: "local", chargeId: chargeReference.chargeId }, payment, event);
    }

    return applyDatabaseWebhook(chargeReference, eventId, payment, event);
  }

  if (subscriptionReference || getString(payment.subscription)) {
    if (isLocalDataMode()) {
      const localReference = subscriptionReference?.mode === "local"
        ? subscriptionReference
        : { mode: "local" as const, workspaceKey: (await readDemoWorkspaceData()).workspace.slug };
      return applyLocalSubscriptionWebhook(localReference, payment, event);
    }

    const dbReference = subscriptionReference?.mode === "database"
      ? subscriptionReference
      : await prisma.workspaceSubscription.findFirst({
          where: { asaasSubscriptionId: getString(payment.subscription) },
          select: { workspaceId: true },
        });

    if (dbReference && "workspaceId" in dbReference) {
      return applyDatabaseSubscriptionWebhook({ mode: "database", workspaceId: dbReference.workspaceId }, eventId, payment, event);
    }

    return {
      stored: false,
      reason: "subscription_not_found",
      event,
      externalReference: externalReference || null,
    };
  }

  return {
    stored: false,
    reason: "external_reference_not_supported",
    event,
    externalReference: externalReference || null,
  };
}
