import { canManageWorkspace } from "@/lib/auth-session";
import { getAsaasIntegrationStatus } from "@/lib/asaas";
import { isLocalDataMode } from "@/lib/data-mode";
import { getEvolutionIntegrationStatus } from "@/lib/evolution-api";
import {
  getResolvedNfseEmissionModeSummary,
  getResolvedNfseIntegrationStatus,
} from "@/lib/nfse-provider";
import type { NfseNationalMunicipalityStatus } from "@/lib/nfse-national-municipal-status";
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
  companyCity?: string;
  companyState?: string;
  municipalityStatus?: Pick<NfseNationalMunicipalityStatus, "aderenteEmissorNacional"> | null;
  fiscalReady: boolean;
  evolutionReachable: boolean;
  evolutionInstances: Array<{ instanceName: string; status?: string }>;
  workspaceAsaasMode: "workspace" | "root_fallback" | "disabled";
  asaasIncidentEntries: Array<{ action: string }>;
}) {
  const canManage = isLocalDataMode() || canManageWorkspace(input.workspaceRole);
  const emissionModes = getResolvedNfseEmissionModeSummary(input.companyCity, input.companyState, {
    municipalityStatus: input.municipalityStatus,
  });
  const nfseIntegration = getResolvedNfseIntegrationStatus(input.companyCity, input.companyState, {
    municipalityStatus: input.municipalityStatus,
  });
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
  const selectedEvolutionInstanceStatus =
    workspaceEvolutionInstance?.status
    || fallbackEvolutionInstance?.status
    || input.evolutionInstances[0]?.status
    || "";
  const isUsingWorkspaceEvolutionInstance = selectedEvolutionInstanceName === input.setupSlug;
  const subscriptionPlan = getSubscriptionPlanPresentation(input.subscription.plan);
  const trialRemainingDays = getTrialRemainingDays(input.subscription);
  const localMode = isLocalDataMode();
  const hasAsaasIncidents = input.asaasIncidentEntries.some((entry) => entry.action === "charge.asaas.failed" || entry.action === "asaas.payment_overdue");
  const hasSubscriptionIncident = input.subscription.status === "PAST_DUE" || input.subscription.status === "CANCELED";
  const asaasHealthOk = input.workspaceAsaasMode === "workspace" && asaasIntegration.webhookConfigured && !hasAsaasIncidents;
  const evolutionHealthOk =
    evolutionIntegration.enabled
    && input.evolutionReachable
    && Boolean(selectedEvolutionInstanceName)
    && (!selectedEvolutionInstanceStatus || selectedEvolutionInstanceStatus === "open");
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
    selectedEvolutionInstanceStatus,
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
