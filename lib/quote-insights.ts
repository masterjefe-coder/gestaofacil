import type { Customer, CustomerWhatsappActivity, Quote } from "@/lib/types";

export type QuotePriority = "hot" | "followup" | "approved" | "waiting";

export type QuoteInsight = {
  quoteId: string;
  customer: string;
  title: string;
  amount: string;
  status: Quote["status"];
  dueLabel: string;
  summary: string;
  customerPhone?: string;
  customerStatus?: Customer["status"];
  customerOpenAmount?: string;
  whatsappEventCount: number;
  whatsappLastEventAt?: string;
  whatsappLastEventSummary?: string;
  priority: QuotePriority;
  priorityLabel: string;
  cadenceLabel: string;
  executionLabel: string;
  completedStepLabel: string;
  nextStepLabel: string;
  helper: string;
};

export type QuoteInsightSummary = {
  hotCount: number;
  followUpCount: number;
  approvedCount: number;
  waitingCount: number;
};

function getPriorityLabel(priority: QuotePriority) {
  switch (priority) {
    case "hot":
      return "Quente";
    case "followup":
      return "Follow-up";
    case "approved":
      return "Aprovado";
    case "waiting":
      return "Aguardando";
  }
}

function getPriority(quote: Quote, hasWhatsappSignal: boolean): QuotePriority {
  if (quote.status === "Aprovado") {
    return "approved";
  }

  if (hasWhatsappSignal) {
    return "hot";
  }

  if (quote.status === "Follow-up") {
    return "followup";
  }

  return "waiting";
}

function getCadenceLabel(priority: QuotePriority, quote: Quote) {
  if (quote.cadence?.cadenceLabel) {
    return quote.cadence.cadenceLabel;
  }

  switch (priority) {
    case "hot":
      return "Cliente respondeu e a proposta pede retomada imediata";
    case "followup":
      return "Proposta já entrou em follow-up ativo";
    case "approved":
      return "Aprovação pronta para conversão operacional";
    case "waiting":
      return "Aguardando leitura ou resposta do cliente";
  }
}

function getExecutionLabel(priority: QuotePriority, quote: Quote) {
  if (quote.cadence?.executionLabel) {
    return quote.cadence.executionLabel;
  }

  switch (priority) {
    case "hot":
      return "Responder agora";
    case "followup":
      return "Enviar nova tentativa";
    case "approved":
      return "Gerar cobrança ou pedido";
    case "waiting":
      return "Monitorar e puxar próxima cadência";
  }
}

function getCompletedStepLabel(priority: QuotePriority, quote: Quote) {
  if (quote.cadence?.completedStepLabel) {
    return quote.cadence.completedStepLabel;
  }

  if (quote.status === "Aprovado") {
    return "Proposta aprovada pelo cliente";
  }

  switch (priority) {
    case "hot":
      return "Cliente voltou a interagir no canal";
    case "followup":
      return "Primeiro envio já aconteceu";
    case "approved":
      return "Proposta validada comercialmente";
    case "waiting":
      return "Proposta enviada e aguardando reação";
  }
}

function getNextStepLabel(priority: QuotePriority, quote: Quote) {
  if (quote.cadence?.nextStepLabel) {
    return quote.cadence.nextStepLabel;
  }

  switch (priority) {
    case "hot":
      return "Responder e buscar decisão";
    case "followup":
      return "Executar nova tentativa com CTA claro";
    case "approved":
      return "Converter em cobrança ou pedido";
    case "waiting":
      return "Programar próximo contato";
  }
}

function getHelper(input: {
  quote: Quote;
  hasWhatsappSignal: boolean;
  activity?: CustomerWhatsappActivity;
  customer?: Customer;
}) {
  if (input.quote.status === "Aprovado") {
    return "Já pode virar pedido, cobrança ou próximo passo operacional sem retrabalho.";
  }

  if (input.hasWhatsappSignal) {
    return input.activity?.lastEventSummary || "O cliente já mostrou sinal no WhatsApp e vale aproveitar esse calor na proposta.";
  }

  if (input.quote.status === "Follow-up") {
    return "A proposta já pede retomada ativa para não esfriar no pipeline comercial.";
  }

  if (input.customer?.status === "Aguardando retorno") {
    return "O cliente já estava marcado como aguardando retorno e o orçamento reforça essa prioridade.";
  }

  return "Proposta enviada e aguardando o melhor momento de retomada comercial.";
}

export function buildQuoteInsights(
  quotes: Quote[],
  customers: Customer[],
  whatsappActivity: CustomerWhatsappActivity[],
) {
  const customerByName = new Map(customers.map((customer) => [customer.name, customer]));
  const activityByCustomerName = new Map(whatsappActivity.map((activity) => [activity.customerName, activity]));

  const items = quotes.map((quote) => {
    const customer = customerByName.get(quote.customer);
    const activity = activityByCustomerName.get(quote.customer);
    const hasWhatsappSignal = Boolean(activity?.eventCount);
    const priority = getPriority(quote, hasWhatsappSignal);

    return {
      quoteId: quote.id,
      customer: quote.customer,
      title: quote.title,
      amount: quote.amount,
      status: quote.status,
      dueLabel: quote.dueLabel,
      summary: quote.summary,
      customerPhone: customer?.phone,
      customerStatus: customer?.status,
      customerOpenAmount: customer?.openAmount,
      whatsappEventCount: activity?.eventCount || 0,
      whatsappLastEventAt: activity?.lastEventAt,
      whatsappLastEventSummary: activity?.lastEventSummary,
      priority,
      priorityLabel: getPriorityLabel(priority),
      cadenceLabel: getCadenceLabel(priority, quote),
      executionLabel: getExecutionLabel(priority, quote),
      completedStepLabel: getCompletedStepLabel(priority, quote),
      nextStepLabel: getNextStepLabel(priority, quote),
      helper: getHelper({
        quote,
        hasWhatsappSignal,
        activity,
        customer,
      }),
    } satisfies QuoteInsight;
  });

  const priorityWeight = (priority: QuotePriority) => {
    switch (priority) {
      case "hot":
        return 0;
      case "followup":
        return 1;
      case "approved":
        return 2;
      case "waiting":
        return 3;
    }
  };

  const sortedItems = [...items].sort((left, right) => {
    const leftWeight = priorityWeight(left.priority);
    const rightWeight = priorityWeight(right.priority);

    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    return right.whatsappEventCount - left.whatsappEventCount;
  });

  const summary = sortedItems.reduce<QuoteInsightSummary>((acc, item) => {
    switch (item.priority) {
      case "hot":
        acc.hotCount += 1;
        break;
      case "followup":
        acc.followUpCount += 1;
        break;
      case "approved":
        acc.approvedCount += 1;
        break;
      case "waiting":
        acc.waitingCount += 1;
        break;
    }

    return acc;
  }, {
    hotCount: 0,
    followUpCount: 0,
    approvedCount: 0,
    waitingCount: 0,
  });

  return {
    summary,
    items: sortedItems,
  };
}
