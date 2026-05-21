"use client";

import { useActionState } from "react";
import { acceptNewWorkspaceInviteAction, type WorkspaceInviteActionState } from "@/app/convite/actions";

const initialState: WorkspaceInviteActionState = {};

type WorkspaceInviteAcceptanceFormProps = {
  token: string;
  email: string;
  suggestedName?: string;
  workspaceName: string;
};

export function WorkspaceInviteAcceptanceForm({
  token,
  email,
  suggestedName,
  workspaceName,
}: WorkspaceInviteAcceptanceFormProps) {
  const [state, formAction, isPending] = useActionState(acceptNewWorkspaceInviteAction, initialState);

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />

      <div className="auth-hint">
        <strong>Convite pronto para ativar</strong>
        <span>
          Esse acesso vai entrar direto no workspace {workspaceName} com o email {email}.
        </span>
      </div>

      <div className="auth-form-section">
        <div className="auth-form-section-header">
          <strong>Criar acesso da pessoa convidada</strong>
          <span>Se esse email já tiver conta, entre no sistema para aceitar o convite por login.</span>
        </div>
        <label>
          <span>Nome</span>
          <input name="name" type="text" placeholder="Ex.: Julia Financeiro" defaultValue={suggestedName || ""} required />
        </label>
        <label>
          <span>Email do convite</span>
          <input type="email" value={email} readOnly />
        </label>
        <label>
          <span>Senha inicial</span>
          <input name="password" type="password" placeholder="Mínimo de 8 caracteres" minLength={8} required />
        </label>
      </div>

      <button type="submit" className="primary-link form-submit" disabled={isPending}>
        {isPending ? "Ativando convite..." : "Criar acesso e entrar na empresa"}
      </button>

      {state.error ? <p className="auth-error">{state.error}</p> : null}
    </form>
  );
}
