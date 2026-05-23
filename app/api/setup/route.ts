import { NextResponse } from "next/server";
import { getLogger } from "@/lib/api-logger";
import { requireApiModuleAccess } from "@/lib/api-auth";
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
    requestLogger.warn("Workspace setup update rejected because required fields are missing");
    return attachRequestId(NextResponse.json({ error: "Dados obrigatorios ausentes." }, { status: 400 }), requestId);
  }

  try {
    const result = await setupRouteDeps.updateWorkspaceSetup({
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
    requestLogger.info("Workspace setup updated", {
      slug: body.slug,
      city: body.city || "",
      state: body.state || "",
    });

    return attachRequestId(NextResponse.json({ setup: result }, { status: 200 }), requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar o setup.";
    requestLogger.error("Workspace setup update failed", error instanceof Error ? error : undefined, {
      slug: body.slug,
    });
    return attachRequestId(NextResponse.json({ error: message }, { status: 400 }), requestId);
  }
}
