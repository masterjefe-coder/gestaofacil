import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getAsaasIntegrationStatus } from "@/lib/asaas";
import { isLocalDataMode } from "@/lib/data-mode";
import { getEvolutionIntegrationStatus } from "@/lib/evolution-api";
import { getNfseNationalIntegrationStatus } from "@/lib/nfse-national-provider";
import { timingSafeCompare } from "@/lib/security-crypto";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const configuredHealthToken = process.env.HEALTHCHECK_TOKEN?.trim();
  const receivedHealthToken = request.headers.get("x-health-token")?.trim();
  const canSeeDetails = Boolean(session?.user?.email) || timingSafeCompare(receivedHealthToken, configuredHealthToken);

  if (!canSeeDetails) {
    return NextResponse.json({
      status: "ok",
      service: "gestao-facil",
      timestamp: new Date().toISOString(),
    });
  }

  const localMode = isLocalDataMode();
  const evolution = getEvolutionIntegrationStatus();
  const asaas = getAsaasIntegrationStatus();
  const nfse = getNfseNationalIntegrationStatus();

  return NextResponse.json({
    status: "ok",
    service: "gestao-facil",
    timestamp: new Date().toISOString(),
    runtime: {
      mode: localMode ? "local" : "database",
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      appBaseUrlConfigured: Boolean(process.env.APP_BASE_URL),
    },
    integrations: {
      evolution: {
        enabled: evolution.enabled,
        webhookConfigured: Boolean(evolution.webhookUrl),
      },
      asaas: {
        enabled: asaas.enabled,
        webhookConfigured: asaas.webhookConfigured,
      },
      nfse: {
        enabled: nfse.enabled,
        ready: nfse.ready,
        environment: nfse.environment,
      },
    },
  });
}
