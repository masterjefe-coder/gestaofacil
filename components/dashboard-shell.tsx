import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/logout-button";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { switchActiveWorkspaceAction } from "@/app/dashboard/actions";
import { authOptions } from "@/lib/auth-options";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { dashboardNav } from "@/lib/mock-data";
import { getSubscriptionStatusLabel } from "@/lib/subscription";
import { listUserWorkspaces } from "@/lib/workspace-membership-repository";
import { getOperationalAlerts } from "@/lib/operational-alerts";
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

  const [setup, subscription, workspaces, context, operationalAlerts] = await Promise.all([
    getWorkspaceSetup(),
    getWorkspaceSubscription(),
    listUserWorkspaces(),
    getCurrentWorkspaceContext(),
    getOperationalAlerts(),
  ]);

  const restrictedSubscription = subscription.status === "PAST_DUE" || subscription.status === "CANCELED";

  if (restrictedSubscription && currentPath !== "/dashboard/setup") {
    redirect("/dashboard/setup?subscriptionIntent=1");
  }

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-top">
            <BrandLogo variant="mark" className="sidebar-brand-mark" priority />
            <div className="sidebar-identity">
              <span className="sidebar-status-pill">Empresa ativa</span>
              <h2>{setup.tradeName || setup.name}</h2>
              <p>{session.user.name || session.user.email || "Operador"}</p>
            </div>
          </div>
          {workspaces.length > 1 ? (
            <WorkspaceSwitcher
              currentWorkspaceId={context.workspaceId}
              options={workspaces}
              action={switchActiveWorkspaceAction}
              returnTo={currentPath}
            />
          ) : null}
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

        <div className="sidebar-footer">
          <LogoutButton />
        </div>
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
            <strong>Acesso limitado no momento</strong>
            <span>
              Status atual: {getSubscriptionStatusLabel(subscription.status)}. Ajuste o plano na área da empresa para voltar a operar normalmente.
            </span>
          </div>
        ) : null}

        {operationalAlerts.length > 0 ? (
          <section className="dashboard-alert-stack">
            {operationalAlerts.map((alert) => (
              <div key={alert.id} className={alert.tone === "critical" ? "auth-hint fiscal-warning" : "auth-hint"}>
                <strong>{alert.title}</strong>
                <span>{alert.message}</span>
                {alert.href && alert.hrefLabel ? (
                  <Link href={alert.href} className="secondary-link">
                    {alert.hrefLabel}
                  </Link>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}

        {children}
      </section>
    </main>
  );
}
