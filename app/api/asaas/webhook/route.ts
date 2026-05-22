import { NextRequest, NextResponse } from "next/server";
import { handleAsaasWebhook } from "@/lib/asaas-webhook";
import { isWebhookSecretConfigured } from "@/lib/runtime-safety";
import { timingSafeCompare, verifyWebhookTimestamp } from "@/lib/security-crypto";
import { rateLimit } from "@/lib/rate-limit";

function isAuthorized(request: NextRequest) {
  const configuredToken = process.env.ASAAS_WEBHOOK_AUTH_TOKEN?.trim();
  const receivedToken = request.headers.get("asaas-access-token")?.trim();
  
  // Use timing-safe comparison to prevent timing attacks
  return timingSafeCompare(receivedToken, configuredToken);
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "gestao-facil-asaas-webhook",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  // Apply rate limiting for webhooks
  const rateLimitResponse = rateLimit(request, "webhook");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!isWebhookSecretConfigured(process.env.ASAAS_WEBHOOK_AUTH_TOKEN)) {
    return NextResponse.json({ error: "Webhook desabilitado ate configurar ASAAS_WEBHOOK_AUTH_TOKEN." }, { status: 503 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Webhook nao autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  
  // Validate webhook timestamp to prevent replay attacks
  if (body?.date_time && !verifyWebhookTimestamp(body.date_time)) {
    return NextResponse.json({ error: "Webhook timestamp invalido ou expirado." }, { status: 400 });
  }

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
