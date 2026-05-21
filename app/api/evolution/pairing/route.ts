import { NextResponse } from "next/server";
import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/auth-session";
import { requireApiSession } from "@/lib/api-auth";
import { connectEvolutionInstance, EvolutionApiError } from "@/lib/evolution-api";

export async function GET(request: Request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  const context = await getCurrentWorkspaceContext();
  if (!canManageWorkspace(context.workspaceRole)) {
    return NextResponse.json({ error: "Apenas owner ou admin podem gerar o pareamento do WhatsApp." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const instanceName = searchParams.get("instance")?.trim();

  if (!instanceName) {
    return NextResponse.json({ error: "Informe a instância que deve gerar o pareamento." }, { status: 400 });
  }

  try {
    const result = await connectEvolutionInstance(instanceName);

    return NextResponse.json({
      ok: true,
      instanceName,
      message: `Pareamento solicitado para ${instanceName}.`,
      pairingCode: result.pairingCode || null,
      qrCode: result.base64 || null,
      rawCode: result.code || null,
    });
  } catch (error) {
    const message =
      error instanceof EvolutionApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Não foi possível gerar o pareamento da instância.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
