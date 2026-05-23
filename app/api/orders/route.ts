import { NextResponse } from "next/server";
import { getLogger } from "@/lib/api-logger";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { ApiInputError, parseOrderPayload, readJsonObject } from "@/lib/api-inputs";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";
import { ensureOrderFromQuote, listOrders, updateOrderStatus } from "@/lib/order-repository";

const logger = getLogger({ route: "api/orders" });

export const ordersRouteDeps = {
  requireApiModuleAccess,
  listOrders,
  ensureOrderFromQuote,
  updateOrderStatus,
};

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await ordersRouteDeps.requireApiModuleAccess("orders", "canView");
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  const orders = await ordersRouteDeps.listOrders();
  requestLogger.info("Orders listed", { count: orders.length });
  return attachRequestId(NextResponse.json({ orders }), requestId);
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await ordersRouteDeps.requireApiModuleAccess("orders", "canManage");
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  try {
    const body = parseOrderPayload(await readJsonObject(request));

    if (body.mode === "create-from-quote") {
      const order = await ordersRouteDeps.ensureOrderFromQuote(body.quoteId);

      if (!order) {
        requestLogger.warn("Order creation from quote failed — quote not found", { quoteId: body.quoteId });
        return attachRequestId(NextResponse.json({ error: "Orcamento nao encontrado." }, { status: 404 }), requestId);
      }

      requestLogger.info("Order created from quote", { orderId: order.id, quoteId: body.quoteId });
      return attachRequestId(NextResponse.json({ order }, { status: 201 }), requestId);
    }

    const order = await ordersRouteDeps.updateOrderStatus(body.id, {
      status: body.status,
      note: body.note,
    });

    if (!order) {
      requestLogger.warn("Order update failed — order not found", { orderId: body.id });
      return attachRequestId(NextResponse.json({ error: "Pedido nao encontrado." }, { status: 404 }), requestId);
    }

    requestLogger.info("Order status updated", { orderId: order.id, status: body.status });
    return attachRequestId(NextResponse.json({ order }, { status: 200 }), requestId);
  } catch (error) {
    if (error instanceof ApiInputError) {
      requestLogger.warn("Order mutation rejected — invalid request payload", { reason: error.message });
      return attachRequestId(NextResponse.json({ error: error.message }, { status: 400 }), requestId);
    }

    const message = error instanceof Error ? error.message : "Falha ao atualizar o pedido.";
    requestLogger.error("Order mutation failed", error instanceof Error ? error : undefined);
    return attachRequestId(NextResponse.json({ error: message }, { status: 400 }), requestId);
  }
}
