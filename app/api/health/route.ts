import { NextResponse } from "next/server";
import { getAsaasIntegrationStatus } from "@/lib/asaas";
import { isLocalDataMode } from "@/lib/data-mode";
import { getEvolutionIntegrationStatus } from "@/lib/evolution-api";
import { getNfseNationalIntegrationStatus } from "@/lib/nfse-national-provider";

export function GET() {
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
