import type { Metadata } from "next";
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

      <section className="section-grid brand-strip">
        <div>
          <span className="section-label">Termos de uso</span>
          <h1>Base institucional inicial para acesso, contratação e uso do produto.</h1>
          <p className="hero-text">
            Assim como a política de privacidade, este conteúdo funciona como ponto de partida e deve receber revisão jurídica final antes da expansão comercial ampla.
          </p>
        </div>
      </section>

      <section className="stack-list">
        {termsPoints.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </section>

      <MarketingFooter />
    </main>
  );
}
