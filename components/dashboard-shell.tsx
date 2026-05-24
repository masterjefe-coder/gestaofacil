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
import {
  getCurrentDashboardModuleSignal,
  getDashboardNavigationSignalClass,
  mapOperationalAlertsToNavigationSignals,
} from "@/lib/dashboard-navigation-signals";
import { dashboardNav } from "@/lib/mock-data";
import { getWorkspaceRoleLabel } from "@/lib/workspace-access";
import { getDashboardNotificationCenter } from "@/lib/dashboard-notification-center";
import { getPrimaryOperationalAlert } from "@/lib/operational-alerts";
import { getSubscriptionStatusLabel } from "@/lib/subscription";
import { listUserWorkspaces } from "@/lib/workspace-membership-repository";
import { getOperationalAlerts } from "@/lib/operational-alerts";
import { getWorkspaceSubscription } from "@/lib/workspace-subscription-repository";
import { getWorkspaceSetup } from "@/lib/workspace-settings-repository";
import { getCurrentUserAlertPreferences } from "@/lib/workspace-user-preferences";

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

  const [setup, subscription, workspaces, context, operationalAlerts, notificationCenter, alertPreferences] = await Promise.all([
    getWorkspaceSetup(),
    getWorkspaceSubscription(),
    listUserWorkspaces(),
    getCurrentWorkspaceContext(),
    getOperationalAlerts(),
    getDashboardNotificationCenter(),
    getCurrentUserAlertPreferences(),
  ]);

  const restrictedSubscription = subscription.status === "PAST_DUE" || subscription.status === "CANCELED";
  const primaryOperationalAlert = getPrimaryOperationalAlert(operationalAlerts);
  const additionalOperationalAlerts = primaryOperationalAlert
    ? operationalAlerts.slice(1)
    : operationalAlerts;
  const navigationSignals = mapOperationalAlertsToNavigationSignals(operationalAlerts);
  const navigationSignalsByHref = new Map(
    navigationSignals.map((signal) => [signal.href, signal]),
  );
  const currentModuleSignal = getCurrentDashboardModuleSignal(currentPath, navigationSignals);
  const pageHeading = eyebrow || title;

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
              <small>{getWorkspaceRoleLabel(context.workspaceRole)}</small>
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
          {dashboardNav.map((item) => {
            const signal = navigationSignalsByHref.get(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={item.href === currentPath ? "sidebar-link sidebar-link-active" : "sidebar-link"}
              >
                <span>{item.label}</span>
                {signal ? (
                  <small className={`sidebar-link-badge sidebar-link-badge-${getDashboardNavigationSignalClass(signal.status)}`}>
                    {signal.label}
                  </small>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <LogoutButton />
        </div>
      </aside>

      <section className="workspace-content">
        <header className="dashboard-hero">
          <div className="dashboard-hero-copy-block">
            <h1>{pageHeading}</h1>
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

        {currentModuleSignal ? (
          <section className="dashboard-module-focus">
            <div className={`dashboard-module-focus-card dashboard-module-focus-card-${getDashboardNavigationSignalClass(currentModuleSignal.status)}`}>
              <div>
                <span className="section-label">Modulo em foco</span>
                <strong>{currentModuleSignal.label} pede atencao operacional agora.</strong>
                <span>
                  Esta area foi sinalizada na leitura operacional e merece revisao antes de ampliar a fila normal.
                </span>
              </div>
              <div className="dashboard-module-focus-actions">
                {currentModuleSignal.targetHref && currentModuleSignal.targetLabel ? (
                  <Link href={currentModuleSignal.targetHref} className="secondary-link">
                    {currentModuleSignal.targetLabel}
                  </Link>
                ) : null}
                <Link href="/dashboard" className="secondary-link">
                  Voltar para a central
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {alertPreferences.showOperationalAlerts && primaryOperationalAlert ? (
          <section className="dashboard-alert-hero">
            <div className={primaryOperationalAlert.tone === "critical" ? "auth-hint fiscal-warning dashboard-alert-hero-card" : "auth-hint dashboard-alert-hero-card"}>
              <div className="dashboard-alert-hero-copy">
                <span className="section-label">Em atenção agora</span>
                <strong>{primaryOperationalAlert.title}</strong>
                <span>{primaryOperationalAlert.message}</span>
                {primaryOperationalAlert.recoveryMessage ? (
                  <small>
                    Último sinal saudável: {primaryOperationalAlert.recoveryMessage}
                    {primaryOperationalAlert.recoveryAt ? ` · ${primaryOperationalAlert.recoveryAt}` : ""}
                  </small>
                ) : null}
              </div>
              {primaryOperationalAlert.href && primaryOperationalAlert.hrefLabel ? (
                <Link href={primaryOperationalAlert.href} className="secondary-link">
                  {primaryOperationalAlert.hrefLabel}
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {alertPreferences.showOperationalAlerts && additionalOperationalAlerts.length > 0 ? (
          <section className="dashboard-alert-stack">
            {additionalOperationalAlerts.map((alert) => (
              <div key={alert.id} className={alert.tone === "critical" ? "auth-hint fiscal-warning" : "auth-hint"}>
                <strong>{alert.title}</strong>
                <span>{alert.message}</span>
                {alert.recoveryMessage ? (
                  <small className="muted-text">
                    Último sinal saudável: {alert.recoveryMessage}
                    {alert.recoveryAt ? ` · ${alert.recoveryAt}` : ""}
                  </small>
                ) : null}
                {alert.href && alert.hrefLabel ? (
                  <Link href={alert.href} className="secondary-link">
                    {alert.hrefLabel}
                  </Link>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}

        {notificationCenter.length > 0 ? (
          <section className="dashboard-alert-stack">
            {notificationCenter.map((item) => (
              <div key={item.id} className={item.tone === "warning" ? "auth-hint fiscal-warning" : "auth-hint"}>
                <strong>{item.title}</strong>
                <span>{item.message}</span>
              </div>
            ))}
          </section>
        ) : null}

        {children}
      </section>
    </main>
  );
}
