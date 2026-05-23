import { NextResponse } from "next/server";
import { getLogger } from "@/lib/api-logger";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { ApiInputError, parseQuotePayload, readJsonObject } from "@/lib/api-inputs";
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

  try {
    const body = parseQuotePayload(await readJsonObject(request));
    const quote = await quotesRouteDeps.createQuote(body);

    requestLogger.info("Quote created", { quoteId: quote.id, customer: body.customer, amount: quote.amount });
    return attachRequestId(NextResponse.json({ quote }, { status: 201 }), requestId);
  } catch (error) {
    if (error instanceof ApiInputError) {
      requestLogger.warn("Quote creation rejected — invalid request payload", { reason: error.message });
      return attachRequestId(NextResponse.json({ error: error.message }, { status: 400 }), requestId);
    }

    const message = error instanceof Error ? error.message : "Falha ao criar o orcamento.";
    requestLogger.error("Quote creation failed", error instanceof Error ? error : undefined);
    return attachRequestId(NextResponse.json({ error: message }, { status: 400 }), requestId);
  }
}
