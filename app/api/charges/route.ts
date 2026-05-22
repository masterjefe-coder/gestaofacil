import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { createCharge, createChargeFromQuote, listCharges } from "@/lib/charge-repository";

export async function GET() {
  const unauthorized = await requireApiModuleAccess("billing", "canView");
  if (unauthorized) {
    return unauthorized;
  }

  const charges = await listCharges();
  return NextResponse.json({ charges });
}

export async function POST(request: Request) {
  const unauthorized = await requireApiModuleAccess(
    "billing",
    "canManage",
    "Seu perfil atual pode acompanhar a fila financeira, mas nao criar ou alterar cobrancas.",
  );
  if (unauthorized) {
    return unauthorized;
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
      return NextResponse.json({ error: "Orcamento nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({ charge }, { status: 201 });
  }

  if (!body.customer || !body.amount) {
    return NextResponse.json({ error: "Dados obrigatorios ausentes." }, { status: 400 });
  }

  const charge = await createCharge({
    customer: body.customer,
    amount: body.amount,
    dueLabel: body.dueLabel || "",
    dueDate: body.dueDate,
    status: body.status || "Pendente",
    source: body.source || body.paymentMethod || "Pix",
  });

  return NextResponse.json({ charge }, { status: 201 });
}
