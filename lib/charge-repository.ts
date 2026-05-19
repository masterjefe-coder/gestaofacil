import { randomUUID } from "node:crypto";
import type { Charge as DbCharge, Customer as DbCustomer, Order as DbOrder } from "@prisma/client";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
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
import { ensureOrderFromQuote } from "@/lib/order-repository";
import { prisma } from "@/lib/prisma";
import type { Charge, ChargeInput } from "@/lib/types";

export async function listCharges(): Promise<Charge[]> {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const { workspaceId } = await getCurrentWorkspaceContext();

    const charges = await prisma.charge.findMany({
      where: { workspaceId },
      include: {
        customer: true,
        order: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return charges.map((charge: DbCharge & { customer: DbCustomer; order: DbOrder }): Charge => {
      const fallback = {
        dueLabel: charge.dueDate
          ? formatDueDateLabel(charge.dueDate)
          : "acompanhar cobranca",
        source: charge.paymentMethod,
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
      };
    });
  }

  const data = await readDemoWorkspaceData();
  return data.charges;
}

export async function createCharge(input: ChargeInput): Promise<Charge> {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const { workspaceId } = await getCurrentWorkspaceContext();

    let customer = await prisma.customer.findFirst({
      where: {
        workspaceId,
        name: input.customer,
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

    return {
      id: charge.id,
      customer: customer.name,
      amount: formatCurrency(Number(charge.amount)),
      dueLabel: buildChargeDueLabel(input),
      dueDate: input.dueDate,
      status: input.status,
      source: input.source,
    };
  }

  const data = await readDemoWorkspaceData();

  const charge: Charge = {
    id: randomUUID(),
    customer: input.customer,
    amount: input.amount,
    dueLabel: buildChargeDueLabel(input),
    dueDate: input.dueDate,
    status: input.status,
    source: input.source,
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

    const dbOrder = await prisma.order.findUnique({
      where: { id: order.id },
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
        }),
        dueDate: parseDueDateInput(dueDate),
      },
    });

    return {
      id: charge.id,
      customer: dbOrder.customer.name,
      amount: formatCurrency(Number(charge.amount)),
      dueLabel: dueLabel || buildChargeDueLabel({ dueDate, status }),
      dueDate,
      status,
      source: `${paymentMethod} via orcamento "${dbOrder.quote.title}"`,
    };
  }

  const data = await readDemoWorkspaceData();
  const order = await ensureOrderFromQuote(quoteId);

  if (!order) {
    return null;
  }

  const charge: Charge = {
    id: randomUUID(),
    customer: order.customer,
    amount: order.amount,
    dueLabel: dueLabel || buildChargeDueLabel({ dueDate, status }),
    dueDate,
    status,
    source: `${paymentMethod} via pedido "${order.title}"`,
  };

  data.charges = [charge, ...data.charges];
  await writeDemoWorkspaceData(data);
  return charge;
}

export async function deleteCharge(id: string): Promise<void> {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const { workspaceId } = await getCurrentWorkspaceContext();

    await prisma.charge.deleteMany({
      where: {
        id,
        workspaceId,
      },
    });
    return;
  }

  const data = await readDemoWorkspaceData();
  data.charges = data.charges.filter((charge) => charge.id !== id);
  await writeDemoWorkspaceData(data);
}
