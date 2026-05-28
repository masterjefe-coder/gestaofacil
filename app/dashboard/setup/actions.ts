"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { WorkspaceRole } from "@prisma/client";
import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/auth-session";
import { connectEvolutionInstance, createEvolutionInstance, EvolutionApiError } from "@/lib/evolution-api";
import {
  bindWorkspaceEvolutionInstanceName,
  ensureWorkspaceEvolutionInstanceAvailable,
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
import {
  FormInputError,
  readFormCheckbox,
  readOptionalFormMaybeString,
  readOptionalFormString,
  readOptionalFormEnum,
  readRequiredFormString,
  readRequiredPositiveNumber,
} from "@/lib/form-inputs";
import type { SetupInput } from "@/lib/types";

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
  try {
    const input: SetupInput = {
      name: readRequiredFormString(formData, "name", "Preencha os campos principais da empresa antes de salvar."),
      slug: readRequiredFormString(formData, "slug", "Preencha os campos principais da empresa antes de salvar."),
      niche: readOptionalFormString(formData, "niche"),
      legalName: readOptionalFormString(formData, "legalName"),
      tradeName: readRequiredFormString(formData, "tradeName", "Preencha os campos principais da empresa antes de salvar."),
      document: readRequiredFormString(formData, "document", "Preencha os campos principais da empresa antes de salvar."),
      city: readOptionalFormString(formData, "city"),
      state: readOptionalFormString(formData, "state"),
      serviceDescription: readOptionalFormString(formData, "serviceDescription"),
      defaultFiscalServiceCode: readOptionalFormString(formData, "defaultFiscalServiceCode"),
      defaultPixKey: readOptionalFormString(formData, "defaultPixKey"),
      defaultPaymentMessage: readOptionalFormString(formData, "defaultPaymentMessage"),
    };

    await updateWorkspaceSetup(input);
  } catch (error) {
    if (error instanceof FormInputError) {
      redirectToSetup({ setupError: error.message });
    }

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
  try {
    const name = readRequiredFormString(formData, "memberName", "Informe nome, email e senha inicial do usuario.");
    const email = readRequiredFormString(formData, "memberEmail", "Informe nome, email e senha inicial do usuario.");
    const password = readRequiredFormString(formData, "memberPassword", "Informe nome, email e senha inicial do usuario.");
    const role = readOptionalFormEnum(
      formData,
      "memberRole",
      Object.values(WorkspaceRole),
      WorkspaceRole.MEMBER,
      "Escolha um papel valido para o usuario.",
    );

    await createWorkspaceMember({
      name,
      email,
      password,
      role,
    });
  } catch (error) {
    if (error instanceof FormInputError) {
      redirectToSetup({ teamError: error.message }, "#team-section");
    }

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
  try {
    const name = readOptionalFormString(formData, "inviteName");
    const email = readRequiredFormString(formData, "inviteEmail", "Informe pelo menos o email da pessoa convidada.");
    const role = readOptionalFormEnum(
      formData,
      "inviteRole",
      Object.values(WorkspaceRole),
      WorkspaceRole.MEMBER,
      "Escolha um papel valido para o convite.",
    );

    const result = await createAndDeliverWorkspaceInvite({
      name,
      email,
      role,
    });

    if (!result.delivery.sent && !result.delivery.skipped) {
      redirectToSetup({ inviteCreated: "1", teamError: `Convite criado, mas o email não saiu: ${result.delivery.error}` }, "#team-section");
    }
  } catch (error) {
    if (error instanceof FormInputError) {
      redirectToSetup({ teamError: error.message }, "#team-section");
    }

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
  const inviteId = readRequiredFormString(formData, "inviteId", "Nao encontrei o convite selecionado.");

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
  const inviteId = readRequiredFormString(formData, "inviteId", "Nao encontrei o convite selecionado.");

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
  const inviteId = readRequiredFormString(formData, "inviteId", "Nao encontrei o convite selecionado.");

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
  try {
    const membershipId = readRequiredFormString(formData, "membershipId", "Nao encontrei o usuario selecionado.");
    const role = readOptionalFormEnum(
      formData,
      "memberRole",
      Object.values(WorkspaceRole),
      WorkspaceRole.MEMBER,
      "Escolha um papel valido para o usuario.",
    );

    await updateWorkspaceMemberRole({
      membershipId,
      role,
    });
  } catch (error) {
    if (error instanceof FormInputError) {
      redirectToSetup({ teamError: error.message }, "#team-section");
    }

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
  const membershipId = readRequiredFormString(formData, "membershipId", "Nao encontrei o usuario selecionado.");

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
  try {
    const membershipId = readRequiredFormString(formData, "membershipId", "Nao encontrei o usuario selecionado.");
    const password = readRequiredFormString(formData, "memberPasswordReset", "Informe uma nova senha para o usuario.");

    await resetWorkspaceMemberPassword({
      membershipId,
      password,
    });
  } catch (error) {
    if (error instanceof FormInputError) {
      redirectToSetup({ teamError: error.message }, "#team-section");
    }

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
  try {
    const context = await getCurrentWorkspaceContext();
    if (!canManageWorkspace(context.workspaceRole)) {
      redirectEvolution("Apenas owner ou admin podem criar a conexão principal do WhatsApp.");
    }

    const instanceName = readRequiredFormString(
      formData,
      "instanceName",
      "Defina um nome de instância para criar a conexão WhatsApp.",
    );
    const number = readOptionalFormMaybeString(formData, "instanceNumber");
    await ensureWorkspaceEvolutionInstanceAvailable(instanceName, context.workspaceId);

    await createEvolutionInstance({
      instanceName,
      number,
    });
    await bindWorkspaceEvolutionInstanceName(instanceName);
    revalidatePath("/dashboard/setup");
    revalidatePath("/dashboard/whatsapp");
    redirectEvolution(`Instância ${instanceName} criada com sucesso na Evolution API.`, true);
  } catch (error) {
    if (error instanceof FormInputError) {
      redirectEvolution(error.message);
    }

    const message =
      error instanceof EvolutionApiError
        ? error.message
        : "Não foi possível criar a instância na Evolution API.";

    redirectEvolution(message);
  }
}

export async function connectEvolutionInstanceAction(formData: FormData) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!canManageWorkspace(context.workspaceRole)) {
      redirectEvolution("Apenas owner ou admin podem gerar o pareamento do WhatsApp.");
    }

    const instanceName = readRequiredFormString(
      formData,
      "instanceName",
      "Escolha uma instância para solicitar o pareamento.",
    );
    await ensureWorkspaceEvolutionInstanceAvailable(instanceName, context.workspaceId);

    const result = await connectEvolutionInstance(instanceName);
    const pairingCode = result.pairingCode;
    await bindWorkspaceEvolutionInstanceName(instanceName);

    revalidatePath("/dashboard/setup");
    revalidatePath("/dashboard/whatsapp");
    redirectEvolution(`Pareamento solicitado para ${instanceName}.`, true, {
      evolutionPairingCode: pairingCode,
    });
  } catch (error) {
    if (error instanceof FormInputError) {
      redirectEvolution(error.message);
    }

    const message =
      error instanceof EvolutionApiError
        ? error.message
        : "Não foi possível gerar o pareamento da instância.";

    redirectEvolution(message);
  }
}

export async function bindEvolutionInstanceAction(formData: FormData) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!canManageWorkspace(context.workspaceRole)) {
      redirectEvolution("Apenas owner ou admin podem definir a conexão principal do WhatsApp.");
    }

    const instanceName = readRequiredFormString(
      formData,
      "instanceName",
      "Escolha uma instância válida para usar nesta empresa.",
    );
    await ensureWorkspaceEvolutionInstanceAvailable(instanceName, context.workspaceId);

    await bindWorkspaceEvolutionInstanceName(instanceName);
  } catch (error) {
    if (error instanceof FormInputError) {
      redirectEvolution(error.message);
    }

    const message = error instanceof Error
      ? error.message
      : "Não foi possível vincular a instância principal do WhatsApp.";

    redirectEvolution(message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  revalidatePath("/dashboard/whatsapp");
  redirectEvolution("Instância principal do WhatsApp vinculada com sucesso.", true);
}

export async function connectWorkspaceAsaasAccountAction(formData: FormData) {
  try {
    const apiKey = readRequiredFormString(
      formData,
      "asaasApiKey",
      "Informe a API key da conta ou subconta Asaas do workspace.",
    );
    const accountId = readOptionalFormMaybeString(formData, "asaasAccountId");
    const splitEnabled = readFormCheckbox(formData, "asaasSplitEnabled");

    await connectWorkspaceAsaasAccount({
      apiKey,
      accountId,
      splitEnabled,
    });
  } catch (error) {
    if (error instanceof FormInputError) {
      redirectToSetup({ asaasError: error.message }, "#integrations-section");
    }

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
  try {
    const name = readRequiredFormString(formData, "subaccountName", "Preencha os dados essenciais para criar a conta de recebimento no Asaas.");
    const email = readRequiredFormString(formData, "subaccountEmail", "Preencha os dados essenciais para criar a conta de recebimento no Asaas.");
    const cpfCnpj = readRequiredFormString(formData, "subaccountCpfCnpj", "Preencha os dados essenciais para criar a conta de recebimento no Asaas.");
    const mobilePhone = readRequiredFormString(formData, "subaccountMobilePhone", "Preencha os dados essenciais para criar a conta de recebimento no Asaas.");
    const incomeValue = readRequiredPositiveNumber(formData, "subaccountIncomeValue", "Informe um faturamento mensal valido para criar a conta no Asaas.");
    const address = readRequiredFormString(formData, "subaccountAddress", "Preencha os dados essenciais para criar a conta de recebimento no Asaas.");
    const addressNumber = readRequiredFormString(formData, "subaccountAddressNumber", "Preencha os dados essenciais para criar a conta de recebimento no Asaas.");
    const complement = readOptionalFormMaybeString(formData, "subaccountComplement");
    const province = readRequiredFormString(formData, "subaccountProvince", "Preencha os dados essenciais para criar a conta de recebimento no Asaas.");
    const postalCode = readRequiredFormString(formData, "subaccountPostalCode", "Preencha os dados essenciais para criar a conta de recebimento no Asaas.");
    const companyType = readOptionalFormMaybeString(formData, "subaccountCompanyType");
    const birthDate = readOptionalFormMaybeString(formData, "subaccountBirthDate");

    await createWorkspaceAsaasSubaccount({
      name,
      email,
      cpfCnpj,
      mobilePhone,
      companyType,
      birthDate,
      incomeValue,
      address,
      addressNumber,
      complement,
      province,
      postalCode,
    });
  } catch (error) {
    if (error instanceof FormInputError) {
      redirectToSetup({ asaasError: error.message }, "#integrations-section");
    }

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
  const plan = readOptionalFormString(formData, "subscriptionPlan");
  const billingCycle = readOptionalFormString(formData, "subscriptionBillingCycle");

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
      showOperationalAlerts: readFormCheckbox(formData, "showOperationalAlerts"),
      showNotificationCenter: readFormCheckbox(formData, "showNotificationCenter"),
      emailOnInviteAccepted: readFormCheckbox(formData, "emailOnInviteAccepted"),
      emailOnSecurityAlerts: readFormCheckbox(formData, "emailOnSecurityAlerts"),
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
