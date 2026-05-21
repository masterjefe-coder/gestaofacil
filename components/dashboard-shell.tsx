import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/logout-button";
import { authOptions } from "@/lib/auth-options";
import { dashboardNav } from "@/lib/mock-data";
import { getSubscriptionStatusLabel } from "@/lib/subscription";
import { getWorkspaceSubscription } from "@/lib/workspace-subscription-repository";
import { getWorkspaceSetup } from "@/lib/workspace-settings-repository";

type DashboardShellProps = {
  children: ReactNode;
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
  currentPath?: string;
};

export async function DashboardShell({
  children,
  title,
  description,
  eyebrow = "Dashboard",
  actions,
  currentPath = "/dashboard",
}: DashboardShellProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const [setup, subscription] = await Promise.all([
    getWorkspaceSetup(),
    getWorkspaceSubscription(),
  ]);

  const restrictedSubscription = subscription.status === "PAST_DUE" || subscription.status === "CANCELED";

  if (restrictedSubscription && currentPath !== "/dashboard/setup") {
    redirect("/dashboard/setup?subscriptionIntent=1");
  }

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-status-pill">Workspace online</span>
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
            <Link
              key={item.href}
              href={item.href}
              className={item.href === currentPath ? "sidebar-link sidebar-link-active" : "sidebar-link"}
            >
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

        {restrictedSubscription ? (
          <div className="auth-hint fiscal-warning">
            <strong>Assinatura com acesso restrito</strong>
            <span>
              Status atual: {getSubscriptionStatusLabel(subscription.status)}. Ajuste a assinatura no setup para voltar a operar normalmente.
            </span>
          </div>
        ) : null}

        {children}
      </section>
    </main>
  );
}
