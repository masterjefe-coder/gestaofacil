import { randomUUID } from "node:crypto";
import type { Charge as DbCharge, Customer as DbCustomer, Order as DbOrder } from "@prisma/client";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { createAsaasCharge, resolveAsaasPaymentLink } from "@/lib/asaas";
import { getWorkspaceAsaasConnection } from "@/lib/asaas-workspace";
import { recordAuditEvent } from "@/lib/audit-repository";
import { isLocalDataMode } from "@/lib/data-mode";
import {
  buildChargeDueLabel,
  decodeChargeMeta,
  encodeChargeMeta,
  encodeCustomerNotes,
  formatDateInput,
  formatCurrency,
  formatDueDateLabel,
  inferPaymentMethod,
  mapChargeStatus,
  mapDbChargeStatus,
  parseDueDateInput,
  parseCurrencyToNumber,
} from "@/lib/demo-data-codecs";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { readDemoWorkspaceData, writeDemoWorkspaceData } from "@/lib/demo-store";
import { enqueueBackgroundJob } from "@/lib/background-jobs";
import { ensureOrderFromQuote } from "@/lib/order-repository";
import { prisma } from "@/lib/prisma";
import type {
  Charge,
  ChargeFollowUpChannel,
  ChargeFollowUpEntry,
  ChargeFollowUpOutcome,
  ChargeIntegrationWarning,
  ChargeInput,
} from "@/lib/types";

type ChargeUpdateInput = {
  status?: Charge["status"];
  dueDate?: string;
  dueLabel?: string;
  source?: string;
  paymentLink?: string;
  cadence?: Charge["cadence"];
  externalBilling?: Charge["externalBilling"];
  integrationWarning?: Charge["integrationWarning"];
};

type ChargeFollowUpInput = {
  channel: ChargeFollowUpChannel;
  outcome: ChargeFollowUpOutcome;
  note: string;
};

function createFollowUpEntry(input: ChargeFollowUpInput): ChargeFollowUpEntry {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    channel: input.channel,
    outcome: input.outcome,
    note: input.note || "Contato financeiro registrado no painel.",
  };
}

function createIntegrationWarning(message: string): ChargeIntegrationWarning {
  return {
    provider: "Asaas",
    stage: "charge_creation",
    message,
    createdAt: new Date().toISOString(),
  };
}

async function buildExternalBillingForCharge(input: {
  chargeReference: string;
  customerReference: string;
  customerName: string;
  customerDocument?: string;
  customerPhone?: string;
  amount: string;
  dueDate?: string;
  description: string;
  paymentMethod: string;
}) {
  const connection = await getWorkspaceAsaasConnection();

  return createAsaasCharge({
    apiKey: connection.apiKey || undefined,
    externalReference: input.chargeReference,
    customerReference: input.customerReference,
    customerName: input.customerName,
    customerDocument: input.customerDocument,
    customerPhone: input.customerPhone,
    amount: input.amount,
    dueDate: input.dueDate,
    description: input.description,
    paymentMethod: input.paymentMethod,
    splitEnabled: connection.mode === "workspace" && connection.splitEnabled,
  });
}

function toChargeView(charge: DbCharge & { customer: DbCustomer; order: DbOrder }): Charge {
  const fallback = {
    dueLabel: charge.dueDate
      ? formatDueDateLabel(charge.dueDate)
      : "acompanhar cobranca",
    source: charge.paymentMethod,
    followUps: [],
    cadence: undefined,
    externalBilling: undefined,
    integrationWarning: undefined,
  };
  const meta = decodeChargeMeta(charge.pixCode, fallback);

  return {
    id: charge.id,
    customer: charge.customer.name,
    amount: formatCurrency(Number(charge.amount)),
    dueLabel: meta.dueLabel,
    dueDate: charge.dueDate ? formatDateInput(charge.dueDate) : undefined,
    status: mapDbChargeStatus(charge.status),
    source: meta.source,
    paymentLink: charge.paymentLink || resolveAsaasPaymentLink(meta.externalBilling, meta.externalBilling?.billingType),
    followUps: meta.followUps,
    cadence: meta.cadence,
    externalBilling: meta.externalBilling,
    integrationWarning: meta.integrationWarning,
  };
}

export async function listCharges(): Promise<Charge[]> {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const { workspaceId } = await getCurrentWorkspaceContext();

    const charges = await prisma.charge.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      include: {
        customer: true,
        order: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return charges.map(toChargeView);
  }

  const data = await readDemoWorkspaceData();
  return data.charges.map((charge) => ({
    ...charge,
    followUps: charge.followUps || [],
    cadence: charge.cadence,
  }));
}

export async function createCharge(input: ChargeInput): Promise<Charge> {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const { workspaceId } = await getCurrentWorkspaceContext();

    let customer = await prisma.customer.findFirst({
      where: {
        workspaceId,
        name: input.customer,
        deletedAt: null,
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          workspaceId,
          name: input.customer,
          notes: encodeCustomerNotes({
            segment: "Servico",
            status: "Ativo",
            note: "Cliente criado automaticamente a partir de cobranca.",
          }),
        },
      });
    }

    const quote = await prisma.quote.create({
      data: {
        workspaceId,
        customerId: customer.id,
        title: `Cobranca manual - ${input.customer}`,
        summary: "Cobranca criada sem orcamento previo.",
        status: "APPROVED",
        subtotal: parseCurrencyToNumber(input.amount),
        total: parseCurrencyToNumber(input.amount),
        discount: 0,
      },
    });

    const order = await prisma.order.create({
      data: {
        workspaceId,
        customerId: customer.id,
        quoteId: quote.id,
        status: "PENDING",
        internalNotes: "Pedido tecnico criado para sustentar cobranca manual.",
      },
    });

    const charge = await prisma.charge.create({
      data: {
        workspaceId,
        customerId: customer.id,
        orderId: order.id,
        amount: parseCurrencyToNumber(input.amount),
        status: mapChargeStatus(input.status),
        paymentMethod: inferPaymentMethod(input.source),
        pixCode: encodeChargeMeta(input),
        dueDate: parseDueDateInput(input.dueDate),
      },
    });

    let externalCharge;
    let integrationWarning: ChargeIntegrationWarning | undefined;

    try {
      externalCharge = await buildExternalBillingForCharge({
        chargeReference: `gf_charge:${workspaceId}:${charge.id}`,
        customerReference: `gf_customer:${workspaceId}:${customer.id}`,
        customerName: customer.name,
        customerDocument: customer.document || undefined,
        customerPhone: customer.phone || undefined,
        amount: input.amount,
        dueDate: input.dueDate,
        description: `Cobranca para ${customer.name}`,
        paymentMethod: input.source,
      });
    } catch (error) {
      externalCharge = undefined;
      integrationWarning = createIntegrationWarning(
        error instanceof Error
          ? error.message
          : "Falha ao criar cobranca externa no Asaas.",
      );
    }

    const persistedCharge = await prisma.charge.update({
      where: { id: charge.id },
      data: {
        paymentLink: externalCharge?.paymentLink || null,
        pixCode: encodeChargeMeta({
          ...input,
          followUps: [],
          externalBilling: externalCharge?.externalBilling,
          integrationWarning,
        }),
      },
      include: {
        customer: true,
        order: true,
      },
    });

    const createdCharge = {
      id: persistedCharge.id,
      customer: customer.name,
      amount: formatCurrency(Number(persistedCharge.amount)),
      dueLabel: buildChargeDueLabel(input),
      dueDate: input.dueDate,
      status: input.status,
      source: input.source,
      paymentLink: persistedCharge.paymentLink || undefined,
      followUps: [],
      cadence: input.cadence,
      externalBilling: externalCharge?.externalBilling,
      integrationWarning,
    };

    await recordAuditEvent({
      action: "charge.created",
      entityType: "charge",
      entityId: charge.id,
      payload: {
        summary: `Cobranca de ${createdCharge.amount} criada para ${createdCharge.customer}.`,
        metadata: {
          customer: createdCharge.customer,
          amount: createdCharge.amount,
          status: createdCharge.status,
          dueDate: createdCharge.dueDate || null,
          paymentLink: createdCharge.paymentLink || null,
        },
      },
    });

    if (integrationWarning) {
      await enqueueBackgroundJob({
        type: "asaas.charge.retry",
        dedupeKey: `charge:${charge.id}:creation`,
        payload: {
          chargeId: charge.id,
          customerId: customer.id,
          amount: createdCharge.amount,
          detail: integrationWarning.message,
          source: "manual-charge",
        },
        workspaceId,
        availableAt: new Date(Date.now() + 60_000),
        maxAttempts: 5,
      });

      await recordAuditEvent({
        action: "charge.asaas.failed",
        entityType: "charge",
        entityId: charge.id,
        payload: {
          summary: `Cobranca criada para ${createdCharge.customer}, mas o Asaas nao concluiu a automacao externa.`,
          metadata: {
            customer: createdCharge.customer,
            amount: createdCharge.amount,
            detail: integrationWarning.message,
          },
        },
      });
    }

    return createdCharge;
  }

  const data = await readDemoWorkspaceData();
  const existingCustomer = data.customers.find((customer) => customer.name === input.customer);
  const localChargeId = randomUUID();
  let externalCharge;
  let integrationWarning: ChargeIntegrationWarning | undefined;

  try {
    externalCharge = await buildExternalBillingForCharge({
      chargeReference: `gf_charge:local:${localChargeId}`,
      customerReference: `gf_customer:local:${existingCustomer?.id || input.customer}`,
      customerName: input.customer,
      customerDocument: existingCustomer?.document,
      customerPhone: existingCustomer?.phone,
      amount: input.amount,
      dueDate: input.dueDate,
      description: `Cobranca para ${input.customer}`,
      paymentMethod: input.source,
    });
  } catch (error) {
    externalCharge = undefined;
    integrationWarning = createIntegrationWarning(
      error instanceof Error
        ? error.message
        : "Falha ao criar cobranca externa no Asaas.",
    );
  }

  const charge: Charge = {
    id: localChargeId,
    customer: input.customer,
    amount: input.amount,
    dueLabel: buildChargeDueLabel(input),
    dueDate: input.dueDate,
    status: input.status,
    source: input.source,
    paymentLink: externalCharge?.paymentLink || input.paymentLink,
    followUps: [],
    cadence: input.cadence,
    externalBilling: externalCharge?.externalBilling || input.externalBilling,
    integrationWarning,
  };

  data.charges = [charge, ...data.charges];
  await writeDemoWorkspaceData(data);
  return charge;
}

export async function createChargeFromQuote(
  quoteId: string,
  paymentMethod: string,
  dueLabel: string,
  dueDate: string | undefined,
  status: Charge["status"],
): Promise<Charge | null> {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const { workspaceId } = await getCurrentWorkspaceContext();
    const order = await ensureOrderFromQuote(quoteId);

    if (!order) {
      return null;
    }

    const dbOrder = await prisma.order.findFirst({
      where: {
        id: order.id,
        workspaceId,
        deletedAt: null,
      },
      include: { customer: true, quote: true },
    });

    if (!dbOrder) {
      return null;
    }

    const charge = await prisma.charge.create({
      data: {
        workspaceId,
        customerId: dbOrder.customerId,
        orderId: dbOrder.id,
        amount: dbOrder.quote.total,
        status: mapChargeStatus(status),
        paymentMethod,
        pixCode: encodeChargeMeta({
          dueLabel: dueLabel || buildChargeDueLabel({ dueDate, status }),
          source: `${paymentMethod} via orcamento "${dbOrder.quote.title}"`,
          followUps: [],
          cadence: undefined,
        }),
        dueDate: parseDueDateInput(dueDate),
      },
    });

    let externalCharge;
    let integrationWarning: ChargeIntegrationWarning | undefined;

    try {
      externalCharge = await buildExternalBillingForCharge({
        chargeReference: `gf_charge:${workspaceId}:${charge.id}`,
        customerReference: `gf_customer:${workspaceId}:${dbOrder.customer.id}`,
        customerName: dbOrder.customer.name,
        customerDocument: dbOrder.customer.document || undefined,
        customerPhone: dbOrder.customer.phone || undefined,
        amount: formatCurrency(Number(charge.amount)),
        dueDate,
        description: `Cobranca do orcamento ${dbOrder.quote.title}`,
        paymentMethod,
      });
    } catch (error) {
      externalCharge = undefined;
      integrationWarning = createIntegrationWarning(
        error instanceof Error
          ? error.message
          : "Falha ao criar cobranca externa no Asaas.",
      );
    }

    const persistedCharge = await prisma.charge.update({
      where: { id: charge.id },
      data: {
        paymentLink: externalCharge?.paymentLink || null,
        pixCode: encodeChargeMeta({
          dueLabel: dueLabel || buildChargeDueLabel({ dueDate, status }),
          source: `${paymentMethod} via orcamento "${dbOrder.quote.title}"`,
          followUps: [],
          cadence: undefined,
          externalBilling: externalCharge?.externalBilling,
          integrationWarning,
        }),
      },
      include: {
        customer: true,
        order: true,
      },
    });

    const createdCharge = {
      id: persistedCharge.id,
      customer: dbOrder.customer.name,
      amount: formatCurrency(Number(persistedCharge.amount)),
      dueLabel: dueLabel || buildChargeDueLabel({ dueDate, status }),
      dueDate,
      status,
      source: `${paymentMethod} via orcamento "${dbOrder.quote.title}"`,
      paymentLink: persistedCharge.paymentLink || undefined,
      followUps: [],
      cadence: undefined,
      externalBilling: externalCharge?.externalBilling,
      integrationWarning,
    };

    await recordAuditEvent({
      action: "charge.created",
      entityType: "charge",
      entityId: charge.id,
      payload: {
        summary: `Cobranca de ${createdCharge.amount} criada para ${createdCharge.customer} a partir de orcamento aprovado.`,
        metadata: {
          customer: createdCharge.customer,
          amount: createdCharge.amount,
          status: createdCharge.status,
          dueDate: createdCharge.dueDate || null,
          source: createdCharge.source,
          paymentLink: createdCharge.paymentLink || null,
        },
      },
    });

    if (integrationWarning) {
      await enqueueBackgroundJob({
        type: "asaas.charge.retry",
        dedupeKey: `charge:${charge.id}:quote`,
        payload: {
          chargeId: charge.id,
          customerId: dbOrder.customer.id,
          amount: createdCharge.amount,
          detail: integrationWarning.message,
          source: "quote-charge",
        },
        workspaceId,
        availableAt: new Date(Date.now() + 60_000),
        maxAttempts: 5,
      });

      await recordAuditEvent({
        action: "charge.asaas.failed",
        entityType: "charge",
        entityId: charge.id,
        payload: {
          summary: `Cobranca do orcamento de ${createdCharge.customer} foi criada sem automacao externa do Asaas.`,
          metadata: {
            customer: createdCharge.customer,
            amount: createdCharge.amount,
            detail: integrationWarning.message,
          },
        },
      });
    }

    return createdCharge;
  }

  const data = await readDemoWorkspaceData();
  const order = await ensureOrderFromQuote(quoteId);

  if (!order) {
    return null;
  }

  const existingCustomer = data.customers.find((customer) => customer.name === order.customer);
  const localChargeId = randomUUID();
  let externalCharge;
  let integrationWarning: ChargeIntegrationWarning | undefined;

  try {
    externalCharge = await buildExternalBillingForCharge({
      chargeReference: `gf_charge:local:${localChargeId}`,
      customerReference: `gf_customer:local:${existingCustomer?.id || order.customer}`,
      customerName: order.customer,
      customerDocument: existingCustomer?.document,
      customerPhone: existingCustomer?.phone,
      amount: order.amount,
      dueDate,
      description: `Cobranca do pedido ${order.title}`,
      paymentMethod,
    });
  } catch (error) {
    externalCharge = undefined;
    integrationWarning = createIntegrationWarning(
      error instanceof Error
        ? error.message
        : "Falha ao criar cobranca externa no Asaas.",
    );
  }

  const charge: Charge = {
    id: localChargeId,
    customer: order.customer,
    amount: order.amount,
    dueLabel: dueLabel || buildChargeDueLabel({ dueDate, status }),
    dueDate,
    status,
    source: `${paymentMethod} via pedido "${order.title}"`,
    paymentLink: externalCharge?.paymentLink,
    followUps: [],
    cadence: undefined,
    externalBilling: externalCharge?.externalBilling,
    integrationWarning,
  };

  data.charges = [charge, ...data.charges];
  await writeDemoWorkspaceData(data);
  return charge;
}

export async function updateCharge(id: string, input: ChargeUpdateInput): Promise<Charge | null> {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const context = await getCurrentWorkspaceContext();

    const existing = await prisma.charge.findFirst({
      where: {
        id,
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
      include: {
        customer: true,
        order: true,
      },
    });

    if (!existing) {
      return null;
    }

    const currentView = toChargeView(existing);
    const nextStatus = input.status || currentView.status;
    const nextDueDate = Object.prototype.hasOwnProperty.call(input, "dueDate") ? input.dueDate : currentView.dueDate;
    const nextDueLabel = input.dueLabel || buildChargeDueLabel({ dueDate: nextDueDate, status: nextStatus });
    const nextSource = input.source || currentView.source;
    const nextCadence = input.cadence || currentView.cadence;
    const nextExternalBilling = input.externalBilling || currentView.externalBilling;
    const nextIntegrationWarning = Object.prototype.hasOwnProperty.call(input, "integrationWarning")
      ? input.integrationWarning
      : currentView.integrationWarning;
    const nextPaymentLink = input.paymentLink || currentView.paymentLink;

    const updated = await prisma.charge.update({
      where: { id: existing.id },
      data: {
        status: mapChargeStatus(nextStatus),
        version: {
          increment: 1,
        },
        dueDate: parseDueDateInput(nextDueDate),
        paymentLink: nextPaymentLink || null,
        pixCode: encodeChargeMeta({
          dueLabel: nextDueLabel,
          source: nextSource,
          followUps: currentView.followUps,
          cadence: nextCadence,
          externalBilling: nextExternalBilling,
          integrationWarning: nextIntegrationWarning,
        }),
        paidAt: nextStatus === "Pago" ? new Date() : null,
      },
      include: {
        customer: true,
        order: true,
      },
    });

    const updatedView = toChargeView(updated);

    await recordAuditEvent({
      action: "charge.updated",
      entityType: "charge",
      entityId: updated.id,
      payload: {
        summary: `Cobranca de ${updatedView.amount} para ${updatedView.customer} atualizada para ${updatedView.status.toLowerCase()}.`,
        metadata: {
          previousStatus: currentView.status,
          nextStatus: updatedView.status,
          previousDueDate: currentView.dueDate || null,
          nextDueDate: updatedView.dueDate || null,
          dueLabel: updatedView.dueLabel,
        },
      },
      context,
    });

    return updatedView;
  }

  const data = await readDemoWorkspaceData();
  const index = data.charges.findIndex((charge) => charge.id === id);

  if (index === -1) {
    return null;
  }

  const current = data.charges[index];
  const nextStatus = input.status || current.status;
  const nextDueDate = Object.prototype.hasOwnProperty.call(input, "dueDate") ? input.dueDate : current.dueDate;
    const updatedCharge: Charge = {
      ...current,
      status: nextStatus,
      dueDate: nextDueDate,
      dueLabel: input.dueLabel || buildChargeDueLabel({ dueDate: nextDueDate, status: nextStatus }),
      source: input.source || current.source,
      paymentLink: input.paymentLink || current.paymentLink,
      followUps: current.followUps || [],
      cadence: input.cadence || current.cadence,
      externalBilling: input.externalBilling || current.externalBilling,
      integrationWarning: Object.prototype.hasOwnProperty.call(input, "integrationWarning")
        ? input.integrationWarning
        : current.integrationWarning,
    };

  data.charges[index] = updatedCharge;
  await writeDemoWorkspaceData(data);
  return updatedCharge;
}

export async function addChargeFollowUp(id: string, input: ChargeFollowUpInput): Promise<Charge | null> {
  const entry = createFollowUpEntry(input);

  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const context = await getCurrentWorkspaceContext();

    const existing = await prisma.charge.findFirst({
      where: {
        id,
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
      include: {
        customer: true,
        order: true,
      },
    });

    if (!existing) {
      return null;
    }

    const currentView = toChargeView(existing);
    const updated = await prisma.charge.update({
      where: { id: existing.id },
      data: {
        version: {
          increment: 1,
        },
        pixCode: encodeChargeMeta({
          dueLabel: currentView.dueLabel,
          source: currentView.source,
          followUps: [entry, ...currentView.followUps],
          cadence: currentView.cadence,
          externalBilling: currentView.externalBilling,
        }),
      },
      include: {
        customer: true,
        order: true,
      },
    });

    const updatedView = toChargeView(updated);

    await recordAuditEvent({
      action: "charge.followup.created",
      entityType: "charge",
      entityId: updated.id,
      payload: {
        summary: `Follow-up financeiro registrado para ${updatedView.customer} via ${entry.channel.toLowerCase()}.`,
        metadata: {
          customer: updatedView.customer,
          amount: updatedView.amount,
          channel: entry.channel,
          outcome: entry.outcome,
        },
      },
      context,
    });

    return updatedView;
  }

  const data = await readDemoWorkspaceData();
  const index = data.charges.findIndex((charge) => charge.id === id);

  if (index === -1) {
    return null;
  }

  const current = data.charges[index];
  const updatedCharge: Charge = {
    ...current,
    followUps: [entry, ...(current.followUps || [])],
    cadence: current.cadence,
  };

  data.charges[index] = updatedCharge;
  await writeDemoWorkspaceData(data);
  return updatedCharge;
}

export async function deleteCharge(id: string): Promise<void> {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const context = await getCurrentWorkspaceContext();

    const existing = await prisma.charge.findFirst({
      where: {
        id,
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
      include: {
        customer: true,
        order: true,
      },
    });

    await prisma.charge.updateMany({
      where: {
        id,
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        version: {
          increment: 1,
        },
      },
    });

    if (existing) {
      const charge = toChargeView(existing);
      await recordAuditEvent({
        action: "charge.deleted",
        entityType: "charge",
        entityId: existing.id,
        payload: {
          summary: `Cobranca de ${charge.amount} para ${charge.customer} removida do workspace.`,
          metadata: {
            customer: charge.customer,
            amount: charge.amount,
            status: charge.status,
            dueDate: charge.dueDate || null,
          },
        },
        context,
      });
    }
    return;
  }

  const data = await readDemoWorkspaceData();
  data.charges = data.charges.filter((charge) => charge.id !== id);
  await writeDemoWorkspaceData(data);
}
