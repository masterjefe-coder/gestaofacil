import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingTopbar } from "@/components/marketing-topbar";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Privacidade",
  description: "Política de privacidade resumida da Gestão Fácil Sistemas para operação, autenticação e integrações.",
  path: "/privacidade",
});

const privacyPoints = [
  "Dados do workspace são usados para autenticação, operação comercial, cobrança e emissão fiscal dentro do escopo do produto.",
  "Integrações como Asaas, Evolution API e provedores fiscais só recebem os dados necessários para executar a função contratada.",
  "A empresa pode solicitar revisão, atualização ou remoção de dados operacionais conforme a política comercial e legal aplicável.",
];

export default function PrivacyPage() {
  return (
    <main className="page-shell">
      <MarketingTopbar />

      <section className="inner-hero legal-hero">
        <div className="inner-hero-copy">
          <span className="section-label">Privacidade</span>
          <h1>Uma base clara de privacidade para transmitir segurança desde o primeiro acesso.</h1>
          <p className="hero-text">
            Este texto funciona como base institucional inicial. Antes de uma
            operação ampliada, recomenda-se revisão jurídica final conforme o
            modelo comercial adotado.
          </p>
        </div>

        <div className="inner-hero-aside legal-hero-aside">
          <Link href="/contato" className="secondary-link">
            Falar com a equipe
          </Link>
        </div>
      </section>

      <section className="home-section legal-section">
        <div className="home-section-heading">
          <span className="section-label">Resumo</span>
          <h2>O objetivo aqui é deixar o tratamento de dados compreensível e sem juridiquês desnecessário.</h2>
        </div>
        <ul className="stack-list legal-list">
          {privacyPoints.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <MarketingFooter />
    </main>
  );
}
