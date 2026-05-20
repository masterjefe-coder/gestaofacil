import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const footerColumns = [
  {
    title: "Produto",
    links: [
      { href: "/", label: "Visão geral" },
      { href: "/planos", label: "Planos" },
      { href: "/checkout?plan=PROFESSIONAL", label: "Iniciar trial" },
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
        <div>
          <span className="section-label">Gestão Fácil Sistemas</span>
          <h2>Produto com cara de empresa séria, não de ferramenta improvisada.</h2>
          <p>
            O foco continua o mesmo: ajudar empresas de serviço a vender, cobrar e emitir com menos atrito no dia real.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/checkout?plan=PROFESSIONAL" className="primary-link">
            Iniciar trial
          </Link>
          <Link href="/contato" className="secondary-link">
            Falar com a equipe
          </Link>
        </div>
      </div>

      <div className="marketing-footer-grid">
        <div className="marketing-footer-brand">
          <BrandLogo className="footer-wordmark" />
          <p>
            Gestão comercial, cobrança e NFS-e no mesmo fluxo para operações de serviço que precisam de velocidade e clareza.
          </p>
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
