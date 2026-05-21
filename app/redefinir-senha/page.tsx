import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { PasswordResetCompleteForm } from "@/components/password-reset-complete-form";
import { validatePasswordResetToken } from "@/lib/password-reset";

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const token = params?.token?.trim() || "";
  const reset = token ? await validatePasswordResetToken(token) : null;

  return (
    <main className="auth-shell">
      <div className="page-shell auth-page-shell">
        <MarketingTopbar ctaHref="/login" ctaLabel="Voltar ao login" />
      </div>
      <section className="auth-layout">
        <article className="auth-hero-panel">
          <BrandLogo className="auth-wordmark" priority />
          <span className="section-label">Nova senha</span>
          <h1>Concluir recuperação de acesso.</h1>
          <p>
            Quando o link ainda está válido, a troca de senha acontece direto aqui
            e a conta já volta pronta para login.
          </p>
          <div className="auth-hero-points">
            <div className="auth-hero-point">Link com expiração curta</div>
            <div className="auth-hero-point">Uso único por segurança</div>
            <div className="auth-hero-point">Retorno rápido ao login</div>
          </div>
        </article>

        <section className="auth-card">
          {!reset ? (
            <div className="auth-error">
              Link inválido. Solicite uma nova redefinição de senha.
            </div>
          ) : reset.consumed ? (
            <div className="auth-hint fiscal-warning">
              <strong>Link já utilizado</strong>
              <span>Esse link já foi usado. Se precisar, solicite uma nova redefinição.</span>
            </div>
          ) : reset.expired ? (
            <div className="auth-hint fiscal-warning">
              <strong>Link expirado</strong>
              <span>Esse link expirou. Gere um novo pedido de recuperação para continuar.</span>
            </div>
          ) : (
            <PasswordResetCompleteForm token={token} email={reset.email} />
          )}

          <div className="hero-actions">
            <Link href="/recuperar-senha" className="secondary-link">
              Pedir novo link
            </Link>
            <Link href="/login" className="secondary-link">
              Voltar ao login
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
