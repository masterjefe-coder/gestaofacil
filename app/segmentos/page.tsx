import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";
import { idealFor } from "@/lib/site-data";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Segmentos",
  description: "Veja os segmentos com melhor encaixe para o Gestão Fácil e quando o produto ganha valor mais rápido.",
  path: "/segmentos",
});

const segmentSignals = [
  "Empresas com atendimento recorrente",
  "Cobrança frequente e operação enxuta",
  "Necessidade de NFS-e no tempo certo",
];

export default function SegmentsPage() {
  return (
    <main className="page-shell">
      <MarketingTopbar />

      <section className="inner-hero">
        <div className="inner-hero-copy">
          <span className="section-label">Segmentos</span>
          <h1>O melhor encaixe vem de operações de serviço que precisam vender, cobrar e emitir no mesmo ritmo.</h1>
          <p className="hero-text">
            O produto foi desenhado para empresas que vivem de atendimento,
            proposta, recebimento e NFS-e. O ganho aparece mais rápido onde a
            rotina depende de velocidade, clareza e cadência.
          </p>
          <div className="hero-actions">
            <Link href="/checkout" className="primary-link">
              Escolher plano e iniciar teste
            </Link>
            <Link href="/contato" className="secondary-link">
              Validar encaixe com a equipe
            </Link>
          </div>
        </div>

        <div className="inner-hero-aside inner-hero-list">
          {segmentSignals.map((item) => (
            <div key={item} className="inner-hero-note">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="home-section home-section-soft">
        <div className="home-section-heading">
          <span className="section-label">Melhores encaixes</span>
          <h2>São segmentos em que rapidez, cobrança e simplicidade pesam mais do que um ERP pesado.</h2>
        </div>
        <div className="chips-wrap">
          {idealFor.map((item) => (
            <span key={item} className="segment-chip">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="home-section home-section-split">
        <div className="home-pillars-grid">
          <article className="home-pillar-card">
            <span className="section-label">Encaixe forte</span>
            <h3>Quando o fluxo comercial é recorrente, o produto prova valor rápido.</h3>
            <p>
              Especialmente em operações com WhatsApp forte, cobrança frequente e
              necessidade de emissão no tempo certo.
            </p>
          </article>
          <article className="home-pillar-card">
            <span className="section-label">Posicionamento honesto</span>
            <h3>Nem todo segmento precisa entrar do mesmo jeito logo no início.</h3>
            <p>
              Em saúde mais profunda, por exemplo, o discurso precisa respeitar
              o que ainda não é camada clínica completa.
            </p>
          </article>
          <article className="home-pillar-card">
            <span className="section-label">Critério comercial</span>
            <h3>O valor aparece quando o sistema começa a sustentar rotina.</h3>
            <p>
              Quanto maior a dependência de proposta, cobrança e follow-up, mais
              rápido o produto prova utilidade.
            </p>
          </article>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
