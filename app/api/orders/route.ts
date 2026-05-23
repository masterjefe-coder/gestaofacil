import { NextResponse } from "next/server";
import { getLogger } from "@/lib/api-logger";
import { requireApiModuleAccess } from "@/lib/api-auth";
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

  const body = (await request.json()) as {
    quoteId?: string;
    id?: string;
    status?: "Pendente" | "Agendado" | "Em execucao" | "Concluido";
    note?: string;
  };

  if (body.quoteId) {
    const order = await ordersRouteDeps.ensureOrderFromQuote(body.quoteId);

    if (!order) {
      requestLogger.warn("Order creation from quote failed — quote not found", { quoteId: body.quoteId });
      return attachRequestId(NextResponse.json({ error: "Orcamento nao encontrado." }, { status: 404 }), requestId);
    }

    requestLogger.info("Order created from quote", { orderId: order.id, quoteId: body.quoteId });
    return attachRequestId(NextResponse.json({ order }, { status: 201 }), requestId);
  }

  if (!body.id || !body.status) {
    requestLogger.warn("Order update rejected — missing required fields");
    return attachRequestId(NextResponse.json({ error: "Dados obrigatorios ausentes." }, { status: 400 }), requestId);
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
}
