import type { Metadata } from "next";
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

      <section className="section-grid brand-strip">
        <div>
          <span className="section-label">Privacidade</span>
          <h1>Política de privacidade resumida e clara para transmitir segurança desde o início.</h1>
          <p className="hero-text">
            Este texto serve como base institucional inicial. Antes de operação ampliada, recomenda-se revisão jurídica final conforme o modelo comercial adotado.
          </p>
        </div>
      </section>

      <section className="stack-list">
        {privacyPoints.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </section>

      <MarketingFooter />
    </main>
  );
}
