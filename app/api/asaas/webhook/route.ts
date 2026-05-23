import { NextRequest, NextResponse } from "next/server";
import { handleAsaasWebhook } from "@/lib/asaas-webhook";
import { getLogger } from "@/lib/api-logger";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";
import { isWebhookSecretConfigured } from "@/lib/runtime-safety";
import { timingSafeCompare, verifyWebhookTimestamp } from "@/lib/security-crypto";
import { rateLimit } from "@/lib/rate-limit";

const logger = getLogger({ route: "api/asaas/webhook" });

function isAuthorized(request: NextRequest) {
  const configuredToken = process.env.ASAAS_WEBHOOK_AUTH_TOKEN?.trim();
  const receivedToken = request.headers.get("asaas-access-token")?.trim();
  
  // Use timing-safe comparison to prevent timing attacks
  return timingSafeCompare(receivedToken, configuredToken);
}

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);

  return attachRequestId(NextResponse.json({
    status: "ok",
    service: "gestao-facil-asaas-webhook",
    timestamp: new Date().toISOString(),
  }), requestId);
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });

  // Apply rate limiting for webhooks
  const rateLimitResponse = rateLimit(request, "webhook");
  if (rateLimitResponse) {
    requestLogger.warn("Asaas webhook rate limited");
    return attachRequestId(rateLimitResponse, requestId);
  }

  if (!isWebhookSecretConfigured(process.env.ASAAS_WEBHOOK_AUTH_TOKEN)) {
    requestLogger.warn("Asaas webhook rejected because auth token is not configured");
    return attachRequestId(
      NextResponse.json({ error: "Webhook desabilitado ate configurar ASAAS_WEBHOOK_AUTH_TOKEN." }, { status: 503 }),
      requestId,
    );
  }

  if (!isAuthorized(request)) {
    requestLogger.warn("Asaas webhook rejected because token is invalid");
    return attachRequestId(NextResponse.json({ error: "Webhook nao autorizado." }, { status: 401 }), requestId);
  }

  const body = await request.json().catch(() => null);
  
  // Validate webhook timestamp to prevent replay attacks
  if (body?.date_time && !verifyWebhookTimestamp(body.date_time)) {
    requestLogger.warn("Asaas webhook rejected because timestamp is expired", {
      event: typeof body?.event === "string" ? body.event : null,
    });
    return attachRequestId(
      NextResponse.json({ error: "Webhook timestamp invalido ou expirado." }, { status: 400 }),
      requestId,
    );
  }

  const result = body ? await handleAsaasWebhook(body) : null;
  requestLogger.info("Asaas webhook processed", {
    event: result && "event" in result ? result.event : null,
    stored: result?.stored || false,
    duplicate: "duplicate" in (result || {}) ? Boolean((result as { duplicate?: boolean }).duplicate) : false,
    workspaceId: result && "workspaceId" in result ? result.workspaceId : null,
  });

  return attachRequestId(
    NextResponse.json({
      received: true,
      hasBody: Boolean(body),
      stored: result?.stored || false,
      duplicate: "duplicate" in (result || {}) ? Boolean((result as { duplicate?: boolean }).duplicate) : false,
      event: result && "event" in result ? result.event : null,
      linkedChargeId: result && "chargeId" in result ? result.chargeId : null,
      workspaceId: result && "workspaceId" in result ? result.workspaceId : null,
      timestamp: new Date().toISOString(),
    }),
    requestId,
  );
}
