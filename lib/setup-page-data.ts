import { canManageWorkspace } from "@/lib/auth-session";
import { getAsaasIntegrationStatus } from "@/lib/asaas";
import { isLocalDataMode } from "@/lib/data-mode";
import { getEvolutionIntegrationStatus } from "@/lib/evolution-api";
import { getNfseEmissionModeSummary, getNfseNationalIntegrationStatus } from "@/lib/nfse-national-provider";
import { getBillingCycleLabel, getSubscriptionPlanPresentation, getTrialRemainingDays } from "@/lib/subscription";
import { isTransactionalEmailConfigured } from "@/lib/transactional-email";

export function buildSetupPageViewModel(input: {
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER";
  setupSlug: string;
  subscription: {
    plan: "ESSENTIAL" | "PROFESSIONAL" | "OPERATION" | "ENTERPRISE";
    billingCycle: "MONTHLY" | "YEARLY";
    status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "PAUSED";
  };
  fiscalReady: boolean;
  evolutionReachable: boolean;
  evolutionInstances: Array<{ instanceName: string }>;
  workspaceAsaasMode: "workspace" | "root_fallback" | "disabled";
  asaasIncidentEntries: Array<{ action: string }>;
}) {
  const canManage = isLocalDataMode() || canManageWorkspace(input.workspaceRole);
  const emissionModes = getNfseEmissionModeSummary();
  const nfseIntegration = getNfseNationalIntegrationStatus();
  const evolutionIntegration = getEvolutionIntegrationStatus();
  const asaasIntegration = getAsaasIntegrationStatus();
  const transactionalEmailReady = isTransactionalEmailConfigured();
  const workspaceEvolutionInstance = input.evolutionInstances.find((instance) => instance.instanceName === input.setupSlug);
  const fallbackEvolutionInstance = input.evolutionInstances.find((instance) => instance.instanceName === evolutionIntegration.instance);
  const selectedEvolutionInstanceName =
    workspaceEvolutionInstance?.instanceName
    || fallbackEvolutionInstance?.instanceName
    || evolutionIntegration.instance
    || input.evolutionInstances[0]?.instanceName
    || "";
  const isUsingWorkspaceEvolutionInstance = selectedEvolutionInstanceName === input.setupSlug;
  const subscriptionPlan = getSubscriptionPlanPresentation(input.subscription.plan);
  const trialRemainingDays = getTrialRemainingDays(input.subscription);
  const localMode = isLocalDataMode();
  const hasAsaasIncidents = input.asaasIncidentEntries.some((entry) => entry.action === "charge.asaas.failed" || entry.action === "asaas.payment_overdue");
  const hasSubscriptionIncident = input.subscription.status === "PAST_DUE" || input.subscription.status === "CANCELED";
  const asaasHealthOk = input.workspaceAsaasMode === "workspace" && asaasIntegration.webhookConfigured && !hasAsaasIncidents;
  const evolutionHealthOk = evolutionIntegration.enabled && input.evolutionReachable && Boolean(selectedEvolutionInstanceName);
  const fiscalHealthOk = nfseIntegration.ready && input.fiscalReady;

  return {
    canManage,
    emissionModes,
    nfseIntegration,
    evolutionIntegration,
    asaasIntegration,
    transactionalEmailReady,
    workspaceEvolutionInstance,
    selectedEvolutionInstanceName,
    isUsingWorkspaceEvolutionInstance,
    subscriptionPlan,
    trialRemainingDays,
    localMode,
    hasSubscriptionIncident,
    asaasHealthOk,
    evolutionHealthOk,
    fiscalHealthOk,
    billingCycleLabel: getBillingCycleLabel(input.subscription.billingCycle),
  };
}
