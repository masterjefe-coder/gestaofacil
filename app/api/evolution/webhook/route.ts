import { NextRequest, NextResponse } from "next/server";
import { handleEvolutionWebhook } from "@/lib/evolution-webhook";
import { isWebhookSecretConfigured } from "@/lib/runtime-safety";
import { timingSafeCompare, verifyWebhookTimestamp } from "@/lib/security-crypto";
import { rateLimit } from "@/lib/rate-limit";

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

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "gestao-facil-evolution-webhook",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  // Apply rate limiting for webhooks
  const rateLimitResponse = rateLimit(request, "webhook");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!isWebhookSecretConfigured(process.env.EVOLUTION_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Webhook desabilitado ate configurar EVOLUTION_WEBHOOK_SECRET." }, { status: 503 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  
  // Validate webhook timestamp to prevent replay attacks
  if (body?.date_time && !verifyWebhookTimestamp(body.date_time)) {
    return NextResponse.json({ error: "Webhook timestamp invalido ou expirado." }, { status: 400 });
  }

  const result = body ? await handleEvolutionWebhook(body) : null;

  return NextResponse.json({
    received: true,
    hasBody: Boolean(body),
    stored: result?.stored || false,
    instance: result?.instance || null,
    event: result?.event || null,
    linkedChargeId: result?.linkedChargeId || null,
    timestamp: new Date().toISOString(),
  });
}
