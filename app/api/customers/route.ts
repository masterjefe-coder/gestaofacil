import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { createCustomer, listCustomers } from "@/lib/customer-repository";

export async function GET() {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  const customers = await listCustomers();
  return NextResponse.json({ customers });
}

export async function POST(request: Request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json()) as {
    name?: string;
    document?: string;
    segment?: string;
    city?: string;
    status?: "Ativo" | "Aguardando retorno" | "Recorrente";
    note?: string;
  };

  if (!body.name || !body.segment || !body.city) {
    return NextResponse.json({ error: "Dados obrigatorios ausentes." }, { status: 400 });
  }

  const customer = await createCustomer({
    name: body.name,
    document: body.document || undefined,
    segment: body.segment,
    city: body.city,
    status: body.status || "Ativo",
    note: body.note || "",
  });

  return NextResponse.json({ customer }, { status: 201 });
}
