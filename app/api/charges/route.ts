import { NextResponse } from "next/server";
import { getLogger } from "@/lib/api-logger";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";
import { createCharge, createChargeFromQuote, listCharges } from "@/lib/charge-repository";

const logger = getLogger({ route: "api/charges" });

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await requireApiModuleAccess("billing", "canView");
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  const charges = await listCharges();
  requestLogger.info("Charges listed", { count: charges.length });
  return attachRequestId(NextResponse.json({ charges }), requestId);
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await requireApiModuleAccess(
    "billing",
    "canManage",
    "Seu perfil atual pode acompanhar a fila financeira, mas nao criar ou alterar cobrancas.",
  );
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  const body = (await request.json()) as {
    quoteId?: string;
    paymentMethod?: string;
    customer?: string;
    amount?: string;
    dueLabel?: string;
    dueDate?: string;
    status?: "Pendente" | "Hoje" | "Pago";
    source?: string;
  };

  if (body.quoteId) {
    const charge = await createChargeFromQuote(
      body.quoteId,
      body.paymentMethod || "Pix",
      body.dueLabel || "",
      body.dueDate,
      body.status || "Pendente",
    );

    if (!charge) {
      requestLogger.warn("Charge creation from quote failed — quote not found", { quoteId: body.quoteId });
      return attachRequestId(NextResponse.json({ error: "Orcamento nao encontrado." }, { status: 404 }), requestId);
    }

    requestLogger.info("Charge created from quote", {
      chargeId: charge.id,
      quoteId: body.quoteId,
      amount: charge.amount,
    });
    return attachRequestId(NextResponse.json({ charge }, { status: 201 }), requestId);
  }

  if (!body.customer || !body.amount) {
    requestLogger.warn("Charge creation rejected — missing required fields");
    return attachRequestId(NextResponse.json({ error: "Dados obrigatorios ausentes." }, { status: 400 }), requestId);
  }

  const charge = await createCharge({
    customer: body.customer,
    amount: body.amount,
    dueLabel: body.dueLabel || "",
    dueDate: body.dueDate,
    status: body.status || "Pendente",
    source: body.source || body.paymentMethod || "Pix",
  });

  requestLogger.info("Charge created", { chargeId: charge.id, customer: body.customer, amount: charge.amount });
  return attachRequestId(NextResponse.json({ charge }, { status: 201 }), requestId);
}
