import type { SubscriptionBillingCycle, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/auth-session";
import { recordAuditEvent } from "@/lib/audit-repository";
import { createAsaasWorkspaceSubscription } from "@/lib/asaas";
import { isLocalDataMode } from "@/lib/data-mode";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { readDemoWorkspaceData, writeDemoWorkspaceData } from "@/lib/demo-store";
import { prisma } from "@/lib/prisma";
import { addTrialDays, getSubscriptionPlanPresentation } from "@/lib/subscription";
import type {
  SubscriptionBillingCycleCode,
  SubscriptionPlanCode,
  SubscriptionStatusCode,
  WorkspaceSubscriptionProfile,
} from "@/lib/types";

function mapPrismaSubscription(subscription: {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: SubscriptionBillingCycle;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  asaasCustomerId: string | null;
  asaasSubscriptionId: string | null;
  asaasPaymentLink: string | null;
  externalReference: string | null;
  notes: string | null;
}): WorkspaceSubscriptionProfile {
  return {
    plan: subscription.plan,
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    trialStartedAt: subscription.trialStartedAt?.toISOString(),
    trialEndsAt: subscription.trialEndsAt?.toISOString(),
    currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
    canceledAt: subscription.canceledAt?.toISOString(),
    asaasCustomerId: subscription.asaasCustomerId || undefined,
    asaasSubscriptionId: subscription.asaasSubscriptionId || undefined,
    asaasPaymentLink: subscription.asaasPaymentLink || undefined,
    externalReference: subscription.externalReference || undefined,
    notes: subscription.notes || undefined,
  };
}

export function buildDefaultTrialSubscription(
  plan: SubscriptionPlanCode = "PROFESSIONAL",
  billingCycle: SubscriptionBillingCycleCode = "MONTHLY",
): WorkspaceSubscriptionProfile {
  const start = new Date();
  return {
    plan,
    status: "TRIALING",
    billingCycle,
    trialStartedAt: start.toISOString(),
    trialEndsAt: addTrialDays(start, 14).toISOString(),
    notes: "Trial inicial de 14 dias criado automaticamente no onboarding.",
  };
}

function getPlanChargeValue(plan: SubscriptionPlanCode, billingCycle: SubscriptionBillingCycleCode) {
  if (billingCycle === "YEARLY") {
    switch (plan) {
      case "ESSENTIAL":
        return 1290;
      case "PROFESSIONAL":
        return 2190;
      case "OPERATION":
        return 3490;
      case "ENTERPRISE":
        return 0;
      default:
        return 2190;
    }
  }

  switch (plan) {
    case "ESSENTIAL":
      return 129;
    case "PROFESSIONAL":
      return 219;
    case "OPERATION":
      return 349;
    case "ENTERPRISE":
      return 0;
    default:
      return 219;
  }
}

export async function getWorkspaceSubscription() {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const { workspaceId } = await getCurrentWorkspaceContext();
    const subscription = await prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription) {
      return buildDefaultTrialSubscription();
    }

    return mapPrismaSubscription(subscription);
  }

  const data = await readDemoWorkspaceData();
  return data.subscription || buildDefaultTrialSubscription();
}

export async function updateWorkspaceSubscriptionPlan(input: {
  plan: SubscriptionPlanCode;
  billingCycle: SubscriptionBillingCycleCode;
  note?: string;
}) {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const context = await getCurrentWorkspaceContext();

    if (!canManageWorkspace(context.workspaceRole)) {
      throw new Error("Apenas owner ou admin podem atualizar o plano do workspace.");
    }

    const current = await prisma.workspaceSubscription.findUnique({
      where: { workspaceId: context.workspaceId },
    });

    const next = current
      ? await prisma.workspaceSubscription.update({
          where: { workspaceId: context.workspaceId },
          data: {
            plan: input.plan,
            billingCycle: input.billingCycle,
            notes: input.note || current.notes,
          },
        })
      : await prisma.workspaceSubscription.create({
          data: {
            workspaceId: context.workspaceId,
            plan: input.plan,
            billingCycle: input.billingCycle,
            status: "TRIALING",
            trialStartedAt: new Date(),
            trialEndsAt: addTrialDays(new Date(), 14),
            notes: input.note || "Trial criado ao escolher o plano no setup.",
          },
        });

    await recordAuditEvent({
      action: "workspace.subscription.updated",
      entityType: "workspace",
      entityId: context.workspaceId,
      context,
      payload: {
        summary: `Plano do workspace ajustado para ${input.plan} em ciclo ${input.billingCycle}.`,
        metadata: {
          plan: input.plan,
          billingCycle: input.billingCycle,
        },
      },
    });

    return mapPrismaSubscription(next);
  }

  const data = await readDemoWorkspaceData();
  data.subscription = {
    ...(data.subscription || buildDefaultTrialSubscription()),
    plan: input.plan,
    billingCycle: input.billingCycle,
    notes: input.note || data.subscription?.notes,
  };
  await writeDemoWorkspaceData(data);
  return data.subscription;
}

export async function createWorkspaceSubscriptionCheckout() {
  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    data.subscription = {
      ...(data.subscription || buildDefaultTrialSubscription()),
      asaasCustomerId: "cus_demo_workspace",
      asaasSubscriptionId: "sub_demo_workspace",
      asaasPaymentLink: "https://www.asaas.com/i/demo-subscription",
      externalReference: `gf_subscription:local:${data.workspace.slug}`,
      notes: "Assinatura demo preparada localmente para ilustrar a recorrencia.",
    };
    await writeDemoWorkspaceData(data);
    return data.subscription;
  }

  await ensureDemoCommerceSeeded();
  const context = await getCurrentWorkspaceContext();

  if (!canManageWorkspace(context.workspaceRole)) {
    throw new Error("Apenas owner ou admin podem criar a assinatura do workspace.");
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: context.workspaceId },
    include: {
      company: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        include: {
          user: true,
        },
      },
      subscription: true,
    },
  });

  const current = workspace.subscription
    ? mapPrismaSubscription(workspace.subscription)
    : buildDefaultTrialSubscription();

  if (workspace.subscription?.asaasSubscriptionId) {
    return current;
  }

  const ownerMembership = workspace.memberships.find((item) => item.role === "OWNER") || workspace.memberships[0];
  const customerName = workspace.company?.tradeName || workspace.company?.legalName || workspace.name;
  const customerEmail = ownerMembership?.user.email;
  const customerDocument = workspace.company?.document || undefined;
  const priceValue = getPlanChargeValue(current.plan, current.billingCycle);

  if (!customerEmail || !customerDocument || !priceValue) {
    throw new Error("A assinatura precisa de email do responsavel, documento da empresa e plano cobravel definidos no workspace.");
  }

  const nextDueDate = current.trialEndsAt
    ? current.trialEndsAt.slice(0, 10)
    : addTrialDays(new Date(), 14).toISOString().slice(0, 10);
  const planPresentation = getSubscriptionPlanPresentation(current.plan);
  const created = await createAsaasWorkspaceSubscription({
    customerReference: `gf_workspace_customer:${context.workspaceId}`,
    customerName,
    customerEmail,
    customerDocument,
    customerPhone: undefined,
    value: priceValue,
    nextDueDate,
    cycle: current.billingCycle === "YEARLY" ? "YEARLY" : "MONTHLY",
    description: `Assinatura ${planPresentation.name} - ${workspace.name}`,
    externalReference: `gf_subscription:${context.workspaceId}`,
  });

  const updated = await prisma.workspaceSubscription.upsert({
    where: { workspaceId: context.workspaceId },
    update: {
      plan: current.plan,
      status: current.status,
      billingCycle: current.billingCycle,
      trialStartedAt: current.trialStartedAt ? new Date(current.trialStartedAt) : new Date(),
      trialEndsAt: current.trialEndsAt ? new Date(current.trialEndsAt) : addTrialDays(new Date(), 14),
      asaasCustomerId: created.customerId,
      asaasSubscriptionId: created.subscriptionId,
      asaasPaymentLink: created.paymentLink || null,
      externalReference: `gf_subscription:${context.workspaceId}`,
      notes: "Assinatura SaaS criada no Asaas a partir do setup do workspace.",
    },
    create: {
      ...buildOnboardingSubscriptionData({
        workspaceId: context.workspaceId,
        plan: current.plan,
        billingCycle: current.billingCycle,
      }),
      asaasCustomerId: created.customerId,
      asaasSubscriptionId: created.subscriptionId,
      asaasPaymentLink: created.paymentLink || null,
      notes: "Assinatura SaaS criada no Asaas a partir do setup do workspace.",
    },
  });

  await recordAuditEvent({
    action: "workspace.subscription.checkout_created",
    entityType: "workspace",
    entityId: context.workspaceId,
    context,
    payload: {
      summary: `Assinatura ${current.plan} criada no Asaas para o workspace.`,
      metadata: {
        asaasCustomerId: created.customerId,
        asaasSubscriptionId: created.subscriptionId,
        nextDueDate,
        billingCycle: current.billingCycle,
      },
    },
  });

  return mapPrismaSubscription(updated);
}

export function buildOnboardingSubscriptionData(params: {
  workspaceId: string;
  plan: SubscriptionPlanCode;
  billingCycle: SubscriptionBillingCycleCode;
}) {
  const startedAt = new Date();
  const endsAt = addTrialDays(startedAt, 14);

  return {
    workspaceId: params.workspaceId,
    plan: params.plan,
    status: "TRIALING" as const,
    billingCycle: params.billingCycle,
    trialStartedAt: startedAt,
    trialEndsAt: endsAt,
    notes: "Trial inicial de 14 dias criado automaticamente no onboarding.",
    externalReference: `gf_subscription:${params.workspaceId}`,
  };
}

export function isSubscriptionPlanCode(value: string): value is SubscriptionPlanCode {
  return value === "ESSENTIAL" || value === "PROFESSIONAL" || value === "OPERATION" || value === "ENTERPRISE";
}

export function isSubscriptionBillingCycleCode(value: string): value is SubscriptionBillingCycleCode {
  return value === "MONTHLY" || value === "YEARLY";
}

export function isSubscriptionStatusCode(value: string): value is SubscriptionStatusCode {
  return value === "TRIALING" || value === "ACTIVE" || value === "PAST_DUE" || value === "CANCELED" || value === "PAUSED";
}
