import { NextResponse } from "next/server";
import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/auth-session";
import { requireApiSession } from "@/lib/api-auth";
import { getLogger } from "@/lib/api-logger";
import { EvolutionApiError, getEvolutionConnectionState } from "@/lib/evolution-api";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";

const logger = getLogger({ route: "api/evolution/status" });

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  const context = await getCurrentWorkspaceContext();
  if (!canManageWorkspace(context.workspaceRole)) {
    requestLogger.warn("Evolution status rejected because workspace role cannot manage setup", {
      workspaceRole: context.workspaceRole,
    });
    return attachRequestId(
      NextResponse.json({ error: "Apenas owner ou admin podem consultar o status do WhatsApp." }, { status: 403 }),
      requestId,
    );
  }

  const { searchParams } = new URL(request.url);
  const instanceName = searchParams.get("instance")?.trim();

  if (!instanceName) {
    requestLogger.warn("Evolution status rejected because instance is missing");
    return attachRequestId(
      NextResponse.json({ error: "Informe a conexão que deve ser consultada." }, { status: 400 }),
      requestId,
    );
  }

  try {
    const result = await getEvolutionConnectionState(instanceName);
    const state = result.instance?.state || "unknown";
    requestLogger.info("Evolution status fetched", {
      instanceName,
      state,
      connected: state === "open",
    });

    return attachRequestId(
      NextResponse.json({
        ok: true,
        instanceName,
        state,
        connected: state === "open",
      }),
      requestId,
    );
  } catch (error) {
    const message =
      error instanceof EvolutionApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Não foi possível consultar o status da conexão.";
    requestLogger.error("Evolution status lookup failed", error instanceof Error ? error : undefined, {
      instanceName,
    });

    return attachRequestId(NextResponse.json({ ok: false, error: message }, { status: 500 }), requestId);
  }
}
