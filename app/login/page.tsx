import Link from "next/link";
import { getServerSession } from "next-auth";
import { AuthSignInForm } from "@/components/auth-sign-in-form";
import { BrandLogo } from "@/components/brand-logo";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { authOptions } from "@/lib/auth-options";
import { canUsePublicDemoCredentials } from "@/lib/runtime-safety";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    callbackUrl?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getServerSession(authOptions);
  const params = searchParams ? await searchParams : undefined;
  const callbackUrl = params?.callbackUrl || "/dashboard";
  const showDemoCredentials = canUsePublicDemoCredentials();

  if (session) {
    return (
      <main className="auth-shell">
        <div className="page-shell auth-page-shell">
          <MarketingTopbar ctaHref="/checkout" ctaLabel="Escolher plano e iniciar teste" />
        </div>
        <section className="auth-layout auth-layout-single">
          <section className="auth-card">
            <BrandLogo className="auth-wordmark" priority />
            <span className="eyebrow">Sessão ativa</span>
            <h1>Você já entrou no Gestão Fácil.</h1>
            <p>
              O dashboard já está disponível para continuar a configuração e operar o workspace.
            </p>
            <div className="hero-actions">
              <Link href={callbackUrl} className="primary-link">
                Continuar
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

  return (
    <main className="auth-shell">
      <div className="page-shell auth-page-shell">
        <MarketingTopbar ctaHref="/checkout" ctaLabel="Escolher plano e iniciar teste" />
      </div>
      <section className="auth-layout">
        <article className="auth-hero-panel">
          <BrandLogo className="auth-wordmark" priority />
          <span className="section-label">Acesso ao workspace</span>
          <h1>Entrar no Gestão Fácil.</h1>
          <p>
            Esta primeira camada de autenticação protege o dashboard e prepara o
            terreno para a evolução de contas reais por workspace.
          </p>
          <div className="auth-hero-points">
            <div className="auth-hero-point">Acesso centralizado por workspace</div>
            <div className="auth-hero-point">Base pronta para contas reais</div>
            <div className="auth-hero-point">Fluxo simples para demo e onboarding</div>
          </div>
        </article>

        <section className="auth-card">
          <AuthSignInForm callbackUrl={callbackUrl} showDemoHints={showDemoCredentials} />

          {showDemoCredentials ? (
            <div className="auth-hint">
              <strong>Credenciais demo locais</strong>
              <span>`demo@gestaofacil.local`</span>
              <span>`gestao123`</span>
            </div>
          ) : null}
        </section>
      </section>
      <div className="page-shell auth-page-shell">
        <MarketingFooter />
      </div>
    </main>
  );
}
