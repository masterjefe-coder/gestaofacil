"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { WorkspaceRole } from "@prisma/client";
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
