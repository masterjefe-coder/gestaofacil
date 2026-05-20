"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { WorkspaceRole } from "@prisma/client";
import { connectEvolutionInstance, createEvolutionInstance, EvolutionApiError } from "@/lib/evolution-api";
import { updateWorkspaceSetup } from "@/lib/workspace-settings-repository";
import {
  createWorkspaceMember,
  removeWorkspaceMember,
  resetWorkspaceMemberPassword,
  updateWorkspaceMemberRole,
  WorkspaceMemberError,
} from "@/lib/workspace-membership-repository";
import type { SetupInput } from "@/lib/types";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function redirectEvolution(message: string, ok = false, extras?: Record<string, string | undefined>) {
  const params = new URLSearchParams({
    evolutionMessage: message,
    evolutionOk: ok ? "1" : "0",
  });

  for (const [key, value] of Object.entries(extras || {})) {
    if (value) {
      params.set(key, value);
    }
  }

  redirect(`/dashboard/setup?${params.toString()}`);
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
    return;
  }

  await updateWorkspaceSetup(input);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
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

    redirect(`/dashboard/setup?teamError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirect("/dashboard/setup?teamCreated=1");
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

    redirect(`/dashboard/setup?teamError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirect("/dashboard/setup?teamUpdated=1");
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

    redirect(`/dashboard/setup?teamError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirect("/dashboard/setup?teamRemoved=1");
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

    redirect(`/dashboard/setup?teamError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirect("/dashboard/setup?teamPasswordReset=1");
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

  if (!instanceName) {
    redirectEvolution("Escolha uma instância para solicitar o pareamento.");
  }

  try {
    const result = await connectEvolutionInstance(instanceName);

    revalidatePath("/dashboard/setup");
    redirectEvolution(`Pareamento solicitado para ${instanceName}.`, true, {
      evolutionPairingCode: result.pairingCode,
      evolutionQrCode: result.code,
    });
  } catch (error) {
    const message =
      error instanceof EvolutionApiError
        ? error.message
        : "Não foi possível gerar o pareamento da instância.";

    redirectEvolution(message);
  }
}
