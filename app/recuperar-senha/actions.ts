"use server";

import { requestPasswordReset, PasswordResetError } from "@/lib/password-reset";

export type PasswordResetRequestState = {
  success?: string;
  error?: string;
};

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function requestPasswordResetAction(
  _previousState: PasswordResetRequestState,
  formData: FormData,
): Promise<PasswordResetRequestState> {
  try {
    const result = await requestPasswordReset(getString(formData, "email"));

    if (!result.delivery.sent && result.delivery.error) {
      return {
        success: "Pedido recebido. Se a conta existir, o link foi preparado.",
        error: result.delivery.skipped ? undefined : result.delivery.error,
      };
    }
  } catch (error) {
    if (error instanceof PasswordResetError) {
      return { error: error.message };
    }

    return { error: "Não foi possível processar a recuperação de senha agora." };
  }

  return {
    success: "Se esse email existir na base, você vai receber um link para redefinir a senha.",
  };
}
