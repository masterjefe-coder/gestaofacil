import { NextResponse } from "next/server";
import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/auth-session";
import { requireApiSession } from "@/lib/api-auth";
import { getLogger } from "@/lib/api-logger";
import { connectEvolutionInstance, EvolutionApiError } from "@/lib/evolution-api";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";
import { getWorkspaceEvolutionInstanceName } from "@/lib/workspace-settings-repository";

const logger = getLogger({ route: "api/evolution/pairing" });

export const evolutionPairingRouteDeps = {
  requireApiSession,
  getCurrentWorkspaceContext,
  connectEvolutionInstance,
  getWorkspaceEvolutionInstanceName,
};

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await evolutionPairingRouteDeps.requireApiSession();
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  const context = await evolutionPairingRouteDeps.getCurrentWorkspaceContext();
  if (!canManageWorkspace(context.workspaceRole)) {
    requestLogger.warn("Evolution pairing rejected because workspace role cannot manage setup", {
      workspaceRole: context.workspaceRole,
    });
    return attachRequestId(
      NextResponse.json({ error: "Apenas owner ou admin podem gerar o pareamento do WhatsApp." }, { status: 403 }),
      requestId,
    );
  }

  const { searchParams } = new URL(request.url);
  const instanceName = searchParams.get("instance")?.trim();
  const configuredInstanceName = (await evolutionPairingRouteDeps.getWorkspaceEvolutionInstanceName()).trim();

  if (!configuredInstanceName) {
    requestLogger.warn("Evolution pairing rejected because workspace has no bound instance");
    return attachRequestId(
      NextResponse.json({ error: "Defina primeiro a instÃ¢ncia principal do WhatsApp desta empresa." }, { status: 409 }),
      requestId,
    );
  }

  if (!instanceName) {
    requestLogger.warn("Evolution pairing rejected because instance is missing");
    return attachRequestId(
      NextResponse.json({ error: "Informe a instância que deve gerar o pareamento." }, { status: 400 }),
      requestId,
    );
  }

  if (instanceName !== configuredInstanceName) {
    requestLogger.warn("Evolution pairing rejected because requested instance does not match workspace binding", {
      configuredInstanceName,
      instanceName,
    });
    return attachRequestId(
      NextResponse.json({ error: "Essa conexÃ£o nÃ£o pertence ao WhatsApp principal desta empresa." }, { status: 403 }),
      requestId,
    );
  }

  try {
    const result = await evolutionPairingRouteDeps.connectEvolutionInstance(instanceName);
    requestLogger.info("Evolution pairing requested", {
      instanceName,
      hasPairingCode: Boolean(result.pairingCode),
      hasQrCode: Boolean(result.base64),
    });

    return attachRequestId(
      NextResponse.json({
        ok: true,
        instanceName,
        message: `Pareamento solicitado para ${instanceName}.`,
        pairingCode: result.pairingCode || null,
        qrCode: result.base64 || null,
        rawCode: result.code || null,
      }),
      requestId,
    );
  } catch (error) {
    const message =
      error instanceof EvolutionApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Não foi possível gerar o pareamento da instância.";
    requestLogger.error("Evolution pairing failed", error instanceof Error ? error : undefined, {
      instanceName,
    });

    return attachRequestId(NextResponse.json({ ok: false, error: message }, { status: 500 }), requestId);
  }
}
