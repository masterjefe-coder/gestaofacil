import type {
  SubscriptionBillingCycleCode,
  SubscriptionPlanCode,
  SubscriptionStatusCode,
  WorkspaceSubscriptionProfile,
} from "@/lib/types";

export type SubscriptionPlanPresentation = {
  code: SubscriptionPlanCode;
  name: string;
  price: string;
  annualPrice: string;
  badge: string;
  audience: string;
};

const planPresentationMap: Record<SubscriptionPlanCode, SubscriptionPlanPresentation> = {
  ESSENTIAL: {
    code: "ESSENTIAL",
    name: "Essencial",
    price: "R$ 129/mês",
    annualPrice: "R$ 1.290/ano",
    badge: "Entrada forte",
    audience: "Autonomos, consultorios enxutos e operacoes pequenas",
  },
  PROFESSIONAL: {
    code: "PROFESSIONAL",
    name: "Profissional",
    price: "R$ 219/mês",
    annualPrice: "R$ 2.190/ano",
    badge: "Melhor equilibrio",
    audience: "Clinicas de estetica, mecanicas, servicos tecnicos e pequenos times",
  },
  OPERATION: {
    code: "OPERATION",
    name: "Operacao",
    price: "R$ 349/mês",
    annualPrice: "R$ 3.490/ano",
    badge: "Para crescer",
    audience: "Operacoes com mais volume, multiatendimento ou mais de uma unidade",
  },
  ENTERPRISE: {
    code: "ENTERPRISE",
    name: "Enterprise",
    price: "Sob consulta",
    annualPrice: "Projeto customizado",
    badge: "Sob consulta",
    audience: "Operacoes maiores, redes ou necessidade comercial especial",
  },
};

export function getSubscriptionPlanPresentation(plan: SubscriptionPlanCode) {
  return planPresentationMap[plan];
}

export function getSubscriptionStatusLabel(status: SubscriptionStatusCode) {
  switch (status) {
    case "TRIALING":
      return "Em trial";
    case "ACTIVE":
      return "Ativa";
    case "PAST_DUE":
      return "Pagamento pendente";
    case "CANCELED":
      return "Cancelada";
    case "PAUSED":
      return "Pausada";
    default:
      return status;
  }
}

export function getBillingCycleLabel(cycle: SubscriptionBillingCycleCode) {
  return cycle === "YEARLY" ? "Anual" : "Mensal";
}

export function addTrialDays(start: Date, days = 14) {
  const value = new Date(start);
  value.setDate(value.getDate() + days);
  return value;
}

export function formatSubscriptionDate(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function getTrialRemainingDays(subscription: Pick<WorkspaceSubscriptionProfile, "status" | "trialEndsAt">) {
  if (subscription.status !== "TRIALING" || !subscription.trialEndsAt) {
    return null;
  }

  const end = new Date(subscription.trialEndsAt);

  if (Number.isNaN(end.getTime())) {
    return null;
  }

  const now = new Date();
  const diff = end.getTime() - now.getTime();
  const remaining = Math.ceil(diff / (1000 * 60 * 60 * 24));

  return remaining < 0 ? 0 : remaining;
}
