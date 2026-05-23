import type { OperationalAlert } from "@/lib/operational-alerts";

export type DashboardNavigationSignalStatus = "ok" | "warning" | "critical";

export type DashboardNavigationSignal = {
  href: string;
  label: string;
  status: DashboardNavigationSignalStatus;
  targetHref?: string;
  targetLabel?: string;
};

function withOperationalFocus(href: string, focus: string, hash: string) {
  return `${href}${href.includes("?") ? "&" : "?"}operationalFocus=${focus}${hash}`;
}

function getStatusRank(status: DashboardNavigationSignalStatus) {
  switch (status) {
    case "critical":
      return 2;
    case "warning":
      return 1;
    default:
      return 0;
  }
}

function setNavigationSignal(
  signals: Map<string, DashboardNavigationSignal>,
  nextSignal: DashboardNavigationSignal,
) {
  const currentSignal = signals.get(nextSignal.href);

  if (!currentSignal || getStatusRank(nextSignal.status) >= getStatusRank(currentSignal.status)) {
    signals.set(nextSignal.href, nextSignal);
  }
}

export function getDashboardNavigationSignalClass(status: DashboardNavigationSignalStatus) {
  switch (status) {
    case "critical":
      return "critical";
    case "warning":
      return "warning";
    default:
      return "ok";
  }
}

export function mapOperationalAlertsToNavigationSignals(
  alerts: OperationalAlert[],
): DashboardNavigationSignal[] {
  const signals = new Map<string, DashboardNavigationSignal>();

  for (const alert of alerts) {
    if (alert.id === "subscription-restricted") {
      setNavigationSignal(signals, {
        href: "/dashboard/setup",
        label: "Plano",
        status: alert.tone,
        targetHref: withOperationalFocus(
          "/dashboard/setup",
          "subscription",
          "#subscription-section",
        ),
        targetLabel: "Abrir assinatura",
      });
      continue;
    }

    if (alert.id === "asaas-webhook-pending" || alert.id === "asaas-incident") {
      setNavigationSignal(signals, {
        href: "/dashboard/billing",
        label: "Cobranca",
        status: alert.tone,
        targetHref: alert.id === "asaas-incident"
          ? withOperationalFocus(
            "/dashboard/billing?focus=triage&view=triage",
            "recebimentos",
            "#recebimentos",
          )
          : withOperationalFocus(
            "/dashboard/billing",
            "recebimentos",
            "#recebimentos",
          ),
        targetLabel: alert.id === "asaas-incident"
          ? "Abrir triagem"
          : "Abrir recebimentos",
      });
      setNavigationSignal(signals, {
        href: "/dashboard/setup",
        label: "Empresa",
        status: alert.tone,
        targetHref: withOperationalFocus(
          "/dashboard/setup",
          "integrations",
          "#integrations-section",
        ),
        targetLabel: "Abrir integracoes",
      });
      continue;
    }

    if (alert.id === "evolution-unreachable") {
      setNavigationSignal(signals, {
        href: "/dashboard/setup",
        label: "WhatsApp",
        status: alert.tone,
        targetHref: withOperationalFocus(
          "/dashboard/setup",
          "integrations",
          "#integrations-section",
        ),
        targetLabel: "Abrir WhatsApp",
      });
      continue;
    }

    if (alert.id === "fiscal-not-ready") {
      setNavigationSignal(signals, {
        href: "/dashboard/fiscal",
        label: "Fiscal",
        status: alert.tone,
        targetHref: withOperationalFocus(
          "/dashboard/fiscal",
          "documentos",
          "#documentos-fiscais",
        ),
        targetLabel: "Abrir documentos",
      });
    }
  }

  return Array.from(signals.values());
}

export function getCurrentDashboardModuleSignal(
  currentPath: string,
  signals: DashboardNavigationSignal[],
) {
  if (currentPath === "/dashboard") {
    return null;
  }

  return signals.find((signal) => signal.href === currentPath) || null;
}
