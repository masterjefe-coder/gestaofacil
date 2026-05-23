import { NextResponse } from "next/server";
import { getLogger } from "@/lib/api-logger";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { ApiInputError, parseChargePayload, readJsonObject } from "@/lib/api-inputs";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";
import { createCharge, createChargeFromQuote, listCharges } from "@/lib/charge-repository";

const logger = getLogger({ route: "api/charges" });

export const chargesRouteDeps = {
  requireApiModuleAccess,
  listCharges,
  createChargeFromQuote,
  createCharge,
};

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await chargesRouteDeps.requireApiModuleAccess("billing", "canView");
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  const charges = await chargesRouteDeps.listCharges();
  requestLogger.info("Charges listed", { count: charges.length });
  return attachRequestId(NextResponse.json({ charges }), requestId);
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await chargesRouteDeps.requireApiModuleAccess(
    "billing",
    "canManage",
    "Seu perfil atual pode acompanhar a fila financeira, mas nao criar ou alterar cobrancas.",
  );
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  try {
    const body = parseChargePayload(await readJsonObject(request));

    if (body.mode === "create-from-quote") {
      const charge = await chargesRouteDeps.createChargeFromQuote(
        body.quoteId,
        body.paymentMethod,
        body.dueLabel,
        body.dueDate,
        body.status,
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

    const charge = await chargesRouteDeps.createCharge(body);

    requestLogger.info("Charge created", { chargeId: charge.id, customer: body.customer, amount: charge.amount });
    return attachRequestId(NextResponse.json({ charge }, { status: 201 }), requestId);
  } catch (error) {
    if (error instanceof ApiInputError) {
      requestLogger.warn("Charge creation rejected — invalid request payload", { reason: error.message });
      return attachRequestId(NextResponse.json({ error: error.message }, { status: 400 }), requestId);
    }

    const message = error instanceof Error ? error.message : "Falha ao criar a cobranca.";
    requestLogger.error("Charge creation failed", error instanceof Error ? error : undefined);
    return attachRequestId(NextResponse.json({ error: message }, { status: 400 }), requestId);
  }
}
