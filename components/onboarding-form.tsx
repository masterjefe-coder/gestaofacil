"use client";

import { useActionState } from "react";
import {
  createWorkspaceOnboardingAction,
  type OnboardingActionState,
} from "@/app/onboarding/actions";
import { getSubscriptionPlanPresentation } from "@/lib/subscription";
import type { SubscriptionPlanCode } from "@/lib/types";

const initialState: OnboardingActionState = {};

type OnboardingFormProps = {
  selectedPlan?: SubscriptionPlanCode;
  nextUrl?: string;
};

export function OnboardingForm({ selectedPlan = "PROFESSIONAL", nextUrl = "/dashboard/setup?subscriptionIntent=1" }: OnboardingFormProps) {
  const [state, formAction, isPending] = useActionState(createWorkspaceOnboardingAction, initialState);
  const selectedPlanMeta = getSubscriptionPlanPresentation(selectedPlan);

  return (
    <form action={formAction} className="auth-form">
      <div className="auth-hint">
        <strong>Trial de 14 dias liberado</strong>
        <span>
          Seu workspace começa no plano {selectedPlanMeta.name} com teste grátis de 14 dias,
          sem cartão e com a base pronta para assinatura depois.
        </span>
        <small className="muted-text">
          Referência comercial atual: {selectedPlanMeta.price} no mensal.
        </small>
      </div>
      <input type="hidden" name="subscriptionPlan" value={selectedPlan} />
      <input type="hidden" name="subscriptionBillingCycle" value="MONTHLY" />
      <input type="hidden" name="nextUrl" value={nextUrl} />
      <div className="auth-form-section">
        <div className="auth-form-section-header">
          <strong>Seu acesso</strong>
          <span>Esses dados criam o usuário principal do workspace.</span>
        </div>
        <div className="auth-form-grid">
          <label>
            <span>Seu nome</span>
            <input name="name" type="text" placeholder="Ex.: Marina Teixeira" required />
          </label>
          <label>
            <span>Email de acesso</span>
            <input name="email" type="email" placeholder="voce@empresa.com.br" required />
          </label>
          <label className="form-span-2">
            <span>Senha</span>
            <input name="password" type="password" placeholder="Mínimo de 8 caracteres" minLength={8} required />
          </label>
        </div>
      </div>

      <div className="auth-form-section">
        <div className="auth-form-section-header">
          <strong>Identidade do workspace</strong>
          <span>Esses campos organizam a operação e a identificação inicial da empresa.</span>
        </div>
        <div className="auth-form-grid">
          <label>
            <span>Nome do workspace</span>
            <input name="workspaceName" type="text" placeholder="Ex.: Operação Lume" required />
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
            <span>Razão social</span>
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
            <span>Descrição do serviço</span>
            <input
              name="serviceDescription"
              type="text"
              placeholder="Ex.: Operação comercial e financeira para serviços recorrentes."
            />
          </label>
        </div>
      </div>
      <button type="submit" className="primary-link form-submit" disabled={isPending}>
        {isPending ? "Criando workspace..." : "Criar conta e workspace"}
      </button>

      {state.error ? <p className="auth-error">{state.error}</p> : null}
    </form>
  );
}
