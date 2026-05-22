import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { createQuote, listQuotes } from "@/lib/quote-repository";

export async function GET() {
  const unauthorized = await requireApiModuleAccess("quotes", "canView");
  if (unauthorized) {
    return unauthorized;
  }

  const quotes = await listQuotes();
  return NextResponse.json({ quotes });
}

export async function POST(request: Request) {
  const unauthorized = await requireApiModuleAccess("quotes", "canManage");
  if (unauthorized) {
    return unauthorized;
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
    return NextResponse.json({ error: "Dados obrigatorios ausentes." }, { status: 400 });
  }

  const quote = await createQuote({
    customer: body.customer,
    title: body.title,
    amount: body.amount,
    status: body.status || "Enviado",
    dueLabel: body.dueLabel || "",
    summary: body.summary || "",
  });

  return NextResponse.json({ quote }, { status: 201 });
}
