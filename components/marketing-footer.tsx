import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const footerColumns = [
  {
    title: "Produto",
    links: [
      { href: "/", label: "Visão geral" },
      { href: "/planos", label: "Planos" },
      { href: "/checkout", label: "Escolher plano e iniciar teste" },
      { href: "/integracoes", label: "Integrações" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { href: "/sobre", label: "Sobre" },
      { href: "/contato", label: "Contato" },
      { href: "/segmentos", label: "Segmentos" },
      { href: "/ajuda", label: "Ajuda" },
    ],
  },
  {
    title: "Jurídico",
    links: [
      { href: "/privacidade", label: "Privacidade" },
      { href: "/termos", label: "Termos de uso" },
      { href: "/login", label: "Entrar" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-footer-band">
        <div className="marketing-footer-band-copy">
          <span className="section-label">Gestão Fácil Sistemas</span>
          <h2>Um sistema para vender melhor, receber no prazo e emitir sem retrabalho.</h2>
          <p>
            O foco continua o mesmo: ajudar empresas de serviço a organizar comercial,
            financeiro e fiscal no mesmo fluxo, com cara de produto maduro desde o primeiro clique.
          </p>
        </div>
        <div className="hero-actions marketing-footer-band-actions">
          <Link href="/checkout" className="primary-link">
            Escolher plano e iniciar teste
          </Link>
          <Link href="/contato" className="secondary-link">
            Falar com a equipe
          </Link>
        </div>
      </div>

      <div className="marketing-footer-grid">
        <div className="marketing-footer-brand">
          <span className="marketing-footer-badge">Comercial, financeiro e fiscal no mesmo compasso</span>
          <BrandLogo className="footer-wordmark" />
          <span className="marketing-footer-tag">
            Venda, receba e emita em uma rotina mais organizada e profissional.
          </span>
          <p>
            Feito para operações de serviço que querem clareza comercial, cobrança visível
            e emissão fiscal sem retrabalho nem excesso de tela.
          </p>
          <div className="marketing-footer-inline-links">
            <Link href="/sobre">Sobre</Link>
            <Link href="/ajuda">Ajuda</Link>
            <Link href="/login">Entrar</Link>
          </div>
        </div>

        {footerColumns.map((column) => (
          <div key={column.title} className="marketing-footer-column">
            <strong>{column.title}</strong>
            <div className="marketing-footer-links">
              {column.links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}
