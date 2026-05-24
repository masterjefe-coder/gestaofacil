import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";
import { pricingFaqs, pricingNotes, pricingPlans, pricingPositioning } from "@/lib/site-data";

const enterprisePlan = {
  name: "Enterprise",
  badge: "Sob consulta",
  description: "Para operações que precisam de desenho comercial, fiscal ou multiunidade fora do padrão dos planos públicos.",
  audience: "Estruturas maiores, cenários especiais e implantação consultiva",
  features: [
    "Escopo ajustado à operação",
    "Implantação consultiva",
    "Condições comerciais negociadas",
  ],
};

export const metadata: Metadata = buildMarketingMetadata({
  title: "Planos",
  description: "Planos do Gestão Fácil com teste grátis de 14 dias, preço fixo e foco em empresas de serviço.",
  path: "/planos",
});

const pricingSignals = [
  "14 dias grátis sem cartão",
  "Preço fixo por plano",
  "Sem percentual sobre faturamento",
];

export default function PricingPage() {
  return (
    <main className="page-shell">
      <MarketingTopbar ctaHref="/checkout" ctaLabel="Escolher plano e iniciar teste" />

      <section className="inner-hero">
        <div className="inner-hero-copy">
          <span className="section-label">Planos do Gestão Fácil</span>
          <h1>Preço claro para vender, cobrar e emitir sem empilhar ferramenta.</h1>
          <p className="hero-text">
            O posicionamento aqui é simples: menos ERP genérico, mais rotina resolvida.
            Escolha o plano pelo estágio da operação e mantenha previsibilidade com preço fixo.
          </p>
          <div className="hero-actions">
            <Link href="/checkout" className="primary-link">
              Escolher plano e iniciar teste
            </Link>
            <Link href="/contato" className="secondary-link">
              Falar com a equipe
            </Link>
          </div>
        </div>

        <div className="inner-hero-aside">
          {pricingSignals.map((item) => (
            <span key={item} className="segment-chip">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="home-section home-pricing-section">
        <div className="home-section-heading">
          <span className="section-label">Escolha de plano</span>
          <h2>Comece no plano que combina com o volume atual e suba quando a operação pedir.</h2>
        </div>
        <div className="home-pricing-grid">
          {pricingPlans.map((plan) => (
            <article key={plan.name} className={plan.code === "PROFESSIONAL" ? "home-pricing-card home-pricing-card-featured" : "home-pricing-card"}>
              <div className="home-pricing-top">
                <span className="dashboard-kicker">{plan.badge}</span>
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
              </div>
              <strong className="home-price">{plan.price}</strong>
              <span className="home-price-note">{plan.annualPrice}</span>
              <p className="muted-text">{plan.audience}</p>
              {plan.code === "PROFESSIONAL" ? (
                <div className="auth-hint">
                  <strong>Plano recomendado</strong>
                  <span>Melhor equilíbrio para equipes pequenas com rotina comercial e financeira ativa.</span>
                </div>
              ) : null}
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
          <article className="home-pricing-card home-pricing-card-enterprise">
            <div className="home-pricing-top">
              <span className="dashboard-kicker">{enterprisePlan.badge}</span>
              <h3>{enterprisePlan.name}</h3>
              <p>{enterprisePlan.description}</p>
            </div>
            <strong className="home-price">Sob consulta</strong>
            <span className="home-price-note">Alinhamento comercial e técnico conforme o cenário</span>
            <p className="muted-text">{enterprisePlan.audience}</p>
            <div className="pricing-list-block">
              <strong>Inclui</strong>
              <ul className="stack-list pricing-stack-list">
                {enterprisePlan.features.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <Link href="/contato" className="secondary-link">
              Falar com a equipe
            </Link>
          </article>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <span className="section-label">Posicionamento</span>
          <h2>O plano certo organiza a rotina sem carregar custo, setup ou complexidade desnecessários.</h2>
        </div>
        <div className="home-card-grid">
          {pricingPositioning.map((item) => (
            <article key={item.title} className="home-feature-card">
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

      <section className="home-section">
        <div className="home-section-heading">
          <span className="section-label">FAQ</span>
          <h2>O que costuma pesar mais na decisão de entrada.</h2>
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
