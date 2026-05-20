import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

type MarketingTopbarProps = {
  ctaHref?: string;
  ctaLabel?: string;
};

const navItems = [
  { href: "/#produto", label: "Produto" },
  { href: "/planos", label: "Planos" },
  { href: "/segmentos", label: "Segmentos" },
  { href: "/integracoes", label: "Integrações" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
];

export function MarketingTopbar({
  ctaHref = "/checkout?plan=PROFESSIONAL",
  ctaLabel = "Começar agora",
}: MarketingTopbarProps) {
  return (
    <section className="site-topbar">
      <Link href="/" aria-label="Gestão Fácil Sistemas">
        <BrandLogo className="topbar-wordmark" priority />
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
