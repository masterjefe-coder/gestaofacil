import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { getWorkspaceSetup, updateWorkspaceSetup } from "@/lib/workspace-settings-repository";

export async function GET() {
  const unauthorized = await requireApiModuleAccess("setup", "canView");
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const setup = await getWorkspaceSetup();
    return NextResponse.json({ setup });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar o setup.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireApiModuleAccess(
    "setup",
    "canConfigure",
    "Seu perfil atual nao pode alterar a configuracao da empresa.",
  );
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
    defaultFiscalServiceCode?: string;
    defaultPixKey?: string;
    defaultPaymentMessage?: string;
  };

  if (!body.name || !body.slug || !body.tradeName || !body.document) {
    return NextResponse.json({ error: "Dados obrigatorios ausentes." }, { status: 400 });
  }

  try {
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
      defaultFiscalServiceCode: body.defaultFiscalServiceCode || "",
      defaultPixKey: body.defaultPixKey || "",
      defaultPaymentMessage: body.defaultPaymentMessage || "",
    });

    return NextResponse.json({ setup: result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar o setup.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
