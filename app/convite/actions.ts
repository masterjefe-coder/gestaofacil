"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/auth-session";
import { acceptWorkspaceInvite, WorkspaceInviteError } from "@/lib/workspace-invite-repository";

export type WorkspaceInviteActionState = {
  error?: string;
};

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function acceptNewWorkspaceInviteAction(
  _previousState: WorkspaceInviteActionState,
  formData: FormData,
): Promise<WorkspaceInviteActionState> {
  try {
    await acceptWorkspaceInvite({
      token: getString(formData, "token"),
      mode: "new_user",
      name: getString(formData, "name"),
      password: getString(formData, "password"),
    });
  } catch (error) {
    if (error instanceof WorkspaceInviteError) {
      return { error: error.message };
    }

    return { error: "Nao foi possivel aceitar o convite agora." };
  }

  const email = encodeURIComponent(getString(formData, "email"));
  redirect(`/login?created=1&acceptedInvite=1&email=${email}&callbackUrl=${encodeURIComponent("/dashboard")}`);
}

export async function acceptExistingWorkspaceInviteAction(formData: FormData) {
  let result;

  try {
    result = await acceptWorkspaceInvite({
      token: getString(formData, "token"),
      mode: "existing_user",
    });
  } catch (error) {
    const message = error instanceof WorkspaceInviteError
      ? error.message
      : "Nao foi possivel aceitar o convite agora.";

    redirect(`/convite?token=${encodeURIComponent(getString(formData, "token"))}&error=${encodeURIComponent(message)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, result.workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/dashboard/setup?inviteAccepted=1#team-section");
}
