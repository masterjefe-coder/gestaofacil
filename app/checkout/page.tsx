import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";
import { pricingPlans } from "@/lib/site-data";
import { isSubscriptionPlanCode } from "@/lib/workspace-subscription-repository";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Checkout",
  description: "Comece um workspace com trial de 14 dias e siga para a ativação da assinatura no Gestão Fácil.",
  path: "/checkout",
});

type CheckoutPageProps = {
  searchParams?: Promise<{
    plan?: string;
  }>;
};

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const selectedPlan = params?.plan && isSubscriptionPlanCode(params.plan) ? params.plan : "PROFESSIONAL";
  const plan = pricingPlans.find((item) => item.code === selectedPlan) || pricingPlans[1];
  const nextUrl = "/dashboard/setup?subscriptionIntent=1";

  if (session) {
    redirect(nextUrl);
  }

  return (
    <main className="auth-shell">
      <div className="page-shell auth-page-shell">
        <MarketingTopbar ctaHref={`/checkout?plan=${plan.code}`} ctaLabel="Plano selecionado" />
      </div>
      <section className="auth-card">
        <span className="eyebrow">Assinatura do workspace</span>
        <h1>Começar no plano {plan.name}.</h1>
        <p>
          O workspace começa com 14 dias grátis, sem cartão, e depois pode ativar a assinatura recorrente no Asaas.
        </p>

        <div className="pricing-price-block">
          <strong>{plan.price}</strong>
          <small>{plan.annualPrice}</small>
          <span>{plan.audience}</span>
        </div>

        <div className="auth-hint">
          <strong>O que acontece depois</strong>
          <span>
            Você cria o workspace, entra no sistema e cai direto na etapa de assinatura para concluir o vínculo com o Asaas quando quiser.
          </span>
        </div>

        <div className="hero-actions">
          <Link href={`/onboarding?plan=${plan.code}&next=${encodeURIComponent(nextUrl)}`} className="primary-link">
            Criar conta e iniciar trial
          </Link>
          <Link href={`/login?callbackUrl=${encodeURIComponent(nextUrl)}`} className="secondary-link">
            Já tenho conta
          </Link>
        </div>
      </section>
      <div className="page-shell auth-page-shell">
        <MarketingFooter />
      </div>
    </main>
  );
}
