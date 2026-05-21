"use server";

import { redirect } from "next/navigation";
import { completePasswordReset, PasswordResetError } from "@/lib/password-reset";

export type PasswordResetCompleteState = {
  error?: string;
};

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function completePasswordResetAction(
  _previousState: PasswordResetCompleteState,
  formData: FormData,
): Promise<PasswordResetCompleteState> {
  try {
    const result = await completePasswordReset({
      token: getString(formData, "token"),
      password: getString(formData, "password"),
    });

    redirect(`/login?reset=1&email=${encodeURIComponent(result.email)}`);
  } catch (error) {
    if (error instanceof PasswordResetError) {
      return { error: error.message };
    }

    return { error: "Não foi possível redefinir a senha agora." };
  }
}
