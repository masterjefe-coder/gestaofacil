import type { SetupPageFlashState } from "@/lib/setup-page-state";

export function SetupSubscriptionFlashMessages({ state }: { state: SetupPageFlashState }) {
  return (
    <>
      {state.subscriptionIntent ? (
        <div className="auth-hint">
          <strong>Próximo passo</strong>
          <span>A empresa já está em teste. Se quiser deixar a cobrança automática pronta, faça isso aqui embaixo.</span>
        </div>
      ) : null}
      {state.subscriptionUpdated ? (
        <div className="auth-hint">
          <strong>Plano atualizado</strong>
          <span>O plano da empresa foi ajustado com sucesso.</span>
        </div>
      ) : null}
      {state.subscriptionCheckoutCreated ? (
        <div className="auth-hint">
          <strong>Cobrança automática criada</strong>
          <span>O plano da empresa já está ligado à cobrança automática.</span>
        </div>
      ) : null}
      {state.subscriptionError ? (
        <div className="auth-hint fiscal-warning">
          <strong>Não foi possível concluir essa etapa</strong>
          <span>{state.subscriptionError}</span>
        </div>
      ) : null}
    </>
  );
}

export function SetupAsaasFlashMessages({ state }: { state: SetupPageFlashState }) {
  return (
    <>
      {state.asaasConnected ? (
        <div className="auth-hint">
          <strong>Conta Asaas conectada</strong>
          <span>
            {state.asaasCreated
              ? "A conta de recebimento foi criada e ligada à empresa. Se ainda faltar algum documento, finalize isso direto na conta."
              : "A empresa já pode emitir cobranças pela conta conectada."}
          </span>
        </div>
      ) : null}
      {state.asaasDisconnected ? (
        <div className="auth-hint fiscal-warning">
          <strong>Conta Asaas desconectada</strong>
          <span>A empresa voltou a operar sem uma conta própria conectada.</span>
        </div>
      ) : null}
      {state.asaasError ? (
        <div className="auth-hint fiscal-warning">
          <strong>Falha na configuração Asaas</strong>
          <span>{state.asaasError}</span>
          {state.asaasError.includes("ASAAS_API_KEY da conta principal") ? (
            <small className="muted-text">
              Para criar subcontas dentro do produto, a plataforma precisa ter uma `ASAAS_API_KEY` principal válida no ambiente de produção.
            </small>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function SetupTeamFlashMessages({ state }: { state: SetupPageFlashState }) {
  return (
    <>
      {state.inviteCreated ? <p className="auth-hint">Convite criado com sucesso. Compartilhe o link com a pessoa convidada.</p> : null}
      {state.inviteRevoked ? <p className="auth-hint">Convite revogado com sucesso.</p> : null}
      {state.inviteAccepted ? <p className="auth-hint">Convite aceito com sucesso. O acesso já está ativo neste workspace.</p> : null}
      {state.inviteResent ? <p className="auth-hint">Convite reenviado com sucesso.</p> : null}
      {state.inviteRenewed ? <p className="auth-hint">Convite renovado com sucesso.</p> : null}
      {state.teamCreated ? <p className="auth-hint">Usuário adicionado à empresa com sucesso.</p> : null}
      {state.teamUpdated ? <p className="auth-hint">Papel do usuário atualizado com sucesso.</p> : null}
      {state.teamRemoved ? <p className="auth-hint">Usuário removido da empresa com sucesso.</p> : null}
      {state.teamPasswordReset ? <p className="auth-hint">Senha do usuário redefinida com sucesso.</p> : null}
      {state.teamError ? <p className="auth-error">{state.teamError}</p> : null}
    </>
  );
}
