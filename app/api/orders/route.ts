import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { ensureOrderFromQuote, listOrders, updateOrderStatus } from "@/lib/order-repository";

export async function GET() {
  const unauthorized = await requireApiModuleAccess("orders", "canView");
  if (unauthorized) {
    return unauthorized;
  }

  const orders = await listOrders();
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const unauthorized = await requireApiModuleAccess("orders", "canManage");
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json()) as {
    quoteId?: string;
    id?: string;
    status?: "Pendente" | "Agendado" | "Em execucao" | "Concluido";
    note?: string;
  };

  if (body.quoteId) {
    const order = await ensureOrderFromQuote(body.quoteId);

    if (!order) {
      return NextResponse.json({ error: "Orcamento nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({ order }, { status: 201 });
  }

  if (!body.id || !body.status) {
    return NextResponse.json({ error: "Dados obrigatorios ausentes." }, { status: 400 });
  }

  const order = await updateOrderStatus(body.id, {
    status: body.status,
    note: body.note,
  });

  if (!order) {
    return NextResponse.json({ error: "Pedido nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({ order }, { status: 200 });
}
