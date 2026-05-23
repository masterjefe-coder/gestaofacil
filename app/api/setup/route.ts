import { NextResponse } from "next/server";
import { getLogger } from "@/lib/api-logger";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { ApiInputError, parseSetupPayload, readJsonObject } from "@/lib/api-inputs";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";
import { getWorkspaceSetup, updateWorkspaceSetup } from "@/lib/workspace-settings-repository";

const logger = getLogger({ route: "api/setup" });

export const setupRouteDeps = {
  requireApiModuleAccess,
  getWorkspaceSetup,
  updateWorkspaceSetup,
};

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await setupRouteDeps.requireApiModuleAccess("setup", "canView");
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  try {
    const setup = await setupRouteDeps.getWorkspaceSetup();
    requestLogger.info("Workspace setup fetched");
    return attachRequestId(NextResponse.json({ setup }), requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar o setup.";
    requestLogger.error("Workspace setup fetch failed", error instanceof Error ? error : undefined);
    return attachRequestId(NextResponse.json({ error: message }, { status: 500 }), requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await setupRouteDeps.requireApiModuleAccess(
    "setup",
    "canConfigure",
    "Seu perfil atual nao pode alterar a configuracao da empresa.",
  );
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  try {
    const body = parseSetupPayload(await readJsonObject(request));
    const result = await setupRouteDeps.updateWorkspaceSetup({
      name: body.name,
      slug: body.slug,
      niche: body.niche,
      legalName: body.legalName,
      tradeName: body.tradeName,
      document: body.document,
      city: body.city,
      state: body.state,
      serviceDescription: body.serviceDescription,
      defaultFiscalServiceCode: body.defaultFiscalServiceCode,
      defaultPixKey: body.defaultPixKey,
      defaultPaymentMessage: body.defaultPaymentMessage,
    });
    requestLogger.info("Workspace setup updated", {
      slug: body.slug,
      city: body.city,
      state: body.state,
    });

    return attachRequestId(NextResponse.json({ setup: result }, { status: 200 }), requestId);
  } catch (error) {
    if (error instanceof ApiInputError) {
      requestLogger.warn("Workspace setup update rejected because request payload is invalid", {
        reason: error.message,
      });
      return attachRequestId(NextResponse.json({ error: error.message }, { status: 400 }), requestId);
    }

    const message = error instanceof Error ? error.message : "Falha ao salvar o setup.";
    requestLogger.error("Workspace setup update failed", error instanceof Error ? error : undefined, {
      requestId,
    });
    return attachRequestId(NextResponse.json({ error: message }, { status: 400 }), requestId);
  }
}
