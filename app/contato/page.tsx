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

export default function ContactPage() {
  return (
    <main className="page-shell">
      <MarketingTopbar ctaLabel="Iniciar trial" />

      <section className="section-grid brand-strip">
        <div>
          <span className="section-label">Contato</span>
          <h1>Fale com a equipe certa para avançar mais rápido.</h1>
          <p className="hero-text">
            A melhor conversa comercial acontece quando o contexto já está claro: segmento, volume, rotina de cobrança e necessidade fiscal.
          </p>
        </div>
      </section>

      <section className="cards-grid">
        {contactCards.map((card) => (
          <article key={card.title} className="info-card">
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <Link href={card.action} className="secondary-link">
              {card.label}
            </Link>
          </article>
        ))}
      </section>

      <section className="section-split">
        <article className="split-panel success">
          <span className="section-label">Antes de chamar</span>
          <h2>Quanto mais contexto você trouxer, melhor fica o direcionamento.</h2>
          <ul className="stack-list">
            <li>Segmento ou nicho principal</li>
            <li>Quantidade de usuários</li>
            <li>Volume mensal de cobranças e NFS-e</li>
            <li>Se já usa Asaas e WhatsApp integrado</li>
          </ul>
        </article>
        <article className="split-panel">
          <span className="section-label">Entrada mais rápida</span>
          <h2>Se quiser sentir o produto antes, comece pelo trial.</h2>
          <p>O caminho mais simples é entrar em um trial de 14 dias e depois conversar com mais contexto real de operação.</p>
          <div className="hero-actions">
            <Link href="/checkout?plan=PROFESSIONAL" className="primary-link">
              Iniciar trial
            </Link>
          </div>
        </article>
      </section>

      <MarketingFooter />
    </main>
  );
}
