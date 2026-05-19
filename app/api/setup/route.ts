import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { getWorkspaceSetup, updateWorkspaceSetup } from "@/lib/workspace-settings-repository";

export async function GET() {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  const setup = await getWorkspaceSetup();
  return NextResponse.json({ setup });
}

export async function POST(request: Request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json()) as {
    name?: string;
    slug?: string;
    niche?: string;
    legalName?: string;
    tradeName?: string;
    document?: string;
    city?: string;
    state?: string;
    serviceDescription?: string;
    defaultPixKey?: string;
    defaultPaymentMessage?: string;
  };

  if (!body.name || !body.slug || !body.tradeName || !body.document) {
    return NextResponse.json({ error: "Dados obrigatorios ausentes." }, { status: 400 });
  }

  const result = await updateWorkspaceSetup({
    name: body.name,
    slug: body.slug,
    niche: body.niche || "",
    legalName: body.legalName || "",
    tradeName: body.tradeName,
    document: body.document,
    city: body.city || "",
    state: body.state || "",
    serviceDescription: body.serviceDescription || "",
    defaultPixKey: body.defaultPixKey || "",
    defaultPaymentMessage: body.defaultPaymentMessage || "",
  });

  return NextResponse.json({ setup: result }, { status: 200 });
}
