import type { Metadata } from "next";
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

export default function AboutPage() {
  return (
    <main className="page-shell">
      <MarketingTopbar />

      <section className="section-grid brand-strip">
        <div>
          <span className="section-label">Sobre a empresa</span>
          <h1>Gestão Fácil Sistemas existe para transformar operação comercial em rotina confiável.</h1>
          <p className="hero-text">
            A proposta não é empilhar módulos. É tirar fricção entre atendimento, orçamento, cobrança e NFS-e para empresas de serviço que precisam girar rápido.
          </p>
        </div>
      </section>

      <section className="cards-grid">
        {principles.map((item) => (
          <article key={item} className="info-card">
            <h3>{item}</h3>
            <p>Esse princípio orienta produto, interface e comercial para o software não perder foco ao crescer.</p>
          </article>
        ))}
      </section>

      <section className="section-split">
        <article className="split-panel success">
          <span className="section-label">O que defendemos</span>
          <h2>Menos atrito operacional, mais previsibilidade comercial.</h2>
          <p>O cliente precisa saber o que vender, o que cobrar e o que emitir sem trocar de contexto o dia inteiro.</p>
        </article>
        <article className="split-panel">
          <span className="section-label">O que evitamos</span>
          <h2>Produto genérico demais, ticket fraco e interface burocrática.</h2>
          <p>A marca foi pensada para parecer tecnologia séria, moderna e confiável desde o primeiro acesso.</p>
        </article>
      </section>

      <MarketingFooter />
    </main>
  );
}
