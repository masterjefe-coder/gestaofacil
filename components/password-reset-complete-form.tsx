"use client";

import { useActionState } from "react";
import { completePasswordResetAction, type PasswordResetCompleteState } from "@/app/redefinir-senha/actions";

const initialState: PasswordResetCompleteState = {};

type PasswordResetCompleteFormProps = {
  token: string;
  email: string;
};

export function PasswordResetCompleteForm({ token, email }: PasswordResetCompleteFormProps) {
  const [state, formAction, isPending] = useActionState(completePasswordResetAction, initialState);

  return (
    <>
      <form action={formAction} className="auth-form">
        <input type="hidden" name="token" value={token} />

        <div className="auth-hint">
          <strong>Conta reconhecida</strong>
          <span>Você está redefinindo a senha de {email}.</span>
        </div>

        <div className="auth-form-section">
          <div className="auth-form-section-header">
            <strong>Nova senha</strong>
            <span>Use pelo menos 8 caracteres para concluir a recuperação.</span>
          </div>
          <label>
            <span>Senha</span>
            <input name="password" type="password" placeholder="Nova senha" minLength={8} required />
          </label>
        </div>

        <button type="submit" className="primary-link form-submit" disabled={isPending}>
          {isPending ? "Salvando nova senha..." : "Salvar nova senha"}
        </button>
      </form>

      {state.error ? <p className="auth-error">{state.error}</p> : null}
    </>
  );
}
