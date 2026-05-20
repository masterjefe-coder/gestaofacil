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
  ctaHref = "/checkout?plan=PROFESSIONAL",
  ctaLabel = "Começar agora",
}: MarketingTopbarProps) {
  return (
    <section className="site-topbar">
      <Link href="/" aria-label="Gestão Fácil Sistemas" className="topbar-brand">
        <BrandLogo className="topbar-wordmark" priority />
        <span className="topbar-brand-copy">
          CRM, cobrança e NFS-e para operações de serviço.
        </span>
      </Link>
      <div className="topbar-actions">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="topbar-link">
            {item.label}
          </Link>
        ))}
        <Link href={ctaHref} className="primary-link topbar-cta">
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
