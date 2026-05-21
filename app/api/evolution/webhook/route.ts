import { NextRequest, NextResponse } from "next/server";
import { handleEvolutionWebhook } from "@/lib/evolution-webhook";
import { isWebhookSecretConfigured } from "@/lib/runtime-safety";

function isAuthorized(request: NextRequest) {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();

  const authorization = request.headers.get("authorization")?.trim();
  return Boolean(secret) && authorization === `Bearer ${secret}`;
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "gestao-facil-evolution-webhook",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  if (!isWebhookSecretConfigured(process.env.EVOLUTION_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Webhook desabilitado ate configurar EVOLUTION_WEBHOOK_SECRET." }, { status: 503 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
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
