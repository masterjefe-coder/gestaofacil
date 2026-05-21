import { NextResponse } from "next/server";
import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/auth-session";
import { requireApiSession } from "@/lib/api-auth";
import { EvolutionApiError, getEvolutionConnectionState } from "@/lib/evolution-api";

export async function GET(request: Request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  const context = await getCurrentWorkspaceContext();
  if (!canManageWorkspace(context.workspaceRole)) {
    return NextResponse.json({ error: "Apenas owner ou admin podem consultar o status do WhatsApp." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const instanceName = searchParams.get("instance")?.trim();

  if (!instanceName) {
    return NextResponse.json({ error: "Informe a conexão que deve ser consultada." }, { status: 400 });
  }

  try {
    const result = await getEvolutionConnectionState(instanceName);
    const state = result.instance?.state || "unknown";

    return NextResponse.json({
      ok: true,
      instanceName,
      state,
      connected: state === "open",
    });
  } catch (error) {
    const message =
      error instanceof EvolutionApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Não foi possível consultar o status da conexão.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
