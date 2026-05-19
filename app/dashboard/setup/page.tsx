import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  createWorkspaceMemberAction,
  removeWorkspaceMemberAction,
  resetWorkspaceMemberPasswordAction,
  updateWorkspaceMemberRoleAction,
  updateWorkspaceSetupAction,
} from "@/app/dashboard/setup/actions";
import { listAuditEntries } from "@/lib/audit-repository";
import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/auth-session";
import { getWorkspaceSetup } from "@/lib/workspace-settings-repository";
import { listWorkspaceMembers } from "@/lib/workspace-membership-repository";
import { isLocalDataMode } from "@/lib/data-mode";

type SetupPageProps = {
  searchParams?: Promise<{
    teamCreated?: string;
    teamUpdated?: string;
    teamRemoved?: string;
    teamPasswordReset?: string;
    teamError?: string;
  }>;
};

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const [setup, members, auditEntries, context, params] = await Promise.all([
    getWorkspaceSetup(),
    listWorkspaceMembers(),
    listAuditEntries(8),
    getCurrentWorkspaceContext(),
    searchParams,
  ]);
  const teamCreated = params?.teamCreated === "1";
  const teamUpdated = params?.teamUpdated === "1";
  const teamRemoved = params?.teamRemoved === "1";
  const teamPasswordReset = params?.teamPasswordReset === "1";
  const teamError = params?.teamError;
  const canManage = isLocalDataMode() || canManageWorkspace(context.workspaceRole);

  return (
    <DashboardShell
      eyebrow="Setup"
      title="O sistema precisa conhecer a empresa para vender, cobrar e emitir melhor."
      description="Aqui nasce a identidade do workspace, a configuracao da empresa e a base para futuras automacoes de cobranca e NFS-e."
      actions={
        <Link href="/dashboard" className="secondary-link">
          Voltar ao dashboard
        </Link>
      }
    >
      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Workspace e empresa</span>
            <h2>Defina a identidade operacional do negocio</h2>
          </div>
        </div>

        {canManage ? (
          <form action={updateWorkspaceSetupAction} className="inline-form">
            <label>
              <span>Nome do workspace</span>
              <input name="name" type="text" defaultValue={setup.name} required />
            </label>
            <label>
              <span>Slug</span>
              <input name="slug" type="text" defaultValue={setup.slug} required />
            </label>
            <label className="form-span-2">
              <span>Nicho</span>
              <input name="niche" type="text" defaultValue={setup.niche} />
            </label>
            <label className="form-span-2">
              <span>Razao social</span>
              <input name="legalName" type="text" defaultValue={setup.legalName} />
            </label>
            <label className="form-span-2">
              <span>Nome fantasia</span>
              <input name="tradeName" type="text" defaultValue={setup.tradeName} required />
            </label>
            <label>
              <span>Documento</span>
              <input name="document" type="text" defaultValue={setup.document} required />
            </label>
            <label>
              <span>Cidade</span>
              <input name="city" type="text" defaultValue={setup.city} />
            </label>
            <label>
              <span>UF</span>
              <input name="state" type="text" defaultValue={setup.state} />
            </label>
            <label className="form-span-2">
              <span>Descricao padrao de servicos</span>
              <input
                name="serviceDescription"
                type="text"
                defaultValue={setup.serviceDescription}
              />
            </label>
            <label className="form-span-2">
              <span>Chave Pix padrao</span>
              <input name="defaultPixKey" type="text" defaultValue={setup.defaultPixKey} />
            </label>
            <label className="form-span-2">
              <span>Mensagem padrao de cobranca</span>
              <input
                name="defaultPaymentMessage"
                type="text"
                defaultValue={setup.defaultPaymentMessage}
              />
            </label>
            <button type="submit" className="primary-link form-submit">
              Salvar configuracoes
            </button>
          </form>
        ) : (
          <div className="auth-hint">
            <strong>Acesso de leitura</strong>
            <span>Somente owner ou admin podem alterar o setup e convidar novos usuarios.</span>
          </div>
        )}
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Equipe do workspace</span>
            <h2>Adicionar operador, financeiro ou apoio comercial no mesmo ambiente</h2>
          </div>
        </div>

        {teamCreated ? <p className="auth-hint">Usuario adicionado ao workspace com sucesso.</p> : null}
        {teamUpdated ? <p className="auth-hint">Papel do usuario atualizado com sucesso.</p> : null}
        {teamRemoved ? <p className="auth-hint">Usuario removido do workspace com sucesso.</p> : null}
        {teamPasswordReset ? <p className="auth-hint">Senha do usuario redefinida com sucesso.</p> : null}
        {teamError ? <p className="auth-error">{teamError}</p> : null}

        {isLocalDataMode() ? (
          <div className="auth-hint">
            <strong>Modo local ativo</strong>
            <span>Com `DATABASE_URL`, esta area passa a criar usuarios reais no mesmo workspace.</span>
          </div>
        ) : !canManage ? (
          <div className="auth-hint">
            <strong>Gestao restrita</strong>
            <span>Seu papel atual permite consultar a equipe, mas nao adicionar novos usuarios.</span>
          </div>
        ) : (
          <form action={createWorkspaceMemberAction} className="inline-form">
            <label>
              <span>Nome do usuario</span>
              <input name="memberName" type="text" placeholder="Ex.: Julia Financeiro" required />
            </label>
            <label>
              <span>Email</span>
              <input name="memberEmail" type="email" placeholder="julia@empresa.com.br" required />
            </label>
            <label>
              <span>Senha inicial</span>
              <input
                name="memberPassword"
                type="password"
                placeholder="Minimo de 8 caracteres"
                minLength={8}
                required
              />
            </label>
            <label>
              <span>Papel</span>
              <select name="memberRole" defaultValue="MEMBER">
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
                <option value="OWNER">Owner</option>
              </select>
            </label>
            <button type="submit" className="primary-link form-submit">
              Adicionar usuario
            </button>
          </form>
        )}

        <div className="data-table">
          <div className="data-table-head">
            <span>Usuario</span>
            <span>Email</span>
            <span>Papel</span>
            <span>Entrou em</span>
            <span>Acoes</span>
          </div>
          {members.map((member) => (
            <article key={member.id} className="data-table-row">
              <div>
                <strong>{member.name}</strong>
                <small>{member.isCurrentUser ? "Voce" : member.role}</small>
              </div>
              <span>{member.email}</span>
              <span>{member.role}</span>
              <span>{member.joinedAt}</span>
              <div>
                {canManage && !isLocalDataMode() ? (
                  <div className="cards-grid">
                    <form action={updateWorkspaceMemberRoleAction} className="inline-form">
                      <input type="hidden" name="membershipId" value={member.id} />
                      <label>
                        <span>Papel</span>
                        <select name="memberRole" defaultValue={member.role}>
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                          <option value="OWNER">Owner</option>
                        </select>
                      </label>
                      <button type="submit" className="ghost-button">
                        Atualizar papel
                      </button>
                    </form>

                    <form action={resetWorkspaceMemberPasswordAction} className="inline-form">
                      <input type="hidden" name="membershipId" value={member.id} />
                      <label>
                        <span>Nova senha</span>
                        <input
                          name="memberPasswordReset"
                          type="password"
                          placeholder="Minimo de 8 caracteres"
                          minLength={8}
                          required
                        />
                      </label>
                      <button type="submit" className="ghost-button">
                        Redefinir senha
                      </button>
                    </form>

                    <form action={removeWorkspaceMemberAction} className="row-action">
                      <input type="hidden" name="membershipId" value={member.id} />
                      <button type="submit" className="ghost-button">
                        Remover usuario
                      </button>
                    </form>
                  </div>
                ) : (
                  <small className="muted-text">Sem acoes disponiveis</small>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-split">
        <article className="split-panel success">
          <span className="section-label">Por que isso importa</span>
          <h2>Sem setup, o produto vira cadastro solto. Com setup, ele vira sistema.</h2>
          <p>
            Esses dados vao alimentar cobranca, templates, onboarding e o futuro modulo de
            emissao fiscal.
          </p>
        </article>

        <article className="split-panel">
          <span className="section-label">Proximo uso</span>
          <h2>Base para automacoes e identidade comercial</h2>
          <p>
            O nome da empresa, o Pix padrao e a descricao de servico devem aparecer nas telas
            certas para reduzir digitacao e passar mais confianca.
          </p>
        </article>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Auditoria recente</span>
            <h2>Equipe e configuracoes sensiveis ficam registradas no workspace</h2>
          </div>
        </div>

        <div className="data-table">
          <div className="data-table-head">
            <span>Quando</span>
            <span>Responsavel</span>
            <span>Evento</span>
            <span>Resumo</span>
          </div>
          {auditEntries.map((entry) => (
            <article key={entry.id} className="data-table-row">
              <span>{entry.createdAt}</span>
              <div>
                <strong>{entry.actorName}</strong>
                <small>{entry.actorEmail}</small>
              </div>
              <span>{entry.action}</span>
              <span>{entry.summary}</span>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
