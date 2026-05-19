"use client";

import { useActionState } from "react";
import {
  createWorkspaceOnboardingAction,
  type OnboardingActionState,
} from "@/app/onboarding/actions";

const initialState: OnboardingActionState = {};

export function OnboardingForm() {
  const [state, formAction, isPending] = useActionState(createWorkspaceOnboardingAction, initialState);

  return (
    <form action={formAction} className="auth-form">
      <label>
        <span>Seu nome</span>
        <input name="name" type="text" placeholder="Ex.: Marina Teixeira" required />
      </label>
      <label>
        <span>Email de acesso</span>
        <input name="email" type="email" placeholder="voce@empresa.com.br" required />
      </label>
      <label>
        <span>Senha</span>
        <input name="password" type="password" placeholder="Minimo de 8 caracteres" minLength={8} required />
      </label>
      <label>
        <span>Nome do workspace</span>
        <input name="workspaceName" type="text" placeholder="Ex.: Operacao Lume" required />
      </label>
      <label>
        <span>Slug do workspace</span>
        <input name="workspaceSlug" type="text" placeholder="Ex.: operacao-lume" />
      </label>
      <label>
        <span>Nome fantasia</span>
        <input name="tradeName" type="text" placeholder="Ex.: Studio Lume" required />
      </label>
      <label className="form-span-2">
        <span>Razao social</span>
        <input name="legalName" type="text" placeholder="Ex.: Studio Lume Servicos Digitais LTDA" required />
      </label>
      <label>
        <span>Documento</span>
        <input name="document" type="text" placeholder="CPF ou CNPJ" required />
      </label>
      <label>
        <span>Cidade</span>
        <input name="city" type="text" placeholder="Ex.: Belo Horizonte" />
      </label>
      <label>
        <span>Estado</span>
        <input name="state" type="text" placeholder="Ex.: MG" maxLength={2} />
      </label>
      <label className="form-span-2">
        <span>Descricao do servico</span>
        <input
          name="serviceDescription"
          type="text"
          placeholder="Ex.: Operacao comercial e financeira para servicos recorrentes."
        />
      </label>
      <button type="submit" className="primary-link form-submit" disabled={isPending}>
        {isPending ? "Criando workspace..." : "Criar conta e workspace"}
      </button>

      {state.error ? <p className="auth-error">{state.error}</p> : null}
    </form>
  );
}
