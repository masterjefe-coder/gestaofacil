import { WorkspaceRole } from "@prisma/client";
import { isLocalDataMode } from "@/lib/data-mode";
import { hashPassword } from "@/lib/password-auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { buildOnboardingSubscriptionData } from "@/lib/workspace-subscription-repository";
import type { SubscriptionBillingCycleCode, SubscriptionPlanCode } from "@/lib/types";

export type OnboardingInput = {
  name: string;
  email: string;
  password: string;
  workspaceName: string;
  workspaceSlug?: string;
  tradeName: string;
  legalName: string;
  document: string;
  city?: string;
  state?: string;
  serviceDescription?: string;
  subscriptionPlan?: SubscriptionPlanCode;
  subscriptionBillingCycle?: SubscriptionBillingCycleCode;
};

export class OnboardingError extends Error {}

async function buildUniqueWorkspaceSlug(baseValue: string) {
  const base = slugify(baseValue) || "gestao-facil";

  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const existing = await prisma.workspace.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new OnboardingError("Nao foi possivel gerar um slug unico para o workspace.");
}

export async function createWorkspaceOnboarding(input: OnboardingInput) {
  if (isLocalDataMode()) {
    throw new OnboardingError("Configure DATABASE_URL para criar usuarios reais e workspaces persistentes.");
  }

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const password = input.password.trim();
  const workspaceName = input.workspaceName.trim();
  const tradeName = input.tradeName.trim();
  const legalName = input.legalName.trim();
  const document = input.document.trim();
  const subscriptionPlan = input.subscriptionPlan || "PROFESSIONAL";
  const subscriptionBillingCycle = input.subscriptionBillingCycle || "MONTHLY";

  if (!email || !name || !password || !workspaceName || !tradeName || !legalName || !document) {
    throw new OnboardingError("Preencha nome, email, senha, workspace e dados principais da empresa.");
  }

  if (password.length < 8) {
    throw new OnboardingError("A senha precisa ter pelo menos 8 caracteres.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new OnboardingError("Ja existe um usuario com esse email.");
  }

  const workspaceSlug = await buildUniqueWorkspaceSlug(input.workspaceSlug?.trim() || workspaceName);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        name: workspaceName,
        slug: workspaceSlug,
      },
    });

    await tx.workspaceMembership.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: WorkspaceRole.OWNER,
      },
    });

    await tx.company.create({
      data: {
        workspaceId: workspace.id,
        legalName,
        tradeName,
        document,
        city: input.city?.trim() || null,
        state: input.state?.trim() || null,
        serviceDescription: input.serviceDescription?.trim() || null,
      },
    });

    await tx.workspaceSubscription.create({
      data: buildOnboardingSubscriptionData({
        workspaceId: workspace.id,
        plan: subscriptionPlan,
        billingCycle: subscriptionBillingCycle,
      }),
    });

    return {
      user,
      workspace,
    };
  });

  return result;
}
