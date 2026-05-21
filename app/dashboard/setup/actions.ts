"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { WorkspaceRole } from "@prisma/client";
import { connectEvolutionInstance, createEvolutionInstance, EvolutionApiError } from "@/lib/evolution-api";
import {
  connectWorkspaceAsaasAccount,
  createWorkspaceAsaasSubaccount,
  disconnectWorkspaceAsaasAccount,
  updateWorkspaceSetup,
} from "@/lib/workspace-settings-repository";
import {
  createWorkspaceSubscriptionCheckout,
  isSubscriptionBillingCycleCode,
  isSubscriptionPlanCode,
  updateWorkspaceSubscriptionPlan,
} from "@/lib/workspace-subscription-repository";
import {
  createWorkspaceMember,
  removeWorkspaceMember,
  resetWorkspaceMemberPassword,
  updateWorkspaceMemberRole,
  WorkspaceMemberError,
} from "@/lib/workspace-membership-repository";
import {
  createAndDeliverWorkspaceInvite,
  renewWorkspaceInvite,
  resendWorkspaceInvite,
  revokeWorkspaceInvite,
  WorkspaceInviteError,
} from "@/lib/workspace-invite-repository";
import { updateCurrentUserAlertPreferences } from "@/lib/workspace-user-preferences";
import type { SetupInput } from "@/lib/types";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function redirectToSetup(params: Record<string, string | undefined>, hash?: string): never {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  const target = `/dashboard/setup${queryString ? `?${queryString}` : ""}${hash || ""}`;
  redirect(target);
}

function redirectEvolution(message: string, ok = false, extras?: Record<string, string | undefined>): never {
  return redirectToSetup(
    {
      evolutionMessage: message,
      evolutionOk: ok ? "1" : "0",
      ...(extras || {}),
    },
    "#integrations-section",
  );
}

export async function updateWorkspaceSetupAction(formData: FormData) {
  const input: SetupInput = {
    name: getString(formData, "name"),
    slug: getString(formData, "slug"),
    niche: getString(formData, "niche"),
    legalName: getString(formData, "legalName"),
    tradeName: getString(formData, "tradeName"),
    document: getString(formData, "document"),
    city: getString(formData, "city"),
    state: getString(formData, "state"),
    serviceDescription: getString(formData, "serviceDescription"),
    defaultFiscalServiceCode: getString(formData, "defaultFiscalServiceCode"),
    defaultPixKey: getString(formData, "defaultPixKey"),
    defaultPaymentMessage: getString(formData, "defaultPaymentMessage"),
  };

  if (!input.name || !input.slug || !input.tradeName || !input.document) {
    redirectToSetup({ setupError: "Preencha os campos principais da empresa antes de salvar." });
  }

  try {
    await updateWorkspaceSetup(input);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Nao foi possivel salvar os dados da empresa.";

    redirectToSetup({ setupError: message });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ setupSaved: "1" });
}

export async function createWorkspaceMemberAction(formData: FormData) {
  const name = getString(formData, "memberName");
  const email = getString(formData, "memberEmail");
  const password = getString(formData, "memberPassword");
  const role = (getString(formData, "memberRole") as WorkspaceRole) || WorkspaceRole.MEMBER;

  try {
    await createWorkspaceMember({
      name,
      email,
      password,
      role,
    });
  } catch (error) {
    const message =
      error instanceof WorkspaceMemberError
        ? error.message
        : "Não foi possível adicionar o usuário ao workspace.";

    redirectToSetup({ teamError: message }, "#team-section");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ teamCreated: "1" }, "#team-section");
}

export async function createWorkspaceInviteAction(formData: FormData) {
  const name = getString(formData, "inviteName");
  const email = getString(formData, "inviteEmail");
  const role = (getString(formData, "inviteRole") as WorkspaceRole) || WorkspaceRole.MEMBER;

  try {
    const result = await createAndDeliverWorkspaceInvite({
      name,
      email,
      role,
    });

    if (!result.delivery.sent && !result.delivery.skipped) {
      redirectToSetup({ inviteCreated: "1", teamError: `Convite criado, mas o email não saiu: ${result.delivery.error}` }, "#team-section");
    }
  } catch (error) {
    const message =
      error instanceof WorkspaceInviteError
        ? error.message
        : "Não foi possível criar o convite do workspace.";

    redirectToSetup({ teamError: message }, "#team-section");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ inviteCreated: "1" }, "#team-section");
}

export async function resendWorkspaceInviteAction(formData: FormData) {
  const inviteId = getString(formData, "inviteId");

  try {
    const delivery = await resendWorkspaceInvite(inviteId);

    if (!delivery.sent) {
      const message = delivery.skipped
        ? "Convite pronto, mas o envio automático está sem provider configurado."
        : `Convite reenviado sem sucesso: ${delivery.error}`;
      redirectToSetup({ inviteResent: "1", teamError: message }, "#team-section");
    }
  } catch (error) {
    const message =
      error instanceof WorkspaceInviteError
        ? error.message
        : "Não foi possível reenviar o convite.";

    redirectToSetup({ teamError: message }, "#team-section");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ inviteResent: "1" }, "#team-section");
}

export async function renewWorkspaceInviteAction(formData: FormData) {
  const inviteId = getString(formData, "inviteId");

  try {
    const result = await renewWorkspaceInvite(inviteId);

    if (!result.delivery.sent) {
      const message = result.delivery.skipped
        ? "Convite renovado, mas o envio automático está sem provider configurado."
        : `Convite renovado, mas o email não saiu: ${result.delivery.error}`;
      redirectToSetup({ inviteRenewed: "1", teamError: message }, "#team-section");
    }
  } catch (error) {
    const message =
      error instanceof WorkspaceInviteError
        ? error.message
        : "Não foi possível renovar o convite.";

    redirectToSetup({ teamError: message }, "#team-section");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ inviteRenewed: "1" }, "#team-section");
}

export async function revokeWorkspaceInviteAction(formData: FormData) {
  const inviteId = getString(formData, "inviteId");

  try {
    await revokeWorkspaceInvite(inviteId);
  } catch (error) {
    const message =
      error instanceof WorkspaceInviteError
        ? error.message
        : "Não foi possível revogar o convite.";

    redirectToSetup({ teamError: message }, "#team-section");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ inviteRevoked: "1" }, "#team-section");
}

export async function updateWorkspaceMemberRoleAction(formData: FormData) {
  const membershipId = getString(formData, "membershipId");
  const role = (getString(formData, "memberRole") as WorkspaceRole) || WorkspaceRole.MEMBER;

  try {
    await updateWorkspaceMemberRole({
      membershipId,
      role,
    });
  } catch (error) {
    const message =
      error instanceof WorkspaceMemberError
        ? error.message
        : "Não foi possível atualizar o papel do usuário.";

    redirectToSetup({ teamError: message }, "#team-section");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ teamUpdated: "1" }, "#team-section");
}

export async function removeWorkspaceMemberAction(formData: FormData) {
  const membershipId = getString(formData, "membershipId");

  try {
    await removeWorkspaceMember(membershipId);
  } catch (error) {
    const message =
      error instanceof WorkspaceMemberError
        ? error.message
        : "Não foi possível remover o usuário do workspace.";

    redirectToSetup({ teamError: message }, "#team-section");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ teamRemoved: "1" }, "#team-section");
}

export async function resetWorkspaceMemberPasswordAction(formData: FormData) {
  const membershipId = getString(formData, "membershipId");
  const password = getString(formData, "memberPasswordReset");

  try {
    await resetWorkspaceMemberPassword({
      membershipId,
      password,
    });
  } catch (error) {
    const message =
      error instanceof WorkspaceMemberError
        ? error.message
        : "Não foi possível redefinir a senha do usuário.";

    redirectToSetup({ teamError: message }, "#team-section");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ teamPasswordReset: "1" }, "#team-section");
}

export async function createEvolutionInstanceAction(formData: FormData) {
  const instanceName = getString(formData, "instanceName");
  const number = getString(formData, "instanceNumber");

  if (!instanceName) {
    redirectEvolution("Defina um nome de instância para criar a conexão WhatsApp.");
  }

  try {
    await createEvolutionInstance({
      instanceName,
      number: number || undefined,
    });
  } catch (error) {
    const message =
      error instanceof EvolutionApiError
        ? error.message
        : "Não foi possível criar a instância na Evolution API.";

    redirectEvolution(message);
  }

  revalidatePath("/dashboard/setup");
  redirectEvolution(`Instância ${instanceName} criada com sucesso na Evolution API.`, true);
}

export async function connectEvolutionInstanceAction(formData: FormData) {
  const instanceName = getString(formData, "instanceName");
  let pairingCode: string | undefined;

  try {
    if (!instanceName) {
      redirectEvolution("Escolha uma instância para solicitar o pareamento.");
    }

    const result = await connectEvolutionInstance(instanceName);
    pairingCode = result.pairingCode;

    revalidatePath("/dashboard/setup");
  } catch (error) {
    const message =
      error instanceof EvolutionApiError
        ? error.message
        : "Não foi possível gerar o pareamento da instância.";

    redirectEvolution(message);
  }

  redirectEvolution(`Pareamento solicitado para ${instanceName}.`, true, {
    evolutionPairingCode: pairingCode,
  });
}

export async function connectWorkspaceAsaasAccountAction(formData: FormData) {
  const apiKey = getString(formData, "asaasApiKey");
  const accountId = getString(formData, "asaasAccountId");
  const splitEnabled = getString(formData, "asaasSplitEnabled") === "on";

  if (!apiKey) {
    redirectToSetup(
      { asaasError: "Informe a API key da conta ou subconta Asaas do workspace." },
      "#integrations-section",
    );
  }

  try {
    await connectWorkspaceAsaasAccount({
      apiKey,
      accountId: accountId || undefined,
      splitEnabled,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Nao foi possivel conectar a conta Asaas do workspace.";

    redirectToSetup({ asaasError: message }, "#integrations-section");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ asaasConnected: "1" }, "#integrations-section");
}

export async function disconnectWorkspaceAsaasAccountAction() {
  try {
    await disconnectWorkspaceAsaasAccount();
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Nao foi possivel desconectar a conta Asaas do workspace.";

    redirectToSetup({ asaasError: message }, "#integrations-section");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ asaasDisconnected: "1" }, "#integrations-section");
}

export async function createWorkspaceAsaasSubaccountAction(formData: FormData) {
  const name = getString(formData, "subaccountName");
  const email = getString(formData, "subaccountEmail");
  const cpfCnpj = getString(formData, "subaccountCpfCnpj");
  const mobilePhone = getString(formData, "subaccountMobilePhone");
  const incomeValue = Number(getString(formData, "subaccountIncomeValue").replace(",", "."));
  const address = getString(formData, "subaccountAddress");
  const addressNumber = getString(formData, "subaccountAddressNumber");
  const complement = getString(formData, "subaccountComplement");
  const province = getString(formData, "subaccountProvince");
  const postalCode = getString(formData, "subaccountPostalCode");
  const companyType = getString(formData, "subaccountCompanyType");
  const birthDate = getString(formData, "subaccountBirthDate");

  if (!name || !email || !cpfCnpj || !mobilePhone || !incomeValue || !address || !addressNumber || !province || !postalCode) {
    redirectToSetup(
      { asaasError: "Preencha os dados essenciais para criar a conta de recebimento no Asaas." },
      "#integrations-section",
    );
  }

  try {
    await createWorkspaceAsaasSubaccount({
      name,
      email,
      cpfCnpj,
      mobilePhone,
      companyType: companyType || undefined,
      birthDate: birthDate || undefined,
      incomeValue,
      address,
      addressNumber,
      complement: complement || undefined,
      province,
      postalCode,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Nao foi possivel criar a conta de recebimento no Asaas.";

    redirectToSetup({ asaasError: message }, "#integrations-section");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ asaasConnected: "1", asaasCreated: "1" }, "#integrations-section");
}

export async function updateWorkspaceSubscriptionPlanAction(formData: FormData) {
  const plan = getString(formData, "subscriptionPlan");
  const billingCycle = getString(formData, "subscriptionBillingCycle");

  if (!isSubscriptionPlanCode(plan) || !isSubscriptionBillingCycleCode(billingCycle)) {
    redirectToSetup(
      { subscriptionError: "Escolha um plano e um ciclo válidos para o workspace." },
      "#subscription-section",
    );
  }

  try {
    const selectedPlan = plan;
    const selectedBillingCycle = billingCycle;

    await updateWorkspaceSubscriptionPlan({
      plan: selectedPlan,
      billingCycle: selectedBillingCycle,
      note: "Plano preferido ajustado pelo setup do workspace.",
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Nao foi possivel atualizar o plano do workspace.";

    redirectToSetup({ subscriptionError: message }, "#subscription-section");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ subscriptionUpdated: "1" }, "#subscription-section");
}

export async function createWorkspaceSubscriptionCheckoutAction() {
  try {
    await createWorkspaceSubscriptionCheckout();
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Nao foi possivel criar a assinatura do workspace no Asaas.";

    redirectToSetup({ subscriptionError: message }, "#subscription-section");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ subscriptionCheckoutCreated: "1" }, "#subscription-section");
}

export async function updateUserAlertPreferencesAction(formData: FormData) {
  try {
    await updateCurrentUserAlertPreferences({
      showOperationalAlerts: getString(formData, "showOperationalAlerts") === "on",
      showNotificationCenter: getString(formData, "showNotificationCenter") === "on",
      emailOnInviteAccepted: getString(formData, "emailOnInviteAccepted") === "on",
      emailOnSecurityAlerts: getString(formData, "emailOnSecurityAlerts") === "on",
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Nao foi possivel salvar as preferencias pessoais de alerta.";

    redirectToSetup({ alertPrefsError: message }, "#access-section");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirectToSetup({ alertPrefsSaved: "1" }, "#access-section");
}
