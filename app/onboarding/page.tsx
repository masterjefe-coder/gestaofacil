import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { OnboardingForm } from "@/components/onboarding-form";
import { authOptions } from "@/lib/auth-options";
import { isLocalDataMode } from "@/lib/data-mode";
import { isSubscriptionPlanCode } from "@/lib/workspace-subscription-repository";

type OnboardingPageProps = {
  searchParams?: Promise<{
    plan?: string;
    next?: string;
  }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const selectedPlan = params?.plan && isSubscriptionPlanCode(params.plan)
    ? params.plan
    : "PROFESSIONAL";
  const nextUrl = params?.next || "/dashboard/setup?subscriptionIntent=1";

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-shell">
      <div className="page-shell auth-page-shell">
        <MarketingTopbar ctaHref={`/checkout?plan=${selectedPlan}`} ctaLabel="Plano escolhido" />
      </div>
      <section className="auth-layout">
        <article className="auth-hero-panel">
          <BrandLogo className="auth-wordmark" priority />
          <span className="section-label">Primeiro workspace</span>
          <h1>Criar conta real no Gestão Fácil.</h1>
          <p>
            Este fluxo abre um usuário real, cria o workspace principal e deixa
            a empresa pronta para continuar no dashboard.
          </p>
          <div className="auth-hero-points">
            <div className="auth-hero-point">Usuário, workspace e trial no mesmo fluxo</div>
            <div className="auth-hero-point">Base preparada para assinatura depois</div>
            <div className="auth-hero-point">Entrada pensada para ativação rápida</div>
          </div>
        </article>

        <section className="auth-card auth-card-wide">
          {isLocalDataMode() ? (
            <div className="auth-hint">
              <strong>Modo local ativo</strong>
              <span>Defina `DATABASE_URL` para habilitar onboarding real com persistência no banco.</span>
            </div>
          ) : (
            <OnboardingForm selectedPlan={selectedPlan} nextUrl={nextUrl} />
          )}

          <div className="hero-actions">
            <Link href="/login" className="secondary-link">
              Já tenho acesso
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
