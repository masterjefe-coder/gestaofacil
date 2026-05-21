import Link from "next/link";
import { getServerSession } from "next-auth";
import { acceptExistingWorkspaceInviteAction } from "@/app/convite/actions";
import { BrandLogo } from "@/components/brand-logo";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { WorkspaceInviteAcceptanceForm } from "@/components/workspace-invite-acceptance-form";
import { authOptions } from "@/lib/auth-options";
import { getWorkspaceInviteByToken } from "@/lib/workspace-invite-repository";

type WorkspaceInvitePageProps = {
  searchParams?: Promise<{
    token?: string;
    error?: string;
  }>;
};

export default async function WorkspaceInvitePage({ searchParams }: WorkspaceInvitePageProps) {
  const params = await searchParams;
  const token = params?.token?.trim() || "";
  const error = params?.error;
  const session = await getServerSession(authOptions);
  const invite = token ? await getWorkspaceInviteByToken(token) : null;
  const isMatchingSession = Boolean(session?.user?.email && invite?.email === session.user.email);

  return (
    <main className="auth-shell">
      <div className="page-shell auth-page-shell">
        <MarketingTopbar ctaHref="/login" ctaLabel="Entrar no sistema" />
      </div>
      <section className="auth-layout">
        <article className="auth-hero-panel">
          <BrandLogo className="auth-wordmark" priority />
          <span className="section-label">Convite de workspace</span>
          <h1>Entrar em uma empresa no Gestão Fácil.</h1>
          <p>
            Esse fluxo adiciona a pessoa convidada ao workspace certo sem depender
            de senha compartilhada ou criação manual no escuro.
          </p>
          <div className="auth-hero-points">
            <div className="auth-hero-point">Entrada segura por email convidado</div>
            <div className="auth-hero-point">Papel definido já no aceite</div>
            <div className="auth-hero-point">Compatível com multiempresa</div>
          </div>
        </article>

        <section className="auth-card auth-card-wide">
          {!token || !invite ? (
            <div className="auth-error">
              Convite não encontrado. Peça um novo link para a empresa que te convidou.
            </div>
          ) : invite.status !== "Pendente" ? (
            <div className="auth-hint fiscal-warning">
              <strong>Convite indisponível</strong>
              <span>
                Situação atual: {invite.status.toLowerCase()}. Peça um novo convite se ainda precisar entrar em {invite.workspaceTradeName}.
              </span>
            </div>
          ) : (
            <>
              <div className="auth-hint">
                <strong>{invite.workspaceTradeName}</strong>
                <span>
                  {invite.email} foi convidado para entrar em {invite.workspaceName} como {invite.role}.
                </span>
                <small className="muted-text">
                  Esse convite expira em {new Intl.DateTimeFormat("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(invite.expiresAt)}.
                </small>
              </div>

              {error ? <p className="auth-error">{error}</p> : null}

              {isMatchingSession ? (
                <form action={acceptExistingWorkspaceInviteAction} className="auth-form">
                  <input type="hidden" name="token" value={token} />
                  <div className="auth-form-section">
                    <div className="auth-form-section-header">
                      <strong>Conta reconhecida</strong>
                      <span>Você já entrou com o email convidado. Falta só confirmar o acesso ao workspace.</span>
                    </div>
                    <label>
                      <span>Email autenticado</span>
                      <input type="email" value={session?.user?.email || ""} readOnly />
                    </label>
                  </div>
                  <button type="submit" className="primary-link form-submit">
                    Aceitar convite e abrir empresa
                  </button>
                </form>
              ) : session?.user?.email ? (
                <div className="auth-hint fiscal-warning">
                  <strong>Conta diferente da convidada</strong>
                  <span>
                    Você está com {session.user.email}, mas o convite pertence a {invite.email}. Entre com a conta certa para aceitar.
                  </span>
                  <Link href={`/login?callbackUrl=${encodeURIComponent(`/convite?token=${token}`)}`} className="secondary-link">
                    Entrar com outro email
                  </Link>
                </div>
              ) : (
                <>
                  <WorkspaceInviteAcceptanceForm
                    token={token}
                    email={invite.email}
                    suggestedName={invite.name}
                    workspaceName={invite.workspaceTradeName}
                  />

                  <div className="auth-hint">
                    <strong>Já existe conta nesse email?</strong>
                    <Link href={`/login?callbackUrl=${encodeURIComponent(`/convite?token=${token}`)}`}>
                      Entrar para aceitar com a conta existente
                    </Link>
                  </div>
                </>
              )}
            </>
          )}

          <div className="hero-actions">
            <Link href="/login" className="secondary-link">
              Ir para login
            </Link>
            <Link href="/" className="secondary-link">
              Voltar para o site
            </Link>
          </div>
        </section>
      </section>
      <div className="page-shell auth-page-shell">
        <MarketingFooter />
      </div>
    </main>
  );
}
