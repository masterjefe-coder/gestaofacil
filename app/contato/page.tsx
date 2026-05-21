import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Contato",
  description: "Fale com a equipe comercial, produto ou suporte inicial da Gestão Fácil Sistemas.",
  path: "/contato",
});

const contactCards = [
  {
    title: "Comercial",
    description: "Fale sobre planos, trial, segmentos e implantação inicial.",
    action: "mailto:contato@gestaofacilsistemas.com.br",
    label: "contato@gestaofacilsistemas.com.br",
  },
  {
    title: "Produto",
    description: "Converse sobre integrações, roadmap e encaixe operacional.",
    action: "mailto:produto@gestaofacilsistemas.com.br",
    label: "produto@gestaofacilsistemas.com.br",
  },
  {
    title: "Suporte inicial",
    description: "Tire dúvidas sobre onboarding, assinatura e configuração do workspace.",
    action: "/ajuda",
    label: "Abrir central de ajuda",
  },
];

const contextItems = [
  "Segmento ou nicho principal",
  "Quantidade de usuários",
  "Volume mensal de cobranças e NFS-e",
  "Se já usa Asaas e WhatsApp integrado",
];

export default function ContactPage() {
  return (
    <main className="page-shell">
      <MarketingTopbar ctaHref="/checkout" ctaLabel="Escolher plano e iniciar teste" />

      <section className="inner-hero">
        <div className="inner-hero-copy">
          <span className="section-label">Contato</span>
          <h1>Fale com a equipe certa para avançar sem perder tempo.</h1>
          <p className="hero-text">
            A melhor conversa acontece quando o contexto já está claro:
            segmento, volume, rotina de cobrança e necessidade fiscal.
          </p>
          <div className="hero-actions">
            <Link href="/checkout" className="primary-link">
              Escolher plano e iniciar teste
            </Link>
            <Link href="/ajuda" className="secondary-link">
              Ver ajuda
            </Link>
          </div>
        </div>

        <div className="inner-hero-aside inner-hero-list">
          {contextItems.map((item) => (
            <div key={item} className="inner-hero-note">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="home-section home-section-soft">
        <div className="home-section-heading">
          <span className="section-label">Canais</span>
          <h2>Cada entrada foi pensada para levar a conversa para o lugar certo.</h2>
        </div>
        <div className="home-card-grid">
          {contactCards.map((card) => (
            <article key={card.title} className="home-feature-card">
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <Link href={card.action} className="secondary-link">
                {card.label}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-closing-band">
        <div className="home-section-heading">
          <span className="section-label">Entrada mais rápida</span>
          <h2>Se quiser sentir o produto antes da conversa, comece pelo teste grátis.</h2>
          <p>
            Isso reduz abstração e deixa a conversa comercial muito mais
            concreta, com contexto real da sua operação.
          </p>
        </div>
        <div className="hero-actions marketing-footer-band-actions">
          <Link href="/checkout" className="primary-link">
            Escolher plano e iniciar teste
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
