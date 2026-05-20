import { randomUUID } from "node:crypto";
import type { Customer as DbCustomer, Quote as DbQuote } from "@prisma/client";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { recordAuditEvent } from "@/lib/audit-repository";
import { isLocalDataMode } from "@/lib/data-mode";
import { decodeQuoteSummary, encodeCustomerNotes, encodeQuoteSummary, formatCurrency, mapQuoteStatus, parseCurrencyToNumber } from "@/lib/demo-data-codecs";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { prisma } from "@/lib/prisma";
import type { Quote, QuoteInput } from "@/lib/types";
import { readDemoWorkspaceData, writeDemoWorkspaceData } from "@/lib/demo-store";

type QuoteUpdateInput = {
  status?: Quote["status"];
  dueLabel?: string;
  summary?: string;
  cadence?: Quote["cadence"];
};

export async function listQuotes(): Promise<Quote[]> {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const { workspaceId } = await getCurrentWorkspaceContext();

    const quotes = await prisma.quote.findMany({
      where: { workspaceId },
      include: {
        customer: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return quotes.map((quote: DbQuote & { customer: DbCustomer }): Quote => {
      const fallbackStatus: "Enviado" | "Aprovado" = quote.status === "APPROVED" ? "Aprovado" : "Enviado";
      const meta = decodeQuoteSummary(quote.summary, fallbackStatus);

      return {
        id: quote.id,
        customer: quote.customer.name,
        title: quote.title,
        amount: formatCurrency(Number(quote.total)),
        status: meta.status,
        dueLabel: meta.dueLabel,
        summary: meta.summary,
        cadence: meta.cadence,
      };
    });
  }

  const data = await readDemoWorkspaceData();
  return data.quotes;
}

export async function createQuote(input: QuoteInput): Promise<Quote> {
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
            note: "Cliente criado automaticamente a partir de orcamento.",
          }),
        },
      });
    }

    const amount = parseCurrencyToNumber(input.amount);

    const quote = await prisma.quote.create({
      data: {
        workspaceId,
        customerId: customer.id,
        title: input.title,
        summary: encodeQuoteSummary(input),
        status: mapQuoteStatus(input.status),
        subtotal: amount,
        total: amount,
        discount: 0,
      },
    });

    await recordAuditEvent({
      action: "quote.created",
      entityType: "quote",
      entityId: quote.id,
      payload: {
        summary: `Orçamento de ${formatCurrency(Number(quote.total))} criado para ${customer.name}.`,
        metadata: {
          customer: customer.name,
          title: quote.title,
          status: input.status,
        },
      },
    });

    return {
      id: quote.id,
      customer: customer.name,
      title: quote.title,
      amount: formatCurrency(Number(quote.total)),
      status: input.status,
      dueLabel: input.dueLabel || "Acompanhar este orcamento",
      summary: input.summary || "Orcamento criado no dashboard.",
      cadence: input.cadence,
    };
  }

  const data = await readDemoWorkspaceData();

  const quote: Quote = {
    id: randomUUID(),
    customer: input.customer,
    title: input.title,
    amount: input.amount,
    status: input.status,
    dueLabel: input.dueLabel || "Acompanhar este orcamento",
    summary: input.summary || "Orcamento criado no dashboard.",
    cadence: input.cadence,
  };

  data.quotes = [quote, ...data.quotes];
  await writeDemoWorkspaceData(data);
  return quote;
}

export async function updateQuote(id: string, input: QuoteUpdateInput): Promise<Quote | null> {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const { workspaceId } = await getCurrentWorkspaceContext();
    const existing = await prisma.quote.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: {
        customer: true,
      },
    });

    if (!existing) {
      return null;
    }

    const fallbackStatus: "Enviado" | "Aprovado" = existing.status === "APPROVED" ? "Aprovado" : "Enviado";
    const currentMeta = decodeQuoteSummary(existing.summary, fallbackStatus);
    const nextStatus = input.status || currentMeta.status;
    const nextDueLabel = input.dueLabel || currentMeta.dueLabel;
    const nextSummary = input.summary || currentMeta.summary;
    const nextCadence = input.cadence || currentMeta.cadence;

    const updated = await prisma.quote.update({
      where: { id: existing.id },
      data: {
        status: mapQuoteStatus(nextStatus),
        summary: encodeQuoteSummary({
          status: nextStatus,
          dueLabel: nextDueLabel,
          summary: nextSummary,
          cadence: nextCadence,
        }),
      },
      include: {
        customer: true,
      },
    });

    await recordAuditEvent({
      action: "quote.updated",
      entityType: "quote",
      entityId: updated.id,
      payload: {
        summary: `Orçamento de ${updated.customer.name} atualizado para ${nextStatus.toLowerCase()}.`,
        metadata: {
          customer: updated.customer.name,
          title: updated.title,
          status: nextStatus,
          dueLabel: nextDueLabel,
        },
      },
    });

    return {
      id: updated.id,
      customer: updated.customer.name,
      title: updated.title,
      amount: formatCurrency(Number(updated.total)),
      status: nextStatus,
      dueLabel: nextDueLabel,
      summary: nextSummary,
      cadence: nextCadence,
    };
  }

  const data = await readDemoWorkspaceData();
  const index = data.quotes.findIndex((quote) => quote.id === id);

  if (index === -1) {
    return null;
  }

  const current = data.quotes[index];
    const updated: Quote = {
      ...current,
      status: input.status || current.status,
      dueLabel: input.dueLabel || current.dueLabel,
      summary: input.summary || current.summary,
      cadence: input.cadence || current.cadence,
    };

  data.quotes[index] = updated;
  await writeDemoWorkspaceData(data);
  return updated;
}

export async function deleteQuote(id: string): Promise<void> {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const { workspaceId } = await getCurrentWorkspaceContext();

    await prisma.quote.deleteMany({
      where: {
        id,
        workspaceId,
      },
    });
    return;
  }

  const data = await readDemoWorkspaceData();
  data.quotes = data.quotes.filter((quote) => quote.id !== id);
  await writeDemoWorkspaceData(data);
}
