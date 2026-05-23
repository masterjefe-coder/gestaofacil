import type { DashboardNavigationSignal } from "@/lib/dashboard-navigation-signals";
import type { OperationalAlert } from "@/lib/operational-alerts";
import { getRecommendationWeight } from "@/lib/dashboard-repository-helpers";
import type { DashboardRecommendation } from "@/lib/dashboard-repository-types";

export type DashboardPriority = "critical" | "high" | "normal";

export const dashboardModuleCards = [
  {
    href: "/dashboard/quotes",
    kicker: "Comercial",
    title: "Orçamentos",
    description: "Criar propostas, acompanhar negociações e avançar vendas.",
  },
  {
    href: "/dashboard/orders",
    kicker: "Operação",
    title: "Pedidos",
    description: "Ver serviços aprovados, agendados e em execução.",
  },
  {
    href: "/dashboard/billing",
    kicker: "Financeiro",
    title: "Cobranças e pagamentos",
    description: "Receber, cobrar no prazo e acompanhar retornos dos clientes.",
  },
  {
    href: "/dashboard/customers",
    kicker: "Relacionamento",
    title: "Clientes",
    description: "Consultar histórico, follow-ups e oportunidades da base.",
  },
  {
    href: "/dashboard/fiscal",
    kicker: "Notas",
    title: "Emissão",
    description: "Preparar, revisar e emitir notas sem retrabalho.",
  },
  {
    href: "/dashboard/setup#integrations-section",
    kicker: "WhatsApp",
    title: "Conexões",
    description: "Conectar o número principal e acompanhar o canal da empresa.",
  },
  {
    href: "/dashboard/setup#subscription-section",
    kicker: "Plano",
    title: "Cobrança do sistema",
    description: "Ver assinatura, plano atual e status da cobrança recorrente.",
  },
  {
    href: "/dashboard/setup#team-section",
    kicker: "Empresa",
    title: "Equipe e acessos",
    description: "Gerenciar pessoas, dados da empresa e acessos do sistema.",
  },
] as const;

export function getDashboardPriorityLabel(priority: DashboardPriority) {
  if (priority === "critical") {
    return "Prioridade crítica";
  }

  if (priority === "high") {
    return "Prioridade alta";
  }

  return "Prioridade normal";
}

export function getDashboardPriorityClass(priority: DashboardPriority) {
  if (priority === "critical") {
    return "priority-critical";
  }

  if (priority === "high") {
    return "priority-high";
  }

  return "priority-normal";
}

function getOperationalSignalRank(signal: DashboardNavigationSignal | undefined) {
  if (!signal) {
    return 0;
  }

  switch (signal.status) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}

function getMatchingSignal(
  href: string,
  signals: DashboardNavigationSignal[],
) {
  if (href.startsWith("/dashboard/setup#subscription")) {
    return signals.find((signal) => signal.href === "/dashboard/setup" && signal.label === "Plano");
  }

  if (href.startsWith("/dashboard/setup#integrations")) {
    return signals.find((signal) => signal.href === "/dashboard/setup" && signal.label === "WhatsApp");
  }

  if (href.startsWith("/dashboard/setup#team")) {
    return signals.find((signal) => signal.href === "/dashboard/setup" && signal.label === "Empresa");
  }

  return signals.find((signal) => signal.href === href);
}

function getRecommendationMatchingSignal(
  recommendation: DashboardRecommendation,
  signals: DashboardNavigationSignal[],
) {
  if (recommendation.href.startsWith("/dashboard/fiscal")) {
    return signals.find((signal) => signal.href === "/dashboard/fiscal");
  }

  if (recommendation.href.startsWith("/dashboard/billing")) {
    return signals.find((signal) => signal.href === "/dashboard/billing");
  }

  if (recommendation.href.startsWith("/dashboard/setup")) {
    if (recommendation.href.includes("subscription")) {
      return signals.find((signal) => signal.href === "/dashboard/setup" && signal.label === "Plano");
    }

    if (recommendation.href.includes("integrations")) {
      return signals.find((signal) => signal.href === "/dashboard/setup" && signal.label === "WhatsApp");
    }

    return signals.find((signal) => signal.href === "/dashboard/setup");
  }

  return undefined;
}

export function getOperationalPromotionForRecommendation(
  recommendation: DashboardRecommendation,
  signals: DashboardNavigationSignal[],
) {
  const signal = getRecommendationMatchingSignal(recommendation, signals);

  if (!signal || signal.status === "ok") {
    return null;
  }

  return {
    label: signal.status === "critical" ? "Prioridade operacional" : "Em atencao",
    status: signal.status,
    signalLabel: signal.label,
  };
}

export function getDashboardHeroState(
  recommendations: DashboardRecommendation[],
  signals: DashboardNavigationSignal[],
  primaryOperationalAlert?: OperationalAlert,
) {
  const topRecommendation = recommendations[0];

  if (
    primaryOperationalAlert
    && (
      primaryOperationalAlert.tone === "critical"
      || !topRecommendation
    )
  ) {
    return {
      mode: "operational" as const,
      title: primaryOperationalAlert.title,
      description: primaryOperationalAlert.message,
      href: primaryOperationalAlert.href || "/dashboard/setup",
      hrefLabel: primaryOperationalAlert.hrefLabel || "Abrir area responsavel",
      priority: primaryOperationalAlert.tone === "critical" ? "critical" as const : "high" as const,
      badgeLabel: "Prioridade operacional",
      sourceLabel:
        signals.find((signal) => signal.href === "/dashboard/setup" && primaryOperationalAlert.href?.includes("subscription"))?.label
        || signals.find((signal) => signal.href === "/dashboard/fiscal" && primaryOperationalAlert.href?.includes("/dashboard/fiscal"))?.label
        || signals.find((signal) => signal.href === "/dashboard/billing" && primaryOperationalAlert.href?.includes("/dashboard/billing"))?.label
        || signals.find((signal) => signal.href === "/dashboard/setup" && primaryOperationalAlert.href?.includes("integrations"))?.label
        || "Operacao",
      recoveryMessage: primaryOperationalAlert.recoveryMessage,
    };
  }

  if (topRecommendation) {
    const promotion = getOperationalPromotionForRecommendation(topRecommendation, signals);

    return {
      mode: "recommendation" as const,
      title: topRecommendation.title,
      description: topRecommendation.description,
      href: topRecommendation.href,
      hrefLabel: topRecommendation.hrefLabel,
      priority: topRecommendation.priority,
      badgeLabel: promotion?.label || getDashboardPriorityLabel(topRecommendation.priority),
      sourceLabel: promotion?.signalLabel || null,
      recoveryMessage: null,
      action: topRecommendation.action,
    };
  }

  return {
    mode: "stable" as const,
    title: "A operacao esta estavel e pronta para seguir pelos modulos.",
    description: "Quando surgir um ponto realmente importante, ele aparece aqui primeiro para voce nao perder tempo procurando onde agir.",
    href: "/dashboard/quotes",
    hrefLabel: "Abrir area responsavel",
    priority: "normal" as const,
    badgeLabel: "Tudo sob controle",
    sourceLabel: null,
    recoveryMessage: null,
  };
}

export function orderDashboardModuleCards(
  signals: DashboardNavigationSignal[],
) {
  return [...dashboardModuleCards].sort((left, right) => {
    const leftSignal = getMatchingSignal(left.href, signals);
    const rightSignal = getMatchingSignal(right.href, signals);
    const rankDiff = getOperationalSignalRank(rightSignal) - getOperationalSignalRank(leftSignal);

    if (rankDiff !== 0) {
      return rankDiff;
    }

    return dashboardModuleCards.findIndex((item) => item.href === left.href)
      - dashboardModuleCards.findIndex((item) => item.href === right.href);
  });
}

export function orderDashboardRecommendations(
  recommendations: DashboardRecommendation[],
  signals: DashboardNavigationSignal[],
) {
  return [...recommendations].sort((left, right) => {
    const leftSignal = getRecommendationMatchingSignal(left, signals);
    const rightSignal = getRecommendationMatchingSignal(right, signals);
    const rankDiff = getOperationalSignalRank(rightSignal) - getOperationalSignalRank(leftSignal);

    if (rankDiff !== 0) {
      return rankDiff;
    }

    const priorityDiff = getRecommendationWeight(left.priority) - getRecommendationWeight(right.priority);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return recommendations.findIndex((item) => item.title === left.title)
      - recommendations.findIndex((item) => item.title === right.title);
  });
}
