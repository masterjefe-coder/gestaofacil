import { listWorkspaceAuditEntriesByActions, listWorkspaceAuditEntriesByType } from "@/lib/audit-repository";
import { getAsaasIntegrationStatus } from "@/lib/asaas";
import { getWorkspaceAsaasConnection } from "@/lib/asaas-workspace";
import { getEvolutionIntegrationStatus, probeEvolutionApi } from "@/lib/evolution-api";
import { getFiscalSetupReadiness } from "@/lib/nfse-repository";
import { summarizeOperationalSignals } from "@/lib/operational-diagnostics-panel-helpers";
import { getWorkspaceSubscription } from "@/lib/workspace-subscription-repository";
import type { AuditEntry } from "@/lib/types";

function withOperationalFocus(href: string, focus: string, hash: string) {
  return `${href}${href.includes("?") ? "&" : "?"}operationalFocus=${focus}${hash}`;
}

export type OperationalAlert = {
  id: string;
  tone: "critical" | "warning";
  title: string;
  message: string;
  href?: string;
  hrefLabel?: string;
  recoveryMessage?: string;
  recoveryAt?: string;
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
  asaasLifecycleEntries?: AuditEntry[];
  evolutionEntries?: AuditEntry[];
  fiscalEntries?: AuditEntry[];
  subscriptionEntries?: AuditEntry[];
};

function getRecoverySignal(entries: AuditEntry[]) {
  const signal = summarizeOperationalSignals(entries);

  return signal.primaryTone === "warning" ? signal.recovery : undefined;
}

export function buildOperationalAlerts(input: OperationalAlertsInput): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const asaasRecovery = getRecoverySignal([
    ...input.incidents,
    ...(input.asaasLifecycleEntries || []),
  ]);
  const evolutionRecovery = getRecoverySignal(input.evolutionEntries || []);
  const fiscalRecovery = getRecoverySignal(input.fiscalEntries || []);
  const subscriptionRecovery = getRecoverySignal(input.subscriptionEntries || []);

  if (input.subscriptionStatus === "PAST_DUE" || input.subscriptionStatus === "CANCELED") {
    alerts.push({
      id: "subscription-restricted",
      tone: "critical",
      title: "Assinatura exige atenção",
      message: `O workspace está com status ${input.subscriptionStatus.toLowerCase()} e pode operar com limitações.`,
      href: withOperationalFocus(
        "/dashboard/setup?subscriptionIntent=1",
        "subscription",
        "#subscription-section",
      ),
      hrefLabel: "Ajustar plano",
      recoveryMessage: subscriptionRecovery?.summary,
      recoveryAt: subscriptionRecovery?.createdAt,
    });
  }

  if (input.asaasConnectionMode !== "disabled" && !input.asaasWebhookConfigured) {
    alerts.push({
      id: "asaas-webhook-pending",
      tone: "warning",
      title: "Baixa automática incompleta",
      message: "A cobrança já existe, mas o webhook do Asaas ainda não está pronto para confirmar pagamentos automaticamente.",
      href: withOperationalFocus(
        "/dashboard/billing",
        "recebimentos",
        "#recebimentos",
      ),
      hrefLabel: "Revisar recebimentos",
      recoveryMessage: asaasRecovery?.summary,
      recoveryAt: asaasRecovery?.createdAt,
    });
  }

  const latestIncident = input.incidents[0];

  if (latestIncident) {
    alerts.push({
      id: "asaas-incident",
      tone: "warning",
      title: "Falha recente na cobrança externa",
      message: latestIncident.summary,
      href: withOperationalFocus(
        "/dashboard/billing?focus=triage&view=triage",
        "recebimentos",
        "#recebimentos",
      ),
      hrefLabel: "Abrir triagem",
      recoveryMessage: asaasRecovery?.summary,
      recoveryAt: asaasRecovery?.createdAt,
    });
  }

  if (input.evolutionEnabled && !input.evolutionReachable) {
    alerts.push({
      id: "evolution-unreachable",
      tone: "warning",
      title: "WhatsApp com conectividade instável",
      message: input.evolutionSummary,
      href: withOperationalFocus(
        "/dashboard/setup",
        "integrations",
        "#integrations-section",
      ),
      hrefLabel: "Revisar WhatsApp",
      recoveryMessage: evolutionRecovery?.summary,
      recoveryAt: evolutionRecovery?.createdAt,
    });
  }

  if (!input.fiscalReady) {
    alerts.push({
      id: "fiscal-not-ready",
      tone: "warning",
      title: "Setup fiscal ainda incompleto",
      message: input.fiscalHelper,
      href: withOperationalFocus(
        "/dashboard/fiscal?focus=blocked",
        "documentos",
        "#documentos-fiscais",
      ),
      hrefLabel: "Abrir fiscal",
      recoveryMessage: fiscalRecovery?.summary,
      recoveryAt: fiscalRecovery?.createdAt,
    });
  }

  return alerts.slice(0, 4);
}

export function getPrimaryOperationalAlert(alerts: OperationalAlert[]) {
  return alerts[0];
}

export async function getOperationalAlerts(): Promise<OperationalAlert[]> {
  const [
    subscription,
    asaasIntegration,
    workspaceAsaas,
    evolutionIntegration,
    evolutionProbe,
    fiscalReadiness,
    incidents,
    asaasLifecycleEntries,
    evolutionEntries,
    fiscalEntries,
    subscriptionEntries,
  ] = await Promise.all([
    getWorkspaceSubscription(),
    Promise.resolve(getAsaasIntegrationStatus()),
    getWorkspaceAsaasConnection(),
    Promise.resolve(getEvolutionIntegrationStatus()),
    probeEvolutionApi(),
    getFiscalSetupReadiness(),
    listWorkspaceAuditEntriesByActions(["charge.asaas.failed", "asaas.payment_overdue"], 3),
    listWorkspaceAuditEntriesByActions(["workspace.asaas.connected", "workspace.asaas.disconnected", "workspace.asaas.subaccount_created"], 3),
    listWorkspaceAuditEntriesByType("evolution", 4),
    listWorkspaceAuditEntriesByType("nfse", 4),
    listWorkspaceAuditEntriesByActions(["workspace.subscription.checkout_created", "workspace.subscription.checkout_synced", "subscription.asaas.payment_overdue", "subscription.asaas.payment_received", "subscription.asaas.payment_confirmed"], 4),
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
    asaasLifecycleEntries,
    evolutionEntries,
    fiscalEntries,
    subscriptionEntries,
  });
}
