import Link from "next/link";
import Script from "next/script";
import { BrandLogo } from "@/components/brand-logo";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";
import {
  brandPillars,
  commercialHighlights,
  dashboardCards,
  growthLoops,
  idealFor,
  launchPlan,
  painPoints,
  pricingFaqs,
  pricingNotes,
  pricingPlans,
  pricingPositioning,
  proofNumbers,
  trustSignals,
} from "@/lib/site-data";

export const metadata = buildMarketingMetadata({
  title: "Gestão Fácil Sistemas",
  description:
    "Venda pelo WhatsApp, cobre por Pix e emita NFS-e no mesmo fluxo com um sistema feito para empresas de serviço.",
  path: "/",
});

export default function HomePage() {
  const heroSignals = [
    "WhatsApp no fluxo comercial",
    "Cobrança por Pix e link",
    "NFS-e no momento certo",
  ];

  const heroHighlights = [
    {
      label: "Entrada do dia",
      value: "14 novos contatos",
      helper: "Oportunidades puxadas direto do atendimento.",
    },
    {
      label: "Próxima cobrança",
      value: "Pix às 16h",
      helper: "Financeiro já sabe quem precisa de follow-up.",
    },
    {
      label: "Fiscal preparado",
      value: "3 notas prontas",
      helper: "Recebimentos pagos já entram no trilho fiscal.",
    },
  ];

  const trustRail = [
    "14 dias grátis sem cartão",
    "Assinatura mensal fixa",
    "Conta Asaas por workspace",
    "NFS-e no mesmo fluxo da venda",
  ];

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

      <MarketingTopbar ctaHref="/checkout?plan=PROFESSIONAL" ctaLabel="Iniciar trial" />

      <section className="hero">
        <div className="hero-copy">
          <BrandLogo className="hero-wordmark" priority />
          <span className="eyebrow">CRM e operação para serviços</span>
          <h1>Venda, receba e emita em um fluxo só.</h1>
          <p className="hero-text">
            O Gestão Fácil foi desenhado para empresas de serviço que já vendem pelo WhatsApp,
            precisam receber com mais consistência e não querem perder o timing da cobrança e da nota.
          </p>
          <div className="hero-signal-list" aria-label="Principais sinais do produto">
            {heroSignals.map((item) => (
              <span key={item} className="segment-chip hero-signal-chip">
                {item}
              </span>
            ))}
          </div>
          <div className="hero-actions">
            <Link href="/checkout?plan=PROFESSIONAL" className="primary-link">
              Iniciar 14 dias grátis
            </Link>
            <a href="#como-funciona" className="secondary-link">
              Ver como funciona
            </a>
          </div>
          <p className="hero-caption">
            Sem implantação longa, sem cara de ERP pesado e com foco no dia real da operação.
          </p>
          <ul className="proof-strip">
            {proofNumbers.map((item) => (
              <li key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="hero-panel">
          <div className="panel-glow" />
          <div className="panel-card">
            <div className="panel-brand">
              <BrandLogo variant="mark" className="panel-brand-mark" />
              <div>
                <strong>Gestão Fácil Sistemas</strong>
                <small>Comercial, cobrança e fiscal no mesmo ritmo de operação.</small>
              </div>
            </div>
            <div className="panel-kicker">Resumo operacional</div>
            <p className="panel-copy">
              O painel foi pensado para o dono ou operador bater o olho e saber o que vender, cobrar e emitir sem trocar de contexto.
            </p>
            <div className="hero-stat-grid">
              {heroHighlights.map((item) => (
                <article key={item.label} className="hero-stat-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.helper}</small>
                </article>
              ))}
            </div>
            <div className="panel-kicker">Fluxo principal</div>
            <ol className="flow-list">
              <li>Conversa vira oportunidade</li>
              <li>Oportunidade vira orçamento</li>
              <li>Orçamento vira pedido</li>
              <li>Pedido gera cobrança</li>
              <li>Pagamento prepara a nota</li>
            </ol>
            <div className="panel-footer">
              <span>Decisão rápida para quem opera</span>
              <span>Arquitetura pronta para crescer</span>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-rail">
        {trustRail.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </section>

      <section id="como-funciona" className="section-grid">
        <div>
          <span className="section-label">Como funciona</span>
          <h2>O produto entra onde a empresa mais sofre: vender, cobrar e não perder o tempo da emissão.</h2>
        </div>
        <div className="cards-grid">
          {commercialHighlights.map((item) => (
            <article key={item.title} className="info-card">
              <span className="card-index">{item.index}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="produto" className="section-grid brand-strip">
        <div>
          <span className="section-label">Por que isso segura recorrência</span>
          <h2>Quando o comercial, o financeiro e o fiscal se conversam, o produto deixa de ser acessório.</h2>
        </div>
        <div className="cards-grid">
          {brandPillars.map((item) => (
            <article key={item.title} className="info-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-split">
        <div className="split-panel danger">
          <span className="section-label">O que quebrava antes</span>
          <h2>O problema não era vender software. Era vender suporte disfarçado de sistema.</h2>
          <ul className="stack-list">
            {painPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>

        <div className="split-panel success">
          <span className="section-label">Nova tese</span>
          <h2>Gestão Fácil vira um sistema comercial com NFS-e no fluxo, não um emissor puro.</h2>
          <ul className="stack-list">
            {growthLoops.map((loop) => (
              <li key={loop}>{loop}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="segmentos" className="section-grid">
        <div>
          <span className="section-label">Para quem ele encaixa melhor</span>
          <h2>Segmentos em que rapidez, cobrança e simplicidade pesam mais do que um ERP completo.</h2>
        </div>
        <div className="chips-wrap">
          {idealFor.map((item) => (
            <span key={item} className="segment-chip">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="section-split">
        <article className="split-panel success">
          <span className="section-label">Pronto para operação</span>
          <h2>O produto já entra com clientes, orçamentos, pedidos, cobrança, relatórios e base de assinatura.</h2>
          <ul className="stack-list">
            <li>Comercial e financeiro no mesmo painel</li>
            <li>Trial de 14 dias com plano por workspace</li>
            <li>Asaas para cobrança operacional e recorrência SaaS</li>
            <li>Setup preparado para conta própria e subconta</li>
          </ul>
        </article>

        <article className="split-panel">
          <span className="section-label">Credibilidade institucional</span>
          <h2>Empresa, páginas essenciais e navegação pública completas para passar confiança desde o primeiro clique.</h2>
          <ul className="stack-list">
            <li><Link href="/sobre">Conheça a proposta da empresa</Link></li>
            <li><Link href="/integracoes">Veja as integrações do produto</Link></li>
            <li><Link href="/ajuda">Leia dúvidas e próximos passos</Link></li>
            <li><Link href="/privacidade">Consulte privacidade e termos</Link></li>
          </ul>
        </article>
      </section>

      <section id="planos" className="section-grid tinted">
        <div>
          <span className="section-label">Planos</span>
          <h2>Preço fixo, teste grátis de 14 dias e foco em empresas de serviço que precisam operar melhor.</h2>
          <p>
            A ideia não é disputar com ERP genérico barato nem com software clínico pesado.
            O encaixe do Gestão Fácil é ficar no meio certo: forte no fluxo, simples na adoção e competitivo no ticket.
          </p>
        </div>
        <div className="cards-grid pricing-grid">
          {pricingPlans.map((plan) => (
            <article key={plan.name} className="dashboard-card pricing-card">
              <div className="pricing-card-top">
                <span className="dashboard-kicker">{plan.badge}</span>
                <h3>{plan.name}</h3>
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
              <div className="hero-actions pricing-actions">
                <Link href={`/checkout?plan=${plan.code}`} className="primary-link">
                  {plan.cta}
                </Link>
              </div>
            </article>
          ))}
        </div>
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

      <section className="section-grid tinted">
        <div>
          <span className="section-label">Primeiras entregas</span>
          <h2>O MVP precisa ser enxuto, cobrável e claramente melhor do que o improviso atual.</h2>
        </div>
        <div className="cards-grid">
          {launchPlan.map((item) => (
            <article key={item.title} className="info-card compact">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="direcao" className="cta-band">
        <div>
          <span className="section-label">Direção de construção</span>
          <h2>Primeiro vender e receber melhor. Depois expandir automações, recorrência e fiscal.</h2>
        </div>
        <Link href="/dashboard" className="primary-link">
          Ver painel operacional
        </Link>
      </section>

      <section className="section-grid dashboard-preview">
        <div>
          <span className="section-label">Preview do produto</span>
          <h2>O dashboard precisa mostrar o que importa no mesmo minuto em que o dono entra.</h2>
        </div>
        <div className="cards-grid">
          {dashboardCards.map((card) => (
            <article key={card.title} className="dashboard-card">
              <span className="dashboard-kicker">{card.kicker}</span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid">
        <div>
          <span className="section-label">Perguntas comuns</span>
          <h2>O comercial precisa responder trial, valor e encaixe de público com segurança desde o primeiro contato.</h2>
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

      <section className="section-split">
        <article className="split-panel success">
          <span className="section-label">Sinais de confiança</span>
          <h2>O site já precisa comunicar a proposta completa com clareza.</h2>
          <ul className="stack-list">
            {trustSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        </article>

        <article className="split-panel brand-footer-panel">
          <BrandLogo className="footer-wordmark" />
          <p>
            Gestão Fácil Sistemas foi desenhado para transformar venda, cobrança e emissão
            em um fluxo único, elegante e usável no dia real da empresa.
          </p>
          <div className="hero-actions">
            <Link href="/onboarding" className="primary-link">
              Começar agora
            </Link>
            <Link href="/login" className="secondary-link">
              Entrar na plataforma
            </Link>
          </div>
        </article>
      </section>

      <MarketingFooter />
    </main>
  );
}
