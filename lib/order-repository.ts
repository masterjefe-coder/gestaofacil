import { randomUUID } from "node:crypto";
import { OrderStatus, type Customer as DbCustomer, type Order as DbOrder, type Quote as DbQuote } from "@prisma/client";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { recordAuditEvent } from "@/lib/audit-repository";
import { isLocalDataMode } from "@/lib/data-mode";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { prisma } from "@/lib/prisma";
import { readDemoWorkspaceData, writeDemoWorkspaceData } from "@/lib/demo-store";
import type { Order } from "@/lib/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function mapOrderStatus(status: Order["status"]): OrderStatus {
  switch (status) {
    case "Agendado":
      return "SCHEDULED";
    case "Em execucao":
      return "IN_PROGRESS";
    case "Concluido":
      return "COMPLETED";
    default:
      return "PENDING";
  }
}

function mapDbOrderStatus(status: OrderStatus): Order["status"] {
  switch (status) {
    case "SCHEDULED":
      return "Agendado";
    case "IN_PROGRESS":
      return "Em execucao";
    case "COMPLETED":
      return "Concluido";
    default:
      return "Pendente";
  }
}

export async function listOrders(): Promise<Order[]> {
  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    return data.orders;
  }

  await ensureDemoCommerceSeeded();
  const { workspaceId } = await getCurrentWorkspaceContext();
  const orders = await prisma.order.findMany({
    where: {
      workspaceId,
      deletedAt: null,
    },
    include: {
      customer: true,
      quote: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((order: DbOrder & { customer: DbCustomer; quote: DbQuote }): Order => ({
    id: order.id,
    customer: order.customer.name,
    title: order.quote.title,
    amount: formatCurrency(Number(order.quote.total)),
    status: mapDbOrderStatus(order.status),
    sourceQuoteId: order.quoteId,
    note: order.internalNotes || "Pedido sem observacoes.",
  }));
}

export async function ensureOrderFromQuote(quoteId: string): Promise<Order | null> {
  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    const existing = data.orders.find((order) => order.sourceQuoteId === quoteId);

    if (existing) {
      return existing;
    }

    const quote = data.quotes.find((item) => item.id === quoteId);

    if (!quote) {
      return null;
    }

    const order: Order = {
      id: randomUUID(),
      customer: quote.customer,
      title: quote.title,
      amount: quote.amount,
      status: "Pendente",
      sourceQuoteId: quote.id,
      note: "Pedido gerado a partir de orcamento aprovado.",
    };

    data.orders = [order, ...data.orders];
    await writeDemoWorkspaceData(data);
    return order;
  }

  await ensureDemoCommerceSeeded();
  const { workspaceId } = await getCurrentWorkspaceContext();

  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      workspaceId,
      deletedAt: null,
    },
    include: { customer: true },
  });

  if (!quote) {
    return null;
  }

  const existing = await prisma.order.findFirst({
    where: {
      quoteId,
      workspaceId,
      deletedAt: null,
    },
    include: { customer: true, quote: true },
  });

  if (existing) {
    return {
      id: existing.id,
      customer: existing.customer.name,
      title: existing.quote.title,
      amount: formatCurrency(Number(existing.quote.total)),
      status: mapDbOrderStatus(existing.status),
      sourceQuoteId: existing.quoteId,
      note: existing.internalNotes || "Pedido gerado anteriormente.",
    };
  }

  const created = await prisma.order.create({
    data: {
      workspaceId,
      customerId: quote.customerId,
      quoteId: quote.id,
      status: mapOrderStatus("Pendente"),
      internalNotes: "Pedido gerado a partir de orcamento aprovado.",
    },
    include: {
      customer: true,
      quote: true,
    },
  });

  return {
    id: created.id,
    customer: created.customer.name,
    title: created.quote.title,
    amount: formatCurrency(Number(created.quote.total)),
    status: mapDbOrderStatus(created.status),
    sourceQuoteId: created.quoteId,
    note: created.internalNotes || "Pedido gerado a partir de orcamento aprovado.",
  };
}

export async function updateOrderStatus(
  id: string,
  input: { status: Order["status"]; note?: string },
): Promise<Order | null> {
  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    const index = data.orders.findIndex((order) => order.id === id);

    if (index === -1) {
      return null;
    }

    const current = data.orders[index];
    const updated: Order = {
      ...current,
      status: input.status,
      note: input.note || current.note,
    };

    data.orders[index] = updated;
    await writeDemoWorkspaceData(data);
    return updated;
  }

  await ensureDemoCommerceSeeded();
  const context = await getCurrentWorkspaceContext();
  const existing = await prisma.order.findFirst({
    where: {
      id,
      workspaceId: context.workspaceId,
      deletedAt: null,
    },
    include: {
      customer: true,
      quote: true,
    },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.order.update({
    where: { id: existing.id },
    data: {
      status: mapOrderStatus(input.status),
      version: {
        increment: 1,
      },
      internalNotes: input.note || existing.internalNotes,
      scheduledFor: input.status === "Agendado" ? (existing.scheduledFor || new Date()) : existing.scheduledFor,
      completedAt: input.status === "Concluido" ? new Date() : null,
    },
    include: {
      customer: true,
      quote: true,
    },
  });

  const view: Order = {
    id: updated.id,
    customer: updated.customer.name,
    title: updated.quote.title,
    amount: formatCurrency(Number(updated.quote.total)),
    status: mapDbOrderStatus(updated.status),
    sourceQuoteId: updated.quoteId,
    note: updated.internalNotes || "Pedido sem observacoes.",
  };

  await recordAuditEvent({
    action: "order.updated",
    entityType: "order",
    entityId: updated.id,
    context,
    payload: {
      summary: `Pedido de ${view.customer} atualizado para ${view.status.toLowerCase()}.`,
      metadata: {
        customer: view.customer,
        status: view.status,
      },
    },
  });

  return view;
}
