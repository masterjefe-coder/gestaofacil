import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import {
  brandPillars,
  commercialHighlights,
  dashboardCards,
  growthLoops,
  idealFor,
  launchPlan,
  painPoints,
  proofNumbers,
  trustSignals,
} from "@/lib/site-data";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="site-topbar">
        <BrandLogo className="topbar-wordmark" priority />
        <div className="topbar-actions">
          <a href="#produto" className="topbar-link">
            Produto
          </a>
          <a href="#direcao" className="topbar-link">
            Direção
          </a>
          <Link href="/login" className="secondary-link">
            Entrar
          </Link>
        </div>
      </section>

      <section className="hero">
        <div className="hero-copy">
          <BrandLogo className="hero-wordmark" priority />
          <span className="eyebrow">Gestão comercial para serviços</span>
          <h1>Venda pelo WhatsApp, cobre por Pix e emita nota sem retrabalho.</h1>
          <p className="hero-text">
            O Gestão Fácil nasce para pequenos negócios de serviço que precisam fechar vendas
            mais rápido, receber melhor e parar de perder tempo com fluxo quebrado.
          </p>
          <div className="hero-actions">
            <Link href="/login" className="primary-link">
              Entrar no workspace
            </Link>
            <a href="#produto" className="secondary-link">
              Explorar proposta
            </a>
          </div>
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
                <small>Operação comercial enxuta, visual forte e foco em serviços.</small>
              </div>
            </div>
            <div className="panel-kicker">Fluxo vencedor</div>
            <ol className="flow-list">
              <li>Conversa vira oportunidade</li>
              <li>Oportunidade vira orçamento</li>
              <li>Orçamento vira pedido</li>
              <li>Pedido gera cobrança</li>
              <li>Pagamento prepara a nota</li>
            </ol>
            <div className="panel-footer">
              <span>Foco no pequeno negócio real</span>
              <span>Sem cara de ERP pesado</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-grid brand-strip">
        <div>
          <span className="section-label">Identidade do produto</span>
          <h2>A marca precisa parecer tecnologia confiável, não software genérico.</h2>
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

      <section id="produto" className="section-grid">
        <div>
          <span className="section-label">Por que isso vende</span>
          <h2>O produto entra pela dor comercial e segura a recorrência com operação.</h2>
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

      <section className="section-grid">
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
          Abrir dashboard conceitual
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
              Criar primeiro workspace
            </Link>
            <Link href="/login" className="secondary-link">
              Acessar plataforma
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
