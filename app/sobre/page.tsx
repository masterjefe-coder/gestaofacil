import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Sobre",
  description: "Conheça a proposta da Gestão Fácil Sistemas e o foco em operação comercial para serviços.",
  path: "/sobre",
});

const principles = [
  "Fluxo vence módulo isolado.",
  "Pequenas empresas de serviço precisam de clareza, não de ERP pesado.",
  "Cobrança e NFS-e devem acontecer no mesmo ritmo da operação.",
];

const beliefs = [
  "O sistema precisa acompanhar o dia real da empresa.",
  "Interface boa reduz suporte e aumenta confiança.",
  "O produto tem que parecer sério desde a primeira visita.",
];

export default function AboutPage() {
  return (
    <main className="page-shell">
      <MarketingTopbar />

      <section className="inner-hero">
        <div className="inner-hero-copy">
          <span className="section-label">Sobre a empresa</span>
          <h1>Gestão Fácil existe para transformar operação comercial em rotina confiável.</h1>
          <p className="hero-text">
            A proposta não é empilhar módulos. É tirar fricção entre atendimento,
            orçamento, cobrança e NFS-e para empresas de serviço que precisam
            girar rápido sem depender de improviso.
          </p>
          <div className="hero-actions">
            <Link href="/checkout?plan=PROFESSIONAL" className="primary-link">
              Começar 14 dias grátis
            </Link>
            <Link href="/contato" className="secondary-link">
              Falar com a equipe
            </Link>
          </div>
        </div>

        <div className="inner-hero-aside inner-hero-list">
          {beliefs.map((item) => (
            <div key={item} className="inner-hero-note">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="home-section home-section-soft">
        <div className="home-section-heading">
          <span className="section-label">Princípios</span>
          <h2>Três ideias que organizam produto, interface e posicionamento.</h2>
        </div>
        <div className="home-card-grid">
          {principles.map((item) => (
            <article key={item} className="home-feature-card">
              <h3>{item}</h3>
              <p>
                Esse princípio orienta a construção do sistema para o software
                não perder foco conforme ganha profundidade comercial e fiscal.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-section-split">
        <div className="home-pillars-grid">
          <article className="home-pillar-card">
            <span className="section-label">O que defendemos</span>
            <h3>Menos atrito operacional, mais previsibilidade comercial.</h3>
            <p>
              O cliente precisa saber o que vender, o que cobrar e o que emitir
              sem trocar de contexto o dia inteiro.
            </p>
          </article>
          <article className="home-pillar-card">
            <span className="section-label">O que evitamos</span>
            <h3>Produto genérico, ticket fraco e interface burocrática.</h3>
            <p>
              A marca foi pensada para parecer tecnologia séria, moderna e
              confiável desde o primeiro acesso.
            </p>
          </article>
          <article className="home-pillar-card">
            <span className="section-label">Direção</span>
            <h3>Entrar pela venda e crescer pela operação.</h3>
            <p>
              O sistema ganha espaço quando passa a sustentar rotina, não quando
              tenta prometer tudo ao mesmo tempo.
            </p>
          </article>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
