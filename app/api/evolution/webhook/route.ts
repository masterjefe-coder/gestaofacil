import { NextRequest, NextResponse } from "next/server";
import { handleEvolutionWebhook } from "@/lib/evolution-webhook";
import { getLogger } from "@/lib/api-logger";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";
import { isWebhookSecretConfigured } from "@/lib/runtime-safety";
import { timingSafeCompare, verifyWebhookTimestamp } from "@/lib/security-crypto";
import { rateLimitRequest } from "@/lib/rate-limit";

const logger = getLogger({ route: "api/evolution/webhook" });

function isAuthorized(request: NextRequest) {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();
  const authorization = request.headers.get("authorization")?.trim();
  
  if (!secret || !authorization) {
    return false;
  }
  
  const expectedAuth = `Bearer ${secret}`;
  // Use timing-safe comparison to prevent timing attacks
  return timingSafeCompare(authorization, expectedAuth);
}

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);

  return attachRequestId(NextResponse.json({
    status: "ok",
    service: "gestao-facil-evolution-webhook",
    timestamp: new Date().toISOString(),
  }), requestId);
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });

  // Apply rate limiting for webhooks
  const rateLimitResponse = await rateLimitRequest(request, "webhook");
  if (rateLimitResponse) {
    requestLogger.warn("Evolution webhook rate limited");
    return attachRequestId(rateLimitResponse, requestId);
  }

  if (!isWebhookSecretConfigured(process.env.EVOLUTION_WEBHOOK_SECRET)) {
    requestLogger.warn("Evolution webhook rejected because secret is not configured");
    return attachRequestId(
      NextResponse.json({ error: "Webhook desabilitado ate configurar EVOLUTION_WEBHOOK_SECRET." }, { status: 503 }),
      requestId,
    );
  }

  if (!isAuthorized(request)) {
    requestLogger.warn("Evolution webhook rejected because bearer secret is invalid");
    return attachRequestId(NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 }), requestId);
  }

  const body = await request.json().catch(() => null);
  
  // Validate webhook timestamp to prevent replay attacks
  if (body?.date_time && !verifyWebhookTimestamp(body.date_time)) {
    requestLogger.warn("Evolution webhook rejected because timestamp is expired", {
      event: typeof body?.event === "string" ? body.event : null,
      instance: typeof body?.instance === "string" ? body.instance : null,
    });
    return attachRequestId(
      NextResponse.json({ error: "Webhook timestamp invalido ou expirado." }, { status: 400 }),
      requestId,
    );
  }

  const result = body ? await handleEvolutionWebhook(body) : null;
  requestLogger.info("Evolution webhook processed", {
    event: result?.event || null,
    stored: result?.stored || false,
    instance: result?.instance || null,
    linkedChargeId: result?.linkedChargeId || null,
  });

  return attachRequestId(
    NextResponse.json({
      received: true,
      hasBody: Boolean(body),
      stored: result?.stored || false,
      instance: result?.instance || null,
      event: result?.event || null,
      linkedChargeId: result?.linkedChargeId || null,
      timestamp: new Date().toISOString(),
    }),
    requestId,
  );
}
