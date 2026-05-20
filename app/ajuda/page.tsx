import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";
import { pricingFaqs } from "@/lib/site-data";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Ajuda",
  description: "Central de ajuda da Gestão Fácil para trial, planos, setup financeiro e fluxo operacional.",
  path: "/ajuda",
});

const helpTopics = [
  "Começar o trial e criar o primeiro workspace",
  "Escolher o plano ideal para o volume da operação",
  "Conectar conta ou subconta Asaas",
  "Entender o fluxo entre cobrança, pagamento e NFS-e",
];

export default function HelpPage() {
  return (
    <main className="page-shell">
      <MarketingTopbar />

      <section className="section-grid brand-strip">
        <div>
          <span className="section-label">Ajuda</span>
          <h1>Páginas essenciais para explicar, destravar e dar confiança ao primeiro uso.</h1>
          <p className="hero-text">
            A entrada ideal no Gestão Fácil precisa ser curta, clara e orientada para ação. Esta central existe para reduzir fricção já no início.
          </p>
        </div>
      </section>

      <section className="cards-grid">
        {helpTopics.map((item) => (
          <article key={item} className="info-card compact">
            <h3>{item}</h3>
            <p>Esse tema já faz parte da jornada pensada para trial, assinatura, setup financeiro e operação do workspace.</p>
          </article>
        ))}
      </section>

      <section className="section-grid">
        <div>
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
