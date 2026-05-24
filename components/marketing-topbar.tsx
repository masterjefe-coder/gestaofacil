import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

type MarketingTopbarProps = {
  ctaHref?: string;
  ctaLabel?: string;
};

const navItems = [
  { href: "/#produto", label: "Produto" },
  { href: "/#planos", label: "Planos" },
  { href: "/#segmentos", label: "Segmentos" },
  { href: "/integracoes", label: "Integrações" },
  { href: "/contato", label: "Contato" },
];

export function MarketingTopbar({
  ctaHref = "/planos",
  ctaLabel = "Começar agora",
}: MarketingTopbarProps) {
  return (
    <section className="site-topbar">
      <div className="topbar-brand-cluster">
        <Link href="/" aria-label="Gestão Fácil Sistemas" className="topbar-brand">
          <span className="topbar-badge">Operação premium para serviços</span>
          <BrandLogo className="topbar-wordmark" priority />
          <span className="topbar-brand-copy">
            Venda, cobrança e NFS-e no mesmo fluxo para a empresa operar com mais velocidade.
          </span>
        </Link>
        <div className="topbar-context-pill">
          <span className="live-dot" />
          <strong>Teste grátis por 14 dias</strong>
          <small>Sem cartão e sem implantação pesada</small>
        </div>
      </div>

      <div className="topbar-nav-shell">
        <nav className="topbar-nav" aria-label="Navegação principal">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="topbar-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="topbar-actions">
          <Link href="/login" className="secondary-link topbar-ghost">
            Entrar
          </Link>
          <Link href={ctaHref} className="primary-link topbar-cta">
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
