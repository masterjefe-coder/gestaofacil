import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";
import { pricingFaqs, pricingNotes, pricingPlans, pricingPositioning } from "@/lib/site-data";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Planos",
  description: "Planos do Gestão Fácil com trial de 14 dias, preço fixo e foco em empresas de serviço.",
  path: "/planos",
});

export default function PricingPage() {
  return (
    <main className="page-shell">
      <MarketingTopbar ctaHref="/checkout?plan=PROFESSIONAL" ctaLabel="Iniciar trial" />

      <section className="section-grid brand-strip">
        <div>
          <span className="section-label">Planos do Gestão Fácil</span>
          <h1>Preço fixo para vender, cobrar e emitir NFS-e com menos retrabalho.</h1>
          <p className="hero-text">
            O posicionamento ideal do Gestão Fácil é competir por clareza de fluxo e velocidade de operação,
            não por virar o software mais barato nem o sistema clínico mais pesado do mercado.
          </p>
          <div className="hero-actions">
            <Link href="/onboarding" className="primary-link">
              Começar 14 dias grátis
            </Link>
            <Link href="/" className="secondary-link">
              Voltar para o site
            </Link>
          </div>
        </div>
      </section>

      <section className="section-grid tinted">
        <div className="cards-grid pricing-grid">
          {pricingPlans.map((plan) => (
            <article key={plan.name} className="dashboard-card pricing-card">
              <div className="pricing-card-top">
                <span className="dashboard-kicker">{plan.badge}</span>
                <h2>{plan.name}</h2>
                <p>{plan.description}</p>
              </div>
              <div className="pricing-price-block">
                <strong>{plan.price}</strong>
                <small>{plan.annualPrice}</small>
                <span>{plan.audience}</span>
              </div>
              <div className="pricing-list-block">
                <strong>Estrutura</strong>
                <ul className="stack-list pricing-stack-list">
                  {plan.limits.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="pricing-list-block">
                <strong>Inclui</strong>
                <ul className="stack-list pricing-stack-list">
                  {plan.features.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <Link href={`/checkout?plan=${plan.code}`} className="primary-link">
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid">
        <div className="cards-grid">
          {pricingPositioning.map((item) => (
            <article key={item.title} className="info-card compact">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
        <ul className="stack-list pricing-note-list">
          {pricingNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="section-grid">
        <div>
          <span className="section-label">FAQ</span>
          <h2>Respostas para trial, público e valor.</h2>
        </div>
        <div className="cards-grid faq-grid">
          {pricingFaqs.map((item) => (
            <article key={item.question} className="info-card faq-card">
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
