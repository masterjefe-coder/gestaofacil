"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, type PasswordResetRequestState } from "@/app/recuperar-senha/actions";

const initialState: PasswordResetRequestState = {};

export function PasswordResetRequestForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <>
      <form action={formAction} className="auth-form">
        <div className="auth-form-section">
          <div className="auth-form-section-header">
            <strong>Recuperar acesso</strong>
            <span>Informe o email da conta para receber o link de redefinição.</span>
          </div>
          <label>
            <span>Email</span>
            <input name="email" type="email" placeholder="voce@empresa.com.br" required />
          </label>
        </div>
        <button type="submit" className="primary-link form-submit" disabled={isPending}>
          {isPending ? "Preparando link..." : "Enviar link de redefinição"}
        </button>
      </form>

      {state.success ? (
        <div className="auth-hint">
          <strong>Pedido recebido</strong>
          <span>{state.success}</span>
        </div>
      ) : null}

      {state.error ? <p className="auth-error">{state.error}</p> : null}

      <div className="auth-hint">
        <strong>Lembrou da senha?</strong>
        <Link href="/login">Voltar para o login</Link>
      </div>
    </>
  );
}
