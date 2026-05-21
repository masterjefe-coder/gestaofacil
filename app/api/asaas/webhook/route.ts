import { NextRequest, NextResponse } from "next/server";
import { handleAsaasWebhook } from "@/lib/asaas-webhook";
import { isWebhookSecretConfigured } from "@/lib/runtime-safety";

function isAuthorized(request: NextRequest) {
  const configuredToken = process.env.ASAAS_WEBHOOK_AUTH_TOKEN?.trim();

  const receivedToken = request.headers.get("asaas-access-token")?.trim();
  return Boolean(configuredToken) && receivedToken === configuredToken;
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "gestao-facil-asaas-webhook",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  if (!isWebhookSecretConfigured(process.env.ASAAS_WEBHOOK_AUTH_TOKEN)) {
    return NextResponse.json({ error: "Webhook desabilitado ate configurar ASAAS_WEBHOOK_AUTH_TOKEN." }, { status: 503 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Webhook nao autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = body ? await handleAsaasWebhook(body) : null;

  return NextResponse.json({
    received: true,
    hasBody: Boolean(body),
    stored: result?.stored || false,
    duplicate: "duplicate" in (result || {}) ? Boolean((result as { duplicate?: boolean }).duplicate) : false,
    event: result && "event" in result ? result.event : null,
    linkedChargeId: result && "chargeId" in result ? result.chargeId : null,
    workspaceId: result && "workspaceId" in result ? result.workspaceId : null,
    timestamp: new Date().toISOString(),
  });
}
