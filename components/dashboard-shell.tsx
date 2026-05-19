import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/logout-button";
import { authOptions } from "@/lib/auth-options";
import { dashboardNav } from "@/lib/mock-data";
import { getWorkspaceSetup } from "@/lib/workspace-settings-repository";

type DashboardShellProps = {
  children: ReactNode;
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
};

export async function DashboardShell({
  children,
  title,
  description,
  eyebrow = "Dashboard",
  actions,
}: DashboardShellProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const setup = await getWorkspaceSetup();

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="sidebar-brand">
          <BrandLogo className="sidebar-wordmark" />
          <span className="eyebrow">Workspace ativo</span>
          <h2>{setup.tradeName || setup.name}</h2>
          <p>{setup.niche || "Vendas, cobranças e nota fiscal no mesmo caminho."}</p>
        </div>

        <div className="sidebar-meta">
          <strong>{setup.city && setup.state ? `${setup.city} - ${setup.state}` : setup.document}</strong>
          <small>{setup.defaultPixKey || "Defina a chave Pix no setup"}</small>
        </div>

        <div className="sidebar-meta sidebar-session">
          <strong>{session.user.name || "Operador"}</strong>
          <small>{session.user.email}</small>
          <LogoutButton />
        </div>

        <nav className="sidebar-nav" aria-label="Navegação do dashboard">
          {dashboardNav.map((item) => (
            <Link key={item.href} href={item.href} className="sidebar-link">
              <span>{item.label}</span>
              <small>{item.helper}</small>
            </Link>
          ))}
        </nav>
      </aside>

      <section className="workspace-content">
        <header className="dashboard-hero">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>

          {actions ? <div className="dashboard-actions">{actions}</div> : null}
        </header>

        {children}
      </section>
    </main>
  );
}
