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

const enterprisePlan = {
  name: "Enterprise",
  badge: "Sob consulta",
  description: "Para operações com desenho comercial, fiscal ou multiunidade fora do padrão dos planos públicos.",
  audience: "Estruturas maiores, cenários especiais e implantação consultiva",
  features: [
    "Escopo comercial e operacional sob desenho",
    "Acompanhamento consultivo de implantação",
    "Condições negociadas conforme operação",
  ],
};

export const metadata = buildMarketingMetadata({
  title: "Gestão Fácil Sistemas",
  description:
    "Venda pelo WhatsApp, cobre por Pix e emita NFS-e no mesmo fluxo com um sistema feito para empresas de serviço.",
  path: "/",
});

const heroSignals = [
  { label: "Ativação", value: "14 dias grátis", helper: "Sem cartão e sem fricção comercial" },
  { label: "Cobrança", value: "Pix + link", helper: "Recebimento encaixado no fluxo da venda" },
  { label: "Fiscal", value: "NFS-e integrada", helper: "Nota pronta quando a operação pede" },
];

const executionPillars = [
  "WhatsApp, proposta e cobrança no mesmo contexto",
  "Leitura executiva para decidir rápido sem excesso de tela",
  "Marca mais séria, compacta e pronta para venda consultiva",
];

const showcaseCards = [
  {
    eyebrow: "Comercial",
    title: "Comercial mais organizado desde o primeiro contato",
    text: "Responder rápido, virar proposta e manter o follow-up vivo sem depender de memória ou planilha paralela.",
  },
  {
    eyebrow: "Financeiro",
    title: "Cobrança no centro do fluxo, não escondida em outro sistema",
    text: "Pedidos aprovados viram recebimento com status claro, menos atrito e mais previsibilidade para a equipe.",
  },
  {
    eyebrow: "Fiscal",
    title: "Fiscal conectado ao que foi vendido e recebido",
    text: "A emissão acompanha a operação real, reduz redigitação e deixa o fechamento mais fluido.",
  },
];

const conversionNotes = [
  "Teste grátis por 14 dias sem cartão",
  "Mensalidade fixa sem cobrar por faturamento",
  "Implantação pensada para operação de serviço",
];

const conversionAssurances = [
  "Sem cartão no trial",
  "Preço fixo por plano",
  "Troca de plano sem trauma",
];

const buyingSignals = [
  {
    title: "Para quem quer organizar rápido",
    text: "Entra leve, sem travar a equipe com setup pesado, visual duro ou linguagem de ERP.",
  },
  {
    title: "Para quem já vende e quer previsibilidade",
    text: "O fluxo comercial, financeiro e fiscal fica mais consistente sem multiplicar planilhas, abas e sistemas.",
  },
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

      <MarketingTopbar ctaHref="/planos" ctaLabel="Ver planos e teste grátis" />

      <section className="home-hero home-hero-refined fade-in-up">
        <div className="home-hero-copy fade-in-up fade-delay-1">
          <span className="eyebrow">Sistema premium para empresas de serviço</span>
          <BrandLogo className="hero-wordmark" priority />
          <h1 className="home-hero-title">
            Venda pelo WhatsApp, cobre no prazo e emita NFS-e no mesmo fluxo.
          </h1>
          <p className="home-hero-text">
            O Gestão Fácil foi feito para empresas de serviço que precisam responder rápido, transformar proposta em recebimento
            e deixar a nota pronta sem retrabalho nem excesso de sistema.
          </p>

          <div className="hero-actions">
            <Link href="/checkout?plan=PROFESSIONAL" className="primary-link">
              Iniciar teste grátis
            </Link>
            <Link href="/#produto" className="secondary-link">
              Ver como funciona
            </Link>
          </div>

          <div className="live-activity-ribbon">
            <span className="live-dot" />
            <strong>Fluxo ativo</strong>
            <small>Comercial, cobrança e fiscal no mesmo ritmo</small>
          </div>

          <div className="home-hero-notes home-hero-notes-strong" aria-label="Sinais principais do produto">
            {trustSignals.slice(0, 3).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>

          <div className="home-proof-inline">
            {proofNumbers.map((item) => (
              <article key={item.label} className="home-proof-chip">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="home-hero-panel home-hero-panel-refined fade-in-up fade-delay-2">
          <div className="home-hero-card home-command-card">
            <div className="home-panel-header">
              <BrandLogo variant="mark" className="home-panel-mark" />
              <div>
                <strong>Painel executivo</strong>
                <p>Menos ruído visual e mais direção para vender, cobrar e emitir.</p>
              </div>
            </div>

            <div className="home-signal-grid">
              {heroSignals.map((signal) => (
                <article key={signal.label} className="home-signal-card">
                  <span>{signal.label}</span>
                  <strong>{signal.value}</strong>
                  <small>{signal.helper}</small>
                </article>
              ))}
            </div>

            <div className="home-spotlight-card">
              <span className="section-label">Fluxo central</span>
              <h2>Uma operação pensada para reduzir atraso, retrabalho e perda de contexto.</h2>
              <ul className="stack-list home-execution-list">
                {executionPillars.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-showcase-grid">
        {showcaseCards.map((item) => (
          <article key={item.title} className="home-showcase-card fade-in-up">
            <span className="section-label">{item.eyebrow}</span>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
          </article>
        ))}
      </section>

      <section className="home-section home-conversion-strip fade-in-up">
        <div className="home-section-heading">
          <span className="section-label">Decisão mais fácil</span>
          <h2>Menos objeção, mais motivo concreto para começar o teste.</h2>
        </div>
        <div className="home-conversion-grid">
          {buyingSignals.map((item) => (
            <article key={item.title} className="home-conversion-card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
          <article className="home-conversion-card home-conversion-card-strong">
            <span className="section-label">Sem fricção</span>
            <ul className="stack-list home-conversion-list">
              {conversionNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="home-hero-notes home-hero-notes-strong" aria-label="Garantias comerciais">
              {conversionAssurances.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section id="produto" className="home-section home-product-overview">
        <div className="home-section-heading">
          <span className="section-label">Posicionamento</span>
          <h2>Uma solução de operação séria, não uma vitrine de funcionalidades.</h2>
          <p>
            A leitura fica mais rápida, os diferenciais ficam mais claros e o valor aparece sem excesso de explicação.
          </p>
        </div>

        <div className="home-overview-grid">
          <div className="home-card-grid">
            {commercialHighlights.map((item) => (
              <article key={item.title} className="home-feature-card home-feature-card-refined">
                <span className="card-index">{item.index}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>

          <div className="home-pillars-grid home-pillars-grid-refined">
            {brandPillars.map((item) => (
              <article key={item.title} className="home-pillar-card">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="segmentos" className="home-section home-segment-band">
        <div className="home-section-heading">
          <span className="section-label">Segmentos ideais</span>
          <h2>Feito para negócios de serviço que querem crescer com mais controle.</h2>
        </div>
        <div className="chips-wrap chips-wrap-refined">
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
          <h2>Planos pensados para o estágio da operação, não para empurrar feature sem contexto.</h2>
          <p>
            Comece leve, avance quando o volume pedir e mantenha previsibilidade com preço fixo por plano.
          </p>
        </div>

        <div className="home-pricing-grid home-pricing-grid-refined">
          {pricingPlans.map((plan) => (
            <article
              key={plan.code}
              className={plan.code === "PROFESSIONAL" ? "home-pricing-card home-pricing-card-featured" : "home-pricing-card"}
            >
              <div className="home-pricing-top">
                <span className="dashboard-kicker">{plan.badge}</span>
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
              </div>
              <strong className="home-price">{plan.price}</strong>
              <span className="home-price-note">{plan.annualPrice}</span>
              <div className="home-plan-audience">
                <strong>{plan.code === "PROFESSIONAL" ? "Mais escolhido" : "Melhor para"}</strong>
                <span>{plan.audience}</span>
              </div>
              <ul className="stack-list home-plan-list">
                {plan.features.slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="home-plan-limits">
                {plan.limits.slice(0, 2).map((item) => (
                  <span key={item}>{item}</span>
                ))}
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
            <span className="home-price-note">Escopo e implantação alinhados ao cenário da operação</span>
            <div className="home-plan-audience">
              <strong>Melhor para</strong>
              <span>{enterprisePlan.audience}</span>
            </div>
            <ul className="stack-list home-plan-list">
              {enterprisePlan.features.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link href="/contato" className="secondary-link">
              Falar com a equipe
            </Link>
          </article>
        </div>
      </section>

      <section className="home-section home-closing-cta fade-in-up">
        <div className="home-closing-copy">
          <span className="section-label">Pronto para testar</span>
          <h2>Se a operação já está rodando, o próximo ganho é organizar melhor o mesmo volume.</h2>
          <p>
            O plano Profissional concentra o melhor equilíbrio para equipes pequenas que já vendem,
            cobram e emitem com frequência e querem mais previsibilidade sem virar ERP pesado.
          </p>
        </div>
        <div className="home-closing-actions">
          <Link href="/checkout?plan=PROFESSIONAL" className="primary-link">
            Iniciar teste no Profissional
          </Link>
          <Link href="/contato" className="secondary-link">
            Falar com a equipe
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
