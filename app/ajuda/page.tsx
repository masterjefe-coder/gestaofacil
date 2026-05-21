import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";
import { pricingFaqs } from "@/lib/site-data";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Ajuda",
  description: "Central de ajuda da Gestão Fácil para teste grátis, planos, setup financeiro e fluxo operacional.",
  path: "/ajuda",
});

const helpTopics = [
  "Começar o teste grátis e criar o primeiro workspace",
  "Escolher o plano ideal para o volume da operação",
  "Conectar conta ou subconta Asaas",
  "Entender o fluxo entre cobrança, pagamento e NFS-e",
];

export default function HelpPage() {
  return (
    <main className="page-shell">
      <MarketingTopbar />

      <section className="inner-hero">
        <div className="inner-hero-copy">
          <span className="section-label">Ajuda</span>
          <h1>Uma central para explicar, destravar e dar segurança já no primeiro uso.</h1>
          <p className="hero-text">
            A entrada ideal no Gestão Fácil precisa ser curta, clara e orientada
            para ação. Esta central existe para reduzir fricção desde o início.
          </p>
          <div className="hero-actions">
            <Link href="/checkout" className="primary-link">
              Escolher plano e iniciar teste
            </Link>
            <Link href="/contato" className="secondary-link">
              Pedir ajuda da equipe
            </Link>
          </div>
        </div>

        <div className="inner-hero-aside inner-hero-list">
          {helpTopics.map((item) => (
            <div key={item} className="inner-hero-note">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="home-section home-section-soft">
        <div className="home-section-heading">
          <span className="section-label">Tópicos principais</span>
          <h2>O foco é responder o que mais trava o teste grátis, a ativação e a rotina inicial.</h2>
        </div>
        <div className="home-card-grid">
          {helpTopics.map((item) => (
            <article key={item} className="home-feature-card">
              <h3>{item}</h3>
              <p>
                Esse tema faz parte da jornada pensada para teste grátis, assinatura,
                setup financeiro e operação do workspace.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <span className="section-label">FAQ</span>
          <h2>As respostas mais importantes do comercial e da ativação ficam aqui também.</h2>
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
