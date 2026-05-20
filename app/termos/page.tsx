import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Termos de uso",
  description: "Termos de uso iniciais da Gestão Fácil Sistemas para acesso, contratação e uso do produto.",
  path: "/termos",
});

const termsPoints = [
  "O uso do Gestão Fácil depende de credenciais válidas e do respeito às permissões do workspace.",
  "A contratação do software não substitui validação fiscal, contábil ou jurídica específica do cliente.",
  "Integrações com terceiros dependem da disponibilidade e das regras dos próprios provedores.",
  "O trial pode evoluir para assinatura paga conforme o plano escolhido e a ativação da recorrência.",
];

export default function TermsPage() {
  return (
    <main className="page-shell">
      <MarketingTopbar />

      <section className="inner-hero legal-hero">
        <div className="inner-hero-copy">
          <span className="section-label">Termos de uso</span>
          <h1>Uma base institucional inicial para acesso, contratação e uso do produto.</h1>
          <p className="hero-text">
            Assim como a política de privacidade, este conteúdo funciona como
            ponto de partida e deve receber revisão jurídica final antes da
            expansão comercial ampla.
          </p>
        </div>

        <div className="inner-hero-aside legal-hero-aside">
          <Link href="/privacidade" className="secondary-link">
            Ver privacidade
          </Link>
        </div>
      </section>

      <section className="home-section legal-section">
        <div className="home-section-heading">
          <span className="section-label">Resumo</span>
          <h2>Os termos abaixo resumem responsabilidades básicas de acesso, contratação e uso.</h2>
        </div>
        <ul className="stack-list legal-list">
          {termsPoints.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <MarketingFooter />
    </main>
  );
}
