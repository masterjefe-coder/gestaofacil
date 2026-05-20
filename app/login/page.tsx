import Link from "next/link";
import { getServerSession } from "next-auth";
import { AuthSignInForm } from "@/components/auth-sign-in-form";
import { BrandLogo } from "@/components/brand-logo";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { authOptions } from "@/lib/auth-options";

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

  if (session) {
    return (
      <main className="auth-shell">
        <div className="page-shell auth-page-shell">
          <MarketingTopbar ctaHref="/checkout?plan=PROFESSIONAL" ctaLabel="Iniciar trial" />
        </div>
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
              Voltar para a landing
            </Link>
          </div>
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
        <MarketingTopbar ctaHref="/checkout?plan=PROFESSIONAL" ctaLabel="Iniciar trial" />
      </div>
      <section className="auth-card">
        <BrandLogo className="auth-wordmark" priority />
        <span className="eyebrow">Acesso ao workspace</span>
        <h1>Entrar no Gestão Fácil.</h1>
        <p>
          Esta primeira camada de autenticação protege o dashboard e prepara o terreno para
          evoluirmos do acesso demo para contas reais por workspace.
        </p>

        <AuthSignInForm callbackUrl={callbackUrl} />

        <div className="auth-hint">
          <strong>Credenciais demo padrão</strong>
          <span>`demo@gestaofacil.local`</span>
          <span>`gestao123`</span>
        </div>
      </section>
      <div className="page-shell auth-page-shell">
        <MarketingFooter />
      </div>
    </main>
  );
}
