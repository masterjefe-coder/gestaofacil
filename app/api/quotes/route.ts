import { NextResponse } from "next/server";
import { getLogger } from "@/lib/api-logger";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";
import { createQuote, listQuotes } from "@/lib/quote-repository";

const logger = getLogger({ route: "api/quotes" });

export const quotesRouteDeps = {
  requireApiModuleAccess,
  listQuotes,
  createQuote,
};

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await quotesRouteDeps.requireApiModuleAccess("quotes", "canView");
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  const quotes = await quotesRouteDeps.listQuotes();
  requestLogger.info("Quotes listed", { count: quotes.length });
  return attachRequestId(NextResponse.json({ quotes }), requestId);
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await quotesRouteDeps.requireApiModuleAccess("quotes", "canManage");
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  const body = (await request.json()) as {
    customer?: string;
    title?: string;
    amount?: string;
    status?: "Enviado" | "Aprovado" | "Follow-up";
    dueLabel?: string;
    summary?: string;
  };

  if (!body.customer || !body.title || !body.amount) {
    requestLogger.warn("Quote creation rejected — missing required fields");
    return attachRequestId(NextResponse.json({ error: "Dados obrigatorios ausentes." }, { status: 400 }), requestId);
  }

  const quote = await quotesRouteDeps.createQuote({
    customer: body.customer,
    title: body.title,
    amount: body.amount,
    status: body.status || "Enviado",
    dueLabel: body.dueLabel || "",
    summary: body.summary || "",
  });

  requestLogger.info("Quote created", { quoteId: quote.id, customer: body.customer, amount: quote.amount });
  return attachRequestId(NextResponse.json({ quote }, { status: 201 }), requestId);
}
