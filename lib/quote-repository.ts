import { randomUUID } from "node:crypto";
import type { Customer as DbCustomer, Quote as DbQuote } from "@prisma/client";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { isLocalDataMode } from "@/lib/data-mode";
import { decodeQuoteSummary, encodeCustomerNotes, encodeQuoteSummary, formatCurrency, mapQuoteStatus, parseCurrencyToNumber } from "@/lib/demo-data-codecs";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { prisma } from "@/lib/prisma";
import type { Quote, QuoteInput } from "@/lib/types";
import { readDemoWorkspaceData, writeDemoWorkspaceData } from "@/lib/demo-store";

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

    return {
      id: quote.id,
      customer: customer.name,
      title: quote.title,
      amount: formatCurrency(Number(quote.total)),
      status: input.status,
      dueLabel: input.dueLabel || "Acompanhar este orcamento",
      summary: input.summary || "Orcamento criado no dashboard.",
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
  };

  data.quotes = [quote, ...data.quotes];
  await writeDemoWorkspaceData(data);
  return quote;
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
