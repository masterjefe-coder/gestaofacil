import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Integrações",
  description: "Integrações do Gestão Fácil com Asaas, Evolution API, NFS-e Nacional e exportações operacionais.",
  path: "/integracoes",
});

const integrations = [
  {
    title: "Asaas",
    description: "Cobrança operacional e assinatura SaaS com base pronta para subconta, recorrência e webhook.",
  },
  {
    title: "Evolution API",
    description: "WhatsApp server-side para automações, lembretes e leitura de retorno comercial e financeiro.",
  },
  {
    title: "NFS-e Nacional",
    description: "Emissão assistida ou automática quando o município e o setup do emitente permitem.",
  },
  {
    title: "Excel e PDF",
    description: "Exportação da operação sem retrabalho para leitura executiva, impressão e compartilhamento.",
  },
];

export default function IntegrationsPage() {
  return (
    <main className="page-shell">
      <MarketingTopbar />

      <section className="section-grid brand-strip">
        <div>
          <span className="section-label">Integrações</span>
          <h1>O produto cresce melhor quando integra no ponto certo do fluxo.</h1>
          <p className="hero-text">
            Em vez de uma galeria infinita de logos, o Gestão Fácil prioriza integrações que realmente afetam venda, cobrança e emissão no dia da operação.
          </p>
        </div>
      </section>

      <section className="cards-grid">
        {integrations.map((item) => (
          <article key={item.title} className="info-card">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </section>

      <section className="section-split">
        <article className="split-panel success">
          <span className="section-label">Integração certa</span>
          <h2>Não é sobre quantidade. É sobre impacto real.</h2>
          <p>Se uma integração não reduz digitação, melhora cobrança ou acelera emissão, ela não entra como prioridade do produto.</p>
        </article>
        <article className="split-panel">
          <span className="section-label">Próxima camada</span>
          <h2>Histórico analítico, assinatura SaaS e expansão de automações.</h2>
          <p>A base atual já prepara o terreno para recorrência, leitura de período e maior orquestração operacional.</p>
        </article>
      </section>

      <MarketingFooter />
    </main>
  );
}
