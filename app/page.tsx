import Link from "next/link";
import Script from "next/script";
import { BrandLogo } from "@/components/brand-logo";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";
import {
  brandPillars,
  commercialHighlights,
  idealFor,
  pricingPlans,
  proofNumbers,
  trustSignals,
} from "@/lib/site-data";

export const metadata = buildMarketingMetadata({
  title: "Gestão Fácil Sistemas",
  description:
    "Venda pelo WhatsApp, cobre por Pix e emita NFS-e no mesmo fluxo com um sistema feito para empresas de serviço.",
  path: "/",
});

const journeySteps = [
  "Atendimento e oportunidade no mesmo lugar",
  "Orçamento, pedido e cobrança sem troca de contexto",
  "Pagamento confirmado virando gatilho para emissão",
];

const heroNotes = [
  "14 dias grátis sem cartão",
  "Cobrança por Pix e link",
  "NFS-e no ritmo da operação",
];

export default function HomePage() {
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Gestão Fácil Sistemas",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://www.gestaofacilsistemas.com.br",
    description:
      "Sistema comercial para empresas de serviço venderem, cobrarem e emitirem NFS-e sem retrabalho.",
    offers: pricingPlans.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      priceCurrency: "BRL",
      price: plan.price.replace(/[^\d,]/g, "").replace(",", "."),
      description: plan.description,
      url: `https://www.gestaofacilsistemas.com.br/checkout?plan=${plan.code}`,
    })),
  };

  return (
    <main className="page-shell">
      <Script
        id="gestao-facil-software-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />

      <MarketingTopbar ctaHref="/checkout?plan=PROFESSIONAL" ctaLabel="Começar 14 dias grátis" />

      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">Sistema para empresas de serviço</span>
          <BrandLogo className="hero-wordmark" priority />
          <h1 className="home-hero-title">Menos ruído na operação. Mais clareza para vender, cobrar e emitir.</h1>
          <p className="home-hero-text">
            O Gestão Fácil organiza o dia real da empresa em um fluxo simples:
            conversa, orçamento, pedido, cobrança e NFS-e sem improviso e sem
            cara de sistema pesado.
          </p>
          <div className="hero-actions">
            <Link href="/checkout?plan=PROFESSIONAL" className="primary-link">
              Começar 14 dias grátis
            </Link>
            <Link href="/planos" className="secondary-link">
              Ver planos
            </Link>
          </div>
          <div className="home-hero-notes" aria-label="Diferenciais principais">
            {heroNotes.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="home-hero-panel">
          <div className="home-hero-card">
            <div className="home-panel-header">
              <BrandLogo variant="mark" className="home-panel-mark" />
              <div>
                <strong>Visão operacional</strong>
                <p>O que precisa acontecer hoje, em um painel que dá para bater o olho.</p>
              </div>
            </div>
            <div className="home-panel-stack">
              {proofNumbers.slice(0, 3).map((item) => (
                <article key={item.label} className="home-metric-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
            <ol className="home-journey-list">
              {journeySteps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="home-section home-section-soft">
        <div className="home-section-heading">
          <span className="section-label">Fluxo central</span>
          <h2>O produto entra exatamente onde a operação costuma ficar quebrada.</h2>
          <p>
            Em vez de uma home tentando explicar tudo, a proposta aqui é direta:
            conectar comercial, cobrança e fiscal em uma rotina leve.
          </p>
        </div>
        <div className="home-card-grid">
          {commercialHighlights.slice(0, 3).map((item) => (
            <article key={item.title} className="home-feature-card">
              <span className="card-index">{item.index}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="produto" className="home-section home-section-split">
        <div className="home-section-heading">
          <span className="section-label">Por que ele é diferente</span>
          <h2>Não é só um emissor, nem um CRM solto. É um fluxo comercial com continuidade.</h2>
        </div>
        <div className="home-pillars-grid">
          {brandPillars.slice(0, 3).map((item) => (
            <article key={item.title} className="home-pillar-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="segmentos" className="home-section">
        <div className="home-section-heading">
          <span className="section-label">Melhor encaixe</span>
          <h2>Feito para operações de serviço que precisam de velocidade, cobrança e organização.</h2>
        </div>
        <div className="chips-wrap">
          {idealFor.map((item) => (
            <span key={item} className="segment-chip">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section id="planos" className="home-section home-pricing-section">
        <div className="home-section-heading">
          <span className="section-label">Planos</span>
          <h2>Preço fixo, teste grátis simples e uma proposta mais clara desde a primeira visita.</h2>
        </div>
        <div className="home-pricing-grid">
          {pricingPlans.map((plan) => (
            <article key={plan.code} className="home-pricing-card">
              <div className="home-pricing-top">
                <span className="dashboard-kicker">{plan.badge}</span>
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
              </div>
              <strong className="home-price">{plan.price}</strong>
              <span className="home-price-note">{plan.annualPrice}</span>
              <ul className="stack-list home-plan-list">
                {plan.features.slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link href={`/checkout?plan=${plan.code}`} className="primary-link">
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-closing-band">
        <div className="home-section-heading">
          <span className="section-label">Confiança</span>
          <h2>Uma home mais limpa para sustentar uma marca mais séria.</h2>
          <p>
            O objetivo é deixar claro em poucos segundos o que o produto resolve
            e para quem ele faz sentido.
          </p>
        </div>
        <ul className="stack-list home-trust-list">
          {trustSignals.slice(0, 4).map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      </section>

      <MarketingFooter />
    </main>
  );
}
