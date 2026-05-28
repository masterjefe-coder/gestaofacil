import { NextResponse } from "next/server";
import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/auth-session";
import { requireApiSession } from "@/lib/api-auth";
import { getLogger } from "@/lib/api-logger";
import { EvolutionApiError, getEvolutionConnectionState } from "@/lib/evolution-api";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";
import { getWorkspaceEvolutionInstanceName } from "@/lib/workspace-settings-repository";

const logger = getLogger({ route: "api/evolution/status" });

export const evolutionStatusRouteDeps = {
  requireApiSession,
  getCurrentWorkspaceContext,
  getEvolutionConnectionState,
  getWorkspaceEvolutionInstanceName,
};

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await evolutionStatusRouteDeps.requireApiSession();
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  const context = await evolutionStatusRouteDeps.getCurrentWorkspaceContext();
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
  const configuredInstanceName = (await evolutionStatusRouteDeps.getWorkspaceEvolutionInstanceName()).trim();

  if (!configuredInstanceName) {
    requestLogger.warn("Evolution status rejected because workspace has no bound instance");
    return attachRequestId(
      NextResponse.json({ error: "Defina primeiro a instÃ¢ncia principal do WhatsApp desta empresa." }, { status: 409 }),
      requestId,
    );
  }

  if (!instanceName) {
    requestLogger.warn("Evolution status rejected because instance is missing");
    return attachRequestId(
      NextResponse.json({ error: "Informe a conexão que deve ser consultada." }, { status: 400 }),
      requestId,
    );
  }

  if (instanceName !== configuredInstanceName) {
    requestLogger.warn("Evolution status rejected because requested instance does not match workspace binding", {
      configuredInstanceName,
      instanceName,
    });
    return attachRequestId(
      NextResponse.json({ error: "Essa conexÃ£o nÃ£o pertence ao WhatsApp principal desta empresa." }, { status: 403 }),
      requestId,
    );
  }

  try {
    const result = await evolutionStatusRouteDeps.getEvolutionConnectionState(instanceName);
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
