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

export default function SegmentsPage() {
  return (
    <main className="page-shell">
      <MarketingTopbar />

      <section className="section-grid brand-strip">
        <div>
          <span className="section-label">Segmentos</span>
          <h1>O melhor encaixe vem de operações de serviço que precisam vender e cobrar com mais disciplina.</h1>
          <p className="hero-text">
            O produto foi pensado para empresas que vivem de atendimento, proposta, recebimento e NFS-e, não de estoque pesado ou ERP industrial.
          </p>
        </div>
      </section>

      <section className="chips-wrap">
        {idealFor.map((item) => (
          <span key={item} className="segment-chip">
            {item}
          </span>
        ))}
      </section>

      <section className="section-split">
        <article className="split-panel success">
          <span className="section-label">Encaixe forte</span>
          <h2>Quando o fluxo comercial é recorrente, o produto ganha valor rápido.</h2>
          <p>Especialmente em operações com WhatsApp forte, cobrança frequente e necessidade de emissão no tempo certo.</p>
        </article>
        <article className="split-panel">
          <span className="section-label">Posicionamento honesto</span>
          <h2>Nem todo segmento deve entrar do mesmo jeito no início.</h2>
          <p>Em saúde mais profunda, por exemplo, o discurso precisa respeitar o que ainda não é camada clínica completa.</p>
          <div className="hero-actions">
            <Link href="/contato" className="secondary-link">
              Validar encaixe com a equipe
            </Link>
          </div>
        </article>
      </section>

      <MarketingFooter />
    </main>
  );
}
