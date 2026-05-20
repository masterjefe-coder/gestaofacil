import type { Metadata } from "next";
import Link from "next/link";
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

const integrationSignals = [
  "Integrações focadas no fluxo real",
  "Menos vitrine, mais impacto operacional",
  "Base pronta para automações futuras",
];

export default function IntegrationsPage() {
  return (
    <main className="page-shell">
      <MarketingTopbar />

      <section className="inner-hero">
        <div className="inner-hero-copy">
          <span className="section-label">Integrações</span>
          <h1>O produto cresce melhor quando integra no ponto certo do fluxo.</h1>
          <p className="hero-text">
            Em vez de uma galeria infinita de logos, o Gestão Fácil prioriza
            integrações que realmente afetam venda, cobrança e emissão no dia a
            dia da operação.
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
          {integrationSignals.map((item) => (
            <div key={item} className="inner-hero-note">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="home-section home-section-soft">
        <div className="home-section-heading">
          <span className="section-label">Ecossistema atual</span>
          <h2>As conexões foram escolhidas para reduzir digitação e encurtar etapas.</h2>
        </div>
        <div className="home-card-grid integration-grid">
          {integrations.map((item) => (
            <article key={item.title} className="home-feature-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-section-split">
        <div className="home-pillars-grid">
          <article className="home-pillar-card">
            <span className="section-label">Integração certa</span>
            <h3>Não é sobre quantidade. É sobre impacto real.</h3>
            <p>
              Se uma integração não reduz digitação, melhora cobrança ou acelera
              emissão, ela não entra como prioridade do produto.
            </p>
          </article>
          <article className="home-pillar-card">
            <span className="section-label">Próxima camada</span>
            <h3>Histórico analítico, assinatura SaaS e expansão de automações.</h3>
            <p>
              A base atual já prepara o terreno para recorrência, leitura de
              período e maior orquestração operacional.
            </p>
          </article>
          <article className="home-pillar-card">
            <span className="section-label">Critério</span>
            <h3>Cada integração precisa fortalecer o fluxo, não distrair dele.</h3>
            <p>
              A construção continua orientada por utilidade prática para pequenas
              empresas de serviço.
            </p>
          </article>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
