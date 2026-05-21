import { listWorkspaceAuditEntriesByActions } from "@/lib/audit-repository";
import { getAsaasIntegrationStatus } from "@/lib/asaas";
import { getWorkspaceAsaasConnection } from "@/lib/asaas-workspace";
import { getEvolutionIntegrationStatus, probeEvolutionApi } from "@/lib/evolution-api";
import { getFiscalSetupReadiness } from "@/lib/nfse-repository";
import { getWorkspaceSubscription } from "@/lib/workspace-subscription-repository";
import type { AuditEntry } from "@/lib/types";

export type OperationalAlert = {
  id: string;
  tone: "critical" | "warning";
  title: string;
  message: string;
  href?: string;
  hrefLabel?: string;
};

export type OperationalAlertsInput = {
  subscriptionStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "PAUSED";
  asaasWebhookConfigured: boolean;
  asaasConnectionMode: "workspace" | "root_fallback" | "disabled";
  evolutionEnabled: boolean;
  evolutionReachable: boolean;
  evolutionSummary: string;
  fiscalReady: boolean;
  fiscalHelper: string;
  incidents: AuditEntry[];
};

export function buildOperationalAlerts(input: OperationalAlertsInput): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];

  if (input.subscriptionStatus === "PAST_DUE" || input.subscriptionStatus === "CANCELED") {
    alerts.push({
      id: "subscription-restricted",
      tone: "critical",
      title: "Assinatura exige atenção",
      message: `O workspace está com status ${input.subscriptionStatus.toLowerCase()} e pode operar com limitações.`,
      href: "/dashboard/setup?subscriptionIntent=1#subscription-section",
      hrefLabel: "Ajustar plano",
    });
  }

  if (input.asaasConnectionMode !== "disabled" && !input.asaasWebhookConfigured) {
    alerts.push({
      id: "asaas-webhook-pending",
      tone: "warning",
      title: "Baixa automática incompleta",
      message: "A cobrança já existe, mas o webhook do Asaas ainda não está pronto para confirmar pagamentos automaticamente.",
      href: "/dashboard/setup#integrations-section",
      hrefLabel: "Revisar cobrança",
    });
  }

  const latestIncident = input.incidents[0];

  if (latestIncident) {
    alerts.push({
      id: "asaas-incident",
      tone: "warning",
      title: "Falha recente na cobrança externa",
      message: latestIncident.summary,
      href: "/dashboard/setup#integrations-section",
      hrefLabel: "Ver integrações",
    });
  }

  if (input.evolutionEnabled && !input.evolutionReachable) {
    alerts.push({
      id: "evolution-unreachable",
      tone: "warning",
      title: "WhatsApp com conectividade instável",
      message: input.evolutionSummary,
      href: "/dashboard/setup#integrations-section",
      hrefLabel: "Revisar WhatsApp",
    });
  }

  if (!input.fiscalReady) {
    alerts.push({
      id: "fiscal-not-ready",
      tone: "warning",
      title: "Setup fiscal ainda incompleto",
      message: input.fiscalHelper,
      href: "/dashboard/setup",
      hrefLabel: "Completar setup",
    });
  }

  return alerts.slice(0, 4);
}

export async function getOperationalAlerts(): Promise<OperationalAlert[]> {
  const [subscription, asaasIntegration, workspaceAsaas, evolutionIntegration, evolutionProbe, fiscalReadiness, incidents] = await Promise.all([
    getWorkspaceSubscription(),
    Promise.resolve(getAsaasIntegrationStatus()),
    getWorkspaceAsaasConnection(),
    Promise.resolve(getEvolutionIntegrationStatus()),
    probeEvolutionApi(),
    getFiscalSetupReadiness(),
    listWorkspaceAuditEntriesByActions(["charge.asaas.failed", "asaas.payment_overdue"], 3),
  ]);

  return buildOperationalAlerts({
    subscriptionStatus: subscription.status,
    asaasWebhookConfigured: asaasIntegration.webhookConfigured,
    asaasConnectionMode: workspaceAsaas.mode,
    evolutionEnabled: evolutionIntegration.enabled,
    evolutionReachable: evolutionProbe.reachable,
    evolutionSummary: evolutionProbe.summary,
    fiscalReady: fiscalReadiness.ready,
    fiscalHelper: fiscalReadiness.helper,
    incidents,
  });
}
