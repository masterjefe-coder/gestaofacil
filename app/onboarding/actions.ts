"use server";

import { redirect } from "next/navigation";
import { createWorkspaceOnboarding, OnboardingError } from "@/lib/onboarding";

export type OnboardingActionState = {
  error?: string;
};

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function createWorkspaceOnboardingAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  try {
    await createWorkspaceOnboarding({
      name: getString(formData, "name"),
      email: getString(formData, "email"),
      password: getString(formData, "password"),
      workspaceName: getString(formData, "workspaceName"),
      workspaceSlug: getString(formData, "workspaceSlug"),
      tradeName: getString(formData, "tradeName"),
      legalName: getString(formData, "legalName"),
      document: getString(formData, "document"),
      city: getString(formData, "city"),
      state: getString(formData, "state"),
      serviceDescription: getString(formData, "serviceDescription"),
    });
  } catch (error) {
    if (error instanceof OnboardingError) {
      return { error: error.message };
    }

    return { error: "Nao foi possivel criar o workspace agora." };
  }

  const email = encodeURIComponent(getString(formData, "email"));
  redirect(`/login?created=1&email=${email}`);
}
