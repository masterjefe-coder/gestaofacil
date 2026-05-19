import { randomUUID } from "node:crypto";
import { OrderStatus, type Customer as DbCustomer, type Order as DbOrder, type Quote as DbQuote } from "@prisma/client";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
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
    where: { workspaceId },
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

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { customer: true },
  });

  if (!quote || quote.workspaceId !== workspaceId) {
    return null;
  }

  const existing = await prisma.order.findUnique({
    where: { quoteId },
    include: { customer: true, quote: true },
  });

  if (existing && existing.workspaceId === workspaceId) {
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
