import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { PasswordResetRequestForm } from "@/components/password-reset-request-form";

export default function RecoverPasswordPage() {
  return (
    <main className="auth-shell">
      <div className="page-shell auth-page-shell">
        <MarketingTopbar ctaHref="/login" ctaLabel="Voltar ao login" />
      </div>
      <section className="auth-layout">
        <article className="auth-hero-panel">
          <BrandLogo className="auth-wordmark" priority />
          <span className="section-label">Recuperação de acesso</span>
          <h1>Redefinir senha sem depender do suporte.</h1>
          <p>
            Esse fluxo prepara um link seguro para a própria pessoa recuperar o acesso
            e voltar para o workspace com menos atrito operacional.
          </p>
          <div className="auth-hero-points">
            <div className="auth-hero-point">Link temporário por email</div>
            <div className="auth-hero-point">Sem compartilhar senha provisória</div>
            <div className="auth-hero-point">Trilha auditável no workspace</div>
          </div>
        </article>

        <section className="auth-card">
          <PasswordResetRequestForm />

          <div className="hero-actions">
            <Link href="/login" className="secondary-link">
              Voltar para o login
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
