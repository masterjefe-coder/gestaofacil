import type { Customer, CustomerWhatsappActivity, PipelineItem } from "@/lib/types";

export type CustomerEngagementInsight = {
  customerId: string;
  customerName: string;
  status: Customer["status"];
  phone?: string;
  city: string;
  openAmount: string;
  lastSale: string;
  eventCount: number;
  lastEventAt?: string;
  lastEventSummary?: string;
  priority: "hot" | "followup" | "reactivation" | "stable";
  headline: string;
  helper: string;
};

export type CustomerEngagementSummary = {
  hotCount: number;
  followUpCount: number;
  reactivationCount: number;
  stableCount: number;
};

function hasOpenAmount(value: string) {
  return value.trim() !== "R$ 0";
}

function getInsight(customer: Customer, activity?: CustomerWhatsappActivity): CustomerEngagementInsight {
  const eventCount = activity?.eventCount || 0;
  const hasRecentActivity = eventCount > 0;
  const waitingReply = customer.status === "Aguardando retorno";
  const recurring = customer.status === "Recorrente";
  const openAmount = hasOpenAmount(customer.openAmount);

  if (waitingReply && hasRecentActivity) {
    return {
      customerId: customer.id,
      customerName: customer.name,
      status: customer.status,
      phone: customer.phone,
      city: customer.city,
      openAmount: customer.openAmount,
      lastSale: customer.lastSale,
      eventCount,
      lastEventAt: activity?.lastEventAt,
      lastEventSummary: activity?.lastEventSummary,
      priority: "hot",
      headline: "Cliente engajado no canal",
      helper: activity?.lastEventSummary || "Houve sinal recente no WhatsApp e vale responder ainda no fluxo comercial.",
    };
  }

  if (waitingReply || (hasRecentActivity && openAmount)) {
    return {
      customerId: customer.id,
      customerName: customer.name,
      status: customer.status,
      phone: customer.phone,
      city: customer.city,
      openAmount: customer.openAmount,
      lastSale: customer.lastSale,
      eventCount,
      lastEventAt: activity?.lastEventAt,
      lastEventSummary: activity?.lastEventSummary,
      priority: "followup",
      headline: waitingReply ? "Follow-up comercial pendente" : "Cliente ativo com pendência aberta",
      helper: waitingReply
        ? "Já existe contexto para retomar essa conversa sem começar do zero."
        : "O cliente está vivo no canal e ainda carrega valor em aberto na operação.",
    };
  }

  if (!hasRecentActivity && !recurring) {
    return {
      customerId: customer.id,
      customerName: customer.name,
      status: customer.status,
      phone: customer.phone,
      city: customer.city,
      openAmount: customer.openAmount,
      lastSale: customer.lastSale,
      eventCount,
      lastEventAt: activity?.lastEventAt,
      lastEventSummary: activity?.lastEventSummary,
      priority: "reactivation",
      headline: "Bom candidato para reativação",
      helper: customer.phone
        ? "Tem número cadastrado e ainda não mostrou sinal recente no WhatsApp."
        : "Vale completar o canal e decidir se entra em fluxo de reativação.",
    };
  }

  return {
    customerId: customer.id,
    customerName: customer.name,
    status: customer.status,
    phone: customer.phone,
    city: customer.city,
    openAmount: customer.openAmount,
    lastSale: customer.lastSale,
    eventCount,
    lastEventAt: activity?.lastEventAt,
    lastEventSummary: activity?.lastEventSummary,
    priority: "stable",
    headline: "Relacionamento estável",
    helper: recurring
      ? "Cliente recorrente com base previsível para operação e cobrança."
      : "Sem urgência comercial imediata agora.",
  };
}

export function buildCustomerEngagementInsights(customers: Customer[], activities: CustomerWhatsappActivity[]) {
  const activityByCustomerId = new Map(activities.map((item) => [item.customerId, item]));
  const items = customers.map((customer) => getInsight(customer, activityByCustomerId.get(customer.id)));
  const priorityWeight = (value: CustomerEngagementInsight["priority"]) => {
    switch (value) {
      case "hot":
        return 0;
      case "followup":
        return 1;
      case "reactivation":
        return 2;
      case "stable":
        return 3;
    }
  };

  const sortedItems = [...items].sort((left, right) => {
    const leftWeight = priorityWeight(left.priority);
    const rightWeight = priorityWeight(right.priority);

    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    return right.eventCount - left.eventCount;
  });

  const summary = sortedItems.reduce<CustomerEngagementSummary>((acc, item) => {
    switch (item.priority) {
      case "hot":
        acc.hotCount += 1;
        break;
      case "followup":
        acc.followUpCount += 1;
        break;
      case "reactivation":
        acc.reactivationCount += 1;
        break;
      case "stable":
        acc.stableCount += 1;
        break;
    }

    return acc;
  }, {
    hotCount: 0,
    followUpCount: 0,
    reactivationCount: 0,
    stableCount: 0,
  });

  return {
    summary,
    items: sortedItems,
  };
}

export function buildCustomerPipelineItems(customers: Customer[], activities: CustomerWhatsappActivity[]): PipelineItem[] {
  return buildCustomerEngagementInsights(customers, activities)
    .items
    .slice(0, 4)
    .map((item) => ({
      title: item.customerName,
      subtitle: item.headline,
      meta: item.lastEventSummary || item.helper,
    }));
}
