import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getAsaasIntegrationStatus } from "@/lib/asaas";
import { getLogger } from "@/lib/api-logger";
import { isLocalDataMode } from "@/lib/data-mode";
import { getEvolutionIntegrationStatus } from "@/lib/evolution-api";
import { getNfseNationalIntegrationStatus } from "@/lib/nfse-national-provider";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";
import { timingSafeCompare } from "@/lib/security-crypto";

const logger = getLogger({ route: "api/health" });

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const session = await getServerSession(authOptions);
  const configuredHealthToken = process.env.HEALTHCHECK_TOKEN?.trim();
  const receivedHealthToken = request.headers.get("x-health-token")?.trim();
  const canSeeDetails = Boolean(session?.user?.email) || timingSafeCompare(receivedHealthToken, configuredHealthToken);

  if (!canSeeDetails) {
    requestLogger.info("Health check served in public mode");
    return attachRequestId(
      NextResponse.json({
        status: "ok",
        service: "gestao-facil",
        timestamp: new Date().toISOString(),
      }),
      requestId,
    );
  }

  const localMode = isLocalDataMode();
  const evolution = getEvolutionIntegrationStatus();
  const asaas = getAsaasIntegrationStatus();
  const nfse = getNfseNationalIntegrationStatus();

  requestLogger.info("Health check served with integration details", {
    mode: localMode ? "local" : "database",
    evolutionEnabled: evolution.enabled,
    asaasEnabled: asaas.enabled,
    nfseReady: nfse.ready,
  });

  return attachRequestId(
    NextResponse.json({
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
    }),
    requestId,
  );
}
