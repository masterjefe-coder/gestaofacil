import { cache } from "react";
import { buildBillingWhatsappInsights } from "@/lib/billing-whatsapp-insights";
import { listChargeWhatsappSignals } from "@/lib/charge-whatsapp-signals";
import { buildChargeFollowUpActions, summarizeChargeFollowUp } from "@/lib/charge-follow-up";
import { getChargeUrgency, sortChargesByPriority } from "@/lib/charge-priority";
import { buildCustomerEngagementInsights, buildCustomerPipelineItems } from "@/lib/customer-engagement-insights";
import { listCustomerWhatsappActivity } from "@/lib/customer-whatsapp-activity";
import { buildFiscalInsights } from "@/lib/fiscal-insights";
import { listCharges } from "@/lib/charge-repository";
import { listCustomers } from "@/lib/customer-repository";
import { getNfseNationalIssuePreview, listNfseDocuments, listNfseReadyQueue } from "@/lib/nfse-repository";
import { listOrders } from "@/lib/order-repository";
import { buildQuoteInsights } from "@/lib/quote-insights";
import { listQuotes } from "@/lib/quote-repository";
import type { PipelineColumn, Stat } from "@/lib/types";

type AgendaItem = {
  title: string;
  description: string;
};

type DashboardBaseData = {
  customers: Awaited<ReturnType<typeof listCustomers>>;
  quotes: Awaited<ReturnType<typeof listQuotes>>;
  charges: Awaited<ReturnType<typeof listCharges>>;
  orders: Awaited<ReturnType<typeof listOrders>>;
  nfseDocuments: Awaited<ReturnType<typeof listNfseDocuments>>;
  nfseReadyQueue: Awaited<ReturnType<typeof listNfseReadyQueue>>;
  chargeWhatsappSignals: Awaited<ReturnType<typeof listChargeWhatsappSignals>>;
  customerWhatsappActivity: Awaited<ReturnType<typeof listCustomerWhatsappActivity>>;
  fiscalInsights: ReturnType<typeof buildFiscalInsights>;
};

export type DashboardCadenceMetric = {
  label: string;
  value: string;
  helper: string;
};

export type DashboardCadenceRisk = {
  id: string;
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
};

export type DashboardReportSnapshot = {
  generatedAt: string;
  summary: Stat[];
  cadenceMetrics: DashboardCadenceMetric[];
  cadenceRisks: DashboardCadenceRisk[];
  cadenceLanes: DashboardCadenceLane[];
  recommendations: DashboardRecommendation[];
  agenda: AgendaItem[];
  topQuotes: ReturnType<typeof buildQuoteInsights>["items"];
  topCharges: ReturnType<typeof buildChargeFollowUpActions>;
  topCustomers: ReturnType<typeof buildCustomerEngagementInsights>["items"];
  fiscalItems: ReturnType<typeof buildFiscalInsights>["items"];
};

export type DashboardCadenceItem = {
  id: string;
  lane: "blocked" | "conversion" | "commitment";
  kicker: string;
  title: string;
  description: string;
  helper: string;
  href: string;
  hrefLabel: string;
  action?: {
    label: string;
    kind: "quote_followup" | "quote_approved" | "quote_to_charge" | "customer_status" | "charge_today";
    targetId: string;
    status?: string;
    note?: string;
    dueLabel?: string;
  };
};

export type DashboardCadenceLane = {
  id: DashboardCadenceItem["lane"];
  title: string;
  helper: string;
  items: DashboardCadenceItem[];
};

export type DashboardRecommendation = {
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
  priority: "critical" | "high" | "normal";
  kicker: string;
  action?: {
    label: string;
    kind: "quote_followup" | "quote_approved" | "quote_to_charge" | "customer_status" | "charge_today";
    targetId: string;
    status?: string;
    note?: string;
    dueLabel?: string;
  };
};

function parseCurrencyToNumber(value: string) {
  return Number(
    value
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim(),
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCountLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function getRecommendationWeight(priority: DashboardRecommendation["priority"]) {
  switch (priority) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "normal":
      return 2;
  }
}

function toCadenceLanes(items: DashboardCadenceItem[]): DashboardCadenceLane[] {
  const grouped = {
    blocked: items.filter((item) => item.lane === "blocked"),
    conversion: items.filter((item) => item.lane === "conversion"),
    commitment: items.filter((item) => item.lane === "commitment"),
  };

  return [
    {
      id: "blocked",
      title: "Travados",
      helper: "Itens que impedem insistir ou avançar sem leitura humana.",
      items: grouped.blocked.slice(0, 4),
    },
    {
      id: "conversion",
      title: "Próximas conversões",
      helper: "O que já pode virar cobrança, pedido ou resposta comercial.",
      items: grouped.conversion.slice(0, 4),
    },
    {
      id: "commitment",
      title: "Compromissos em acompanhamento",
      helper: "Promessas e prazos assumidos que pedem confirmação pontual.",
      items: grouped.commitment.slice(0, 4),
    },
  ];
}

function formatGeneratedAt(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const getDashboardBaseData = cache(async (): Promise<DashboardBaseData> => {
  const [customers, quotes, charges, orders, nfseDocuments, nfseReadyQueue, chargeWhatsappSignals, customerWhatsappActivity] = await Promise.all([
    listCustomers(),
    listQuotes(),
    listCharges(),
    listOrders(),
    listNfseDocuments(),
    listNfseReadyQueue(),
    listChargeWhatsappSignals().catch(() => []),
    listCustomerWhatsappActivity().catch(() => []),
  ]);

  const nfsePreviewEntries = await Promise.all(
    nfseDocuments.map(async (document) => [document.id, await getNfseNationalIssuePreview(document.id)] as const),
  );
  const fiscalInsights = buildFiscalInsights(nfseDocuments, new Map(nfsePreviewEntries));

  return {
    customers,
    quotes,
    charges,
    orders,
    nfseDocuments,
    nfseReadyQueue,
    chargeWhatsappSignals,
    customerWhatsappActivity,
    fiscalInsights,
  };
});

function countQuotesWithManualCadence(quotes: Awaited<ReturnType<typeof listQuotes>>) {
  return quotes.filter((quote) => quote.status !== "Aprovado" && !quote.cadence?.nextStepLabel).length;
}

function countChargesWithoutCadence(charges: Awaited<ReturnType<typeof listCharges>>) {
  return charges.filter((charge) => charge.status !== "Pago" && !charge.cadence?.nextStepLabel).length;
}

export async function getDashboardStats(): Promise<Stat[]> {
  const {
    customers,
    quotes,
    charges,
    orders,
    nfseDocuments,
    nfseReadyQueue,
    chargeWhatsappSignals,
    customerWhatsappActivity,
    fiscalInsights,
  } = await getDashboardBaseData();

  const activeQuotes = quotes.filter((quote) => quote.status !== "Aprovado");
  const openCharges = charges.filter((charge) => charge.status !== "Pago");
  const overdueCharges = openCharges.filter((charge) => getChargeUrgency(charge) === "overdue");
  const followUpSummary = summarizeChargeFollowUp(buildChargeFollowUpActions(charges));
  const openAmount = openCharges.reduce((total, charge) => total + parseCurrencyToNumber(charge.amount), 0);
  const activeOrders = orders.filter((order) => order.status !== "Concluido");
  const recurringCustomers = customers.filter((customer) => customer.status === "Recorrente").length;
  const fiscalPendingCount = nfseReadyQueue.length + nfseDocuments.filter((document) => document.status === "Rascunho" || document.status === "Pronta" || document.status === "Erro").length;
  const whatsappInsights = buildBillingWhatsappInsights(charges, chargeWhatsappSignals);
  const customerEngagement = buildCustomerEngagementInsights(customers, customerWhatsappActivity);

  return [
    {
      label: "Orçamentos ativos",
      value: String(quotes.length),
      helper: `${activeQuotes.length} aguardando resposta, follow-up ou aprovação final`,
    },
    {
      label: "Recebimentos pendentes",
      value: formatCurrency(openAmount),
      helper:
        followUpSummary.slaOverdueCount > 0
          ? `${followUpSummary.slaOverdueCount} follow-up(s) financeiros já estão com SLA vencido`
          : overdueCharges.length > 0
            ? `${overdueCharges.length} cobranças já estão atrasadas e puxam a fila`
            : followUpSummary.helper,
    },
    {
      label: "Operação em andamento",
      value: String(activeOrders.length),
      helper:
        fiscalPendingCount > 0
          ? `${fiscalPendingCount} item(ns) já estão na fila fiscal`
          : followUpSummary.waitingCount > 0
            ? `${followUpSummary.waitingCount} cobranças estão aguardando retorno do cliente`
            : `${recurringCustomers} clientes recorrentes sustentam base de previsibilidade`,
    },
    {
      label: "WhatsApp financeiro",
      value: String(whatsappInsights.summary.openReplyCount),
      helper:
        whatsappInsights.summary.contestedCount > 0
          ? `${whatsappInsights.summary.contestedCount} resposta(s) pedem tratamento antes de nova cobrança`
          : whatsappInsights.summary.promisedCount > 0
            ? `${whatsappInsights.summary.promisedCount} cliente(s) prometeram pagar e merecem acompanhamento`
            : whatsappInsights.summary.unresolvedReplyCount > 0
              ? `${whatsappInsights.summary.unresolvedReplyCount} retorno(s) ainda aguardam leitura humana`
              : "Sem respostas recentes no canal financeiro agora.",
    },
    {
      label: "Relacionamento ativo",
      value: String(customerEngagement.summary.hotCount + customerEngagement.summary.followUpCount),
      helper:
        customerEngagement.summary.reactivationCount > 0
          ? `${customerEngagement.summary.reactivationCount} cliente(s) já entram no radar de reativação`
          : customerEngagement.summary.hotCount > 0
            ? `${customerEngagement.summary.hotCount} cliente(s) estão quentes no canal agora`
            : `${recurringCustomers} cliente(s) sustentam a base recorrente sem urgência comercial`,
    },
    {
      label: "Fila fiscal",
      value: String(fiscalPendingCount),
      helper:
        fiscalInsights.summary.blockedCount > 0
          ? `${fiscalInsights.summary.blockedCount} documento(s) travam por pendência estrutural`
          : fiscalInsights.summary.reviewCount > 0
            ? `${fiscalInsights.summary.reviewCount} documento(s) pedem revisão antes de emitir`
            : fiscalInsights.summary.readyCount > 0
              ? `${fiscalInsights.summary.readyCount} documento(s) já estão prontos para seguir`
              : "Sem pressão fiscal imediata agora.",
    },
  ];
}

export async function getDashboardPipeline(): Promise<PipelineColumn[]> {
  const { customers, quotes, orders, customerWhatsappActivity } = await getDashboardBaseData();

  const newConversations = buildCustomerPipelineItems(customers, customerWhatsappActivity);

  const activeQuotes = quotes
    .filter((quote) => quote.status !== "Aprovado")
    .slice(0, 4)
    .map((quote) => ({
      title: quote.customer,
      subtitle: `${quote.amount} em ${quote.title}`,
      meta: quote.dueLabel,
    }));

  const activeOrders = orders
    .filter((order) => order.status !== "Concluido")
    .slice(0, 4)
    .map((order) => ({
      title: order.customer,
      subtitle: `${order.title} · ${order.amount}`,
      meta: order.note,
    }));

  return [
    {
      title: "Novas conversas",
      total: String(newConversations.length),
      items:
        newConversations.length > 0
          ? newConversations
          : [
              {
                title: "Sem retornos urgentes",
                subtitle: "Nenhum cliente parado no momento",
                meta: "A base atual não mostra gargalo de primeira resposta.",
              },
            ],
    },
    {
      title: "Orçamentos enviados",
      total: String(activeQuotes.length),
      items:
        activeQuotes.length > 0
          ? activeQuotes
          : [
              {
                title: "Sem follow-up aberto",
                subtitle: "Nenhum orçamento aguardando resposta",
                meta: "O próximo passo pode ser gerar novas propostas.",
              },
            ],
    },
    {
      title: "Pedidos em andamento",
      total: String(activeOrders.length),
      items:
        activeOrders.length > 0
          ? activeOrders
          : [
              {
                title: "Operação sem fila",
                subtitle: "Nenhum pedido em andamento agora",
                meta: "Quando um orçamento aprovar, ele passa a aparecer aqui.",
              },
            ],
    },
  ];
}

export async function getTodayAgenda(): Promise<AgendaItem[]> {
  const {
    customers,
    quotes,
    charges,
    orders,
    nfseDocuments,
    nfseReadyQueue,
    chargeWhatsappSignals,
    customerWhatsappActivity,
    fiscalInsights,
  } = await getDashboardBaseData();

  const prioritizedCharges = sortChargesByPriority(charges.filter((charge) => charge.status !== "Pago"));
  const followUpActions = buildChargeFollowUpActions(charges);
  const followUpSummary = summarizeChargeFollowUp(followUpActions);
  const overdueCharges = prioritizedCharges.filter((charge) => getChargeUrgency(charge) === "overdue");
  const dueTodayCharges = prioritizedCharges.filter((charge) => getChargeUrgency(charge) === "today");
  const nextCharge = prioritizedCharges.find((charge) => getChargeUrgency(charge) === "upcoming");
  const nextAutomaticFollowUp = followUpActions[0];
  const pendingQuotes = quotes.filter((quote) => quote.status === "Follow-up" || quote.status === "Enviado");
  const approvedQuotes = quotes.filter((quote) => quote.status === "Aprovado");
  const ongoingOrders = orders.filter((order) => order.status === "Pendente" || order.status === "Agendado");
  const waitingCustomers = customers.filter((customer) => customer.status === "Aguardando retorno");
  const fiscalReadyCount = nfseReadyQueue.length;
  const fiscalErrorCount = nfseDocuments.filter((document) => document.status === "Erro").length;
  const whatsappInsights = buildBillingWhatsappInsights(charges, chargeWhatsappSignals);
  const customerEngagement = buildCustomerEngagementInsights(customers, customerWhatsappActivity);

  const agenda: AgendaItem[] = [
    {
      title:
        overdueCharges.length > 0
          ? `Resolver ${formatCountLabel(overdueCharges.length, "cobrança", "cobranças")} atrasadas`
          : `Cobrar ${formatCountLabel(dueTodayCharges.length, "cliente", "clientes")} com vencimento imediato`,
      description:
        followUpSummary.slaOverdueCount > 0
          ? "Existe follow-up financeiro com SLA vencido e ele precisa entrar antes do restante da operação."
          : overdueCharges.length > 0
            ? "As cobranças com vencimento passado precisam aparecer antes de qualquer nova rotina comercial."
            : dueTodayCharges.length > 0
              ? "As cobranças que vencem hoje devem virar prioridade operacional do financeiro."
              : nextAutomaticFollowUp
                ? `${nextAutomaticFollowUp.customer} já está no topo da cadência automática de follow-up.`
                : nextCharge
                  ? `A próxima cobrança com data real é de ${nextCharge.customer}, então o caixa já tem fila previsível.`
                  : followUpSummary.helper,
    },
    {
      title: `Retomar ${formatCountLabel(pendingQuotes.length, "orçamento", "orçamentos")} em aberto`,
      description:
        pendingQuotes.length > 0
          ? "Existe follow-up comercial pendente que pode virar venda sem criar novas propostas."
          : "Os orçamentos atuais não estão pedindo follow-up imediato.",
    },
    {
      title: `Converter ${formatCountLabel(approvedQuotes.length, "aprovação", "aprovações")} em operação ou cobrança`,
      description:
        approvedQuotes.length > ongoingOrders.length
          ? "Há aprovações disponíveis para empurrar o fluxo de pedido e recebimento."
          : "As aprovações atuais já estão relativamente bem encaixadas na operação.",
    },
    {
      title: `Preparar ${formatCountLabel(fiscalReadyCount, "NFS-e", "NFS-e")} a partir do caixa`,
      description:
        fiscalErrorCount > 0
          ? `${fiscalErrorCount} documento(s) fiscal(is) pedem revisão antes da emissão.`
          : fiscalReadyCount > 0
            ? "Os recebimentos confirmados já podem virar rascunho fiscal sem redigitar dados."
            : "Nenhum recebimento novo está aguardando preparação fiscal agora.",
    },
    {
      title: `Acompanhar ${formatCountLabel(waitingCustomers.length, "cliente", "clientes")} sem retorno`,
      description:
        waitingCustomers.length > 0
          ? "A base mostra clientes que ainda pedem reativação comercial ou resposta curta."
          : "Nenhum cliente marcado como aguardando retorno neste momento.",
    },
  ];

  if (ongoingOrders.length > 0) {
    agenda.splice(2, 0, {
      title: `Executar ${formatCountLabel(ongoingOrders.length, "pedido", "pedidos")} em andamento`,
      description: "A operação já tem pedidos abertos e precisa fechar entrega sem perder o ritmo de cobrança.",
    });
  }

  if (whatsappInsights.summary.contestedCount > 0 || whatsappInsights.summary.unresolvedReplyCount > 0) {
    agenda.unshift({
      title:
        whatsappInsights.summary.contestedCount > 0
          ? `Tratar ${formatCountLabel(whatsappInsights.summary.contestedCount, "contestação", "contestações")} no WhatsApp`
          : `Ler ${formatCountLabel(whatsappInsights.summary.unresolvedReplyCount, "resposta", "respostas")} do financeiro`,
      description:
        whatsappInsights.summary.contestedCount > 0
          ? "O canal já devolveu objeções em cobranças abertas e vale resolver isso antes de insistir no recebimento."
          : "Existem retornos recentes no WhatsApp que ainda não foram incorporados ao follow-up financeiro.",
    });
  } else if (whatsappInsights.summary.promisedCount > 0) {
    agenda.unshift({
      title: `Acompanhar ${formatCountLabel(whatsappInsights.summary.promisedCount, "promessa", "promessas")} de pagamento`,
      description: "Clientes já sinalizaram intenção de pagar e agora o melhor movimento é acompanhar, não reenviar no escuro.",
    });
  }

  if (customerEngagement.summary.hotCount > 0) {
    agenda.unshift({
      title: `Responder ${formatCountLabel(customerEngagement.summary.hotCount, "cliente quente", "clientes quentes")}`,
      description: "O canal já mostrou atividade recente e vale aproveitar esse calor antes de esfriar a conversa.",
    });
  } else if (customerEngagement.summary.reactivationCount > 0) {
    agenda.push({
      title: `Reativar ${formatCountLabel(customerEngagement.summary.reactivationCount, "cliente", "clientes")} da base`,
      description: "A base já mostra espaço claro para retomada comercial com número cadastrado e pouco sinal recente.",
    });
  }

  if (fiscalInsights.summary.blockedCount > 0) {
    agenda.unshift({
      title: `Destravar ${formatCountLabel(fiscalInsights.summary.blockedCount, "documento fiscal", "documentos fiscais")}`,
      description: "Existem itens na fila fiscal parados por pendência estrutural e isso deve ser resolvido antes de acumular emissão.",
    });
  } else if (fiscalInsights.summary.readyCount > 0) {
    agenda.push({
      title: `Emitir ${formatCountLabel(fiscalInsights.summary.readyCount, "documento pronto", "documentos prontos")}`,
      description: "A fila fiscal já tem itens aptos para emissão sem novo retrabalho operacional.",
    });
  }

  return agenda.slice(0, 4);
}

export async function getDashboardRecommendations(): Promise<DashboardRecommendation[]> {
  const {
    customers,
    quotes,
    charges,
    chargeWhatsappSignals,
    customerWhatsappActivity,
    fiscalInsights,
  } = await getDashboardBaseData();

  const billingInsights = buildBillingWhatsappInsights(charges, chargeWhatsappSignals);
  const customerInsights = buildCustomerEngagementInsights(customers, customerWhatsappActivity);
  const quoteInsights = buildQuoteInsights(quotes, customers, customerWhatsappActivity);

  const recommendations: DashboardRecommendation[] = [];

  const contestedItem = billingInsights.items.find((item) => item.suggestedOutcome === "Contestou" && item.requiresHumanAction);

  if (contestedItem) {
    recommendations.push({
      kicker: "Financeiro",
      title: `Tratar contestação de ${contestedItem.customer}`,
      description: "O cliente respondeu no WhatsApp com objeção e vale resolver isso antes de insistir em nova cobrança.",
      href: "/dashboard/billing?focus=contestations&view=triage",
      hrefLabel: "Abrir cobranças",
      priority: "critical",
    });
  }

  const blockedFiscal = fiscalInsights.items.find((item) => item.priority === "blocked");

  if (blockedFiscal) {
    recommendations.push({
      kicker: "Fiscal",
      title: `Destravar documento de ${blockedFiscal.customer}`,
      description: blockedFiscal.helper,
      href: "/dashboard/fiscal?focus=blocked&view=blocked",
      hrefLabel: "Abrir fiscal",
      priority: "critical",
    });
  }

  const hotQuote = quoteInsights.items.find((item) => item.priority === "hot");

  if (hotQuote) {
    recommendations.push({
      kicker: "Comercial",
      title: `Retomar proposta de ${hotQuote.customer}`,
      description: hotQuote.helper,
      href: "/dashboard/quotes?focus=hot&view=hot",
      hrefLabel: "Abrir orçamentos",
      priority: "high",
      action: hotQuote.status !== "Follow-up"
        ? {
          label: "Marcar follow-up hoje",
          kind: "quote_followup",
          targetId: hotQuote.quoteId,
          dueLabel: "Follow-up hoje",
        }
        : undefined,
    });
  }

  const approvedQuote = quoteInsights.items.find((item) => item.status === "Aprovado");

  if (approvedQuote) {
    recommendations.push({
      kicker: "Conversão",
      title: `Transformar ${approvedQuote.customer} em cobrança`,
      description: "A proposta já foi aprovada e pode virar recebimento no fluxo operacional sem retrabalho.",
      href: "/dashboard/quotes?focus=approved&view=approved",
      hrefLabel: "Ver proposta",
      priority: "high",
      action: {
        label: "Gerar cobrança agora",
        kind: "quote_to_charge",
        targetId: approvedQuote.quoteId,
      },
    });
  }

  const hotCustomer = customerInsights.items.find((item) => item.priority === "hot");

  if (hotCustomer) {
    recommendations.push({
      kicker: "Relacionamento",
      title: `Responder ${hotCustomer.customerName}`,
      description: hotCustomer.helper,
      href: "/dashboard/customers?focus=hot&view=hot",
      hrefLabel: "Abrir clientes",
      priority: "high",
      action: hotCustomer.status !== "Aguardando retorno"
        ? {
          label: "Marcar aguardando retorno",
          kind: "customer_status",
          targetId: hotCustomer.customerId,
          status: "Aguardando retorno",
          note: "Cliente quente no canal e em acompanhamento ativo.",
        }
        : undefined,
    });
  }

  const promisedPayment = billingInsights.items.find((item) => item.suggestedOutcome === "Prometeu pagar");

  if (promisedPayment) {
    recommendations.push({
      kicker: "Caixa",
      title: `Acompanhar promessa de ${promisedPayment.customer}`,
      description: "O cliente já sinalizou intenção de pagar, então o melhor próximo passo é acompanhamento pontual.",
      href: "/dashboard/billing?focus=promises&view=waiting",
      hrefLabel: "Acompanhar recebimento",
      priority: "normal",
      action: {
        label: "Puxar cobrança para hoje",
        kind: "charge_today",
        targetId: promisedPayment.chargeId,
      },
    });
  }

  const readyFiscal = fiscalInsights.items.find((item) => item.priority === "ready");

  if (readyFiscal) {
    recommendations.push({
      kicker: "Emissão",
      title: `Emitir documento de ${readyFiscal.customer}`,
      description: "A fila fiscal já tem documento pronto para seguir sem novo retrabalho operacional.",
      href: "/dashboard/fiscal?focus=ready&view=ready",
      hrefLabel: "Emitir NFS-e",
      priority: "normal",
    });
  }

  const reactivationCustomer = customerInsights.items.find((item) => item.priority === "reactivation");

  if (reactivationCustomer) {
    recommendations.push({
      kicker: "Base",
      title: `Reativar ${reactivationCustomer.customerName}`,
      description: reactivationCustomer.helper,
      href: "/dashboard/customers?focus=reactivation&view=reactivation",
      hrefLabel: "Ver base de clientes",
      priority: "normal",
      action: reactivationCustomer.status !== "Aguardando retorno"
        ? {
          label: "Entrar em reativação",
          kind: "customer_status",
          targetId: reactivationCustomer.customerId,
          status: "Aguardando retorno",
          note: "Cliente entrou na fila de reativação comercial.",
        }
        : undefined,
    });
  }

  return recommendations
    .sort((left, right) => getRecommendationWeight(left.priority) - getRecommendationWeight(right.priority))
    .slice(0, 6);
}

export async function getDashboardCadenceLanes(): Promise<DashboardCadenceLane[]> {
  const {
    customers,
    quotes,
    charges,
    chargeWhatsappSignals,
    customerWhatsappActivity,
    fiscalInsights,
  } = await getDashboardBaseData();

  const billingInsights = buildBillingWhatsappInsights(charges, chargeWhatsappSignals);
  const quoteInsights = buildQuoteInsights(quotes, customers, customerWhatsappActivity);
  const chargeActions = buildChargeFollowUpActions(charges);

  const items: DashboardCadenceItem[] = [];

  const contestedCharge = billingInsights.items.find((item) => item.suggestedOutcome === "Contestou" && item.requiresHumanAction);
  if (contestedCharge) {
    items.push({
      id: `blocked-charge-${contestedCharge.chargeId}`,
      lane: "blocked",
      kicker: "Financeiro",
      title: `Contestação de ${contestedCharge.customer}`,
      description: "O cliente contestou a cobrança e a cadência precisa parar para leitura humana.",
      helper: "Resolver objeção antes de novo disparo.",
      href: "/dashboard/billing?focus=contestations&view=triage",
      hrefLabel: "Abrir cobrança",
    });
  }

  const blockedFiscal = fiscalInsights.items.find((item) => item.priority === "blocked");
  if (blockedFiscal) {
    items.push({
      id: `blocked-fiscal-${blockedFiscal.documentId}`,
      lane: "blocked",
      kicker: "Fiscal",
      title: `Documento travado de ${blockedFiscal.customer}`,
      description: blockedFiscal.helper,
      helper: "Sem resolver isso, a emissão acumula gargalo.",
      href: "/dashboard/fiscal?focus=blocked&view=blocked",
      hrefLabel: "Abrir fiscal",
    });
  }

  const hotQuote = quoteInsights.items.find((item) => item.priority === "hot");
  if (hotQuote) {
    items.push({
      id: `conversion-hot-${hotQuote.quoteId}`,
      lane: "conversion",
      kicker: "Comercial",
      title: `Responder ${hotQuote.customer}`,
      description: hotQuote.completedStepLabel,
      helper: hotQuote.nextStepLabel,
      href: "/dashboard/quotes?focus=hot&view=hot",
      hrefLabel: "Abrir proposta",
      action: hotQuote.status !== "Follow-up"
        ? {
          label: "Entrar em follow-up",
          kind: "quote_followup",
          targetId: hotQuote.quoteId,
          dueLabel: "Follow-up hoje",
        }
        : undefined,
    });
  }

  const approvedQuote = quoteInsights.items.find((item) => item.status === "Aprovado");
  if (approvedQuote) {
    items.push({
      id: `conversion-approved-${approvedQuote.quoteId}`,
      lane: "conversion",
      kicker: "Conversão",
      title: `Cobrar ${approvedQuote.customer}`,
      description: approvedQuote.completedStepLabel,
      helper: approvedQuote.nextStepLabel,
      href: "/dashboard/quotes?focus=approved&view=approved",
      hrefLabel: "Abrir proposta",
      action: {
        label: "Gerar cobrança",
        kind: "quote_to_charge",
        targetId: approvedQuote.quoteId,
      },
    });
  }

  const promisedCharge = chargeActions.find((item) => item.completedStepLabel === "Cliente prometeu regularizar");
  if (promisedCharge) {
    items.push({
      id: `commitment-promise-${promisedCharge.id}`,
      lane: "commitment",
      kicker: "Caixa",
      title: `Confirmar promessa de ${promisedCharge.customer}`,
      description: promisedCharge.completedStepLabel,
      helper: promisedCharge.nextStepLabel,
      href: "/dashboard/billing?focus=promises&view=waiting",
      hrefLabel: "Abrir cobrança",
      action: promisedCharge.urgency !== "today"
        ? {
          label: "Puxar para hoje",
          kind: "charge_today",
          targetId: promisedCharge.id,
        }
        : undefined,
    });
  }

  const rescheduledCharge = chargeActions.find((item) => item.completedStepLabel === "Cliente pediu novo prazo");
  if (rescheduledCharge) {
    items.push({
      id: `commitment-rescheduled-${rescheduledCharge.id}`,
      lane: "commitment",
      kicker: "Prazo",
      title: `Acompanhar novo prazo de ${rescheduledCharge.customer}`,
      description: rescheduledCharge.completedStepLabel,
      helper: rescheduledCharge.nextStepLabel,
      href: "/dashboard/billing?view=waiting",
      hrefLabel: "Abrir cobrança",
    });
  }

  return toCadenceLanes(items);
}

export async function getDashboardCadenceMetrics(): Promise<DashboardCadenceMetric[]> {
  const { quotes, charges, chargeWhatsappSignals } = await getDashboardBaseData();

  const quoteInsights = buildQuoteInsights(quotes, [], []);
  const chargeActions = buildChargeFollowUpActions(charges);
  const billingInsights = buildBillingWhatsappInsights(charges, chargeWhatsappSignals);
  const waitingCommitments = chargeActions.filter((item) => item.completedStepLabel === "Cliente prometeu regularizar" || item.completedStepLabel === "Cliente pediu novo prazo").length;
  const blockedCount = billingInsights.items.filter((item) => item.suggestedOutcome === "Contestou" && item.requiresHumanAction).length;
  const manualQuotes = countQuotesWithManualCadence(quotes);
  const manualCharges = countChargesWithoutCadence(charges);

  return [
    {
      label: "Conversões armadas",
      value: String(quoteInsights.summary.approvedCount + quoteInsights.summary.hotCount),
      helper: "Itens comerciais que já têm contexto suficiente para virar resposta ou cobrança.",
    },
    {
      label: "Compromissos ativos",
      value: String(waitingCommitments),
      helper: "Promessas e novos prazos que pedem confirmação pontual na cadência financeira.",
    },
    {
      label: "Bloqueios humanos",
      value: String(blockedCount),
      helper: blockedCount > 0
        ? "Existem objeções explícitas no financeiro travando o próximo toque."
        : "Nenhum bloqueio humano crítico no financeiro agora.",
    },
    {
      label: "Cadência manual",
      value: String(manualQuotes + manualCharges),
      helper: manualQuotes + manualCharges > 0
        ? "Itens ainda sem etapa persistida explícita e dependentes de leitura inferida."
        : "Comercial e financeiro já estão com cadência persistida nos itens ativos.",
    },
  ];
}

export async function getDashboardCadenceRisks(): Promise<DashboardCadenceRisk[]> {
  const { quotes, charges, chargeWhatsappSignals, nfseDocuments } = await getDashboardBaseData();

  const quoteInsights = buildQuoteInsights(quotes, [], []);
  const chargeActions = buildChargeFollowUpActions(charges);
  const billingInsights = buildBillingWhatsappInsights(charges, chargeWhatsappSignals);
  const risks: DashboardCadenceRisk[] = [];

  const staleWaitingQuotes = quoteInsights.items.filter((item) => item.priority === "waiting").slice(0, 1);
  for (const quote of staleWaitingQuotes) {
    risks.push({
      id: `risk-quote-${quote.quoteId}`,
      title: `Proposta parada com ${quote.customer}`,
      description: `${quote.completedStepLabel}. ${quote.nextStepLabel}.`,
      href: "/dashboard/quotes?view=waiting",
      hrefLabel: "Abrir orçamentos",
    });
  }

  const stalePromises = chargeActions.filter((item) => item.completedStepLabel === "Cliente prometeu regularizar").slice(0, 1);
  for (const charge of stalePromises) {
    risks.push({
      id: `risk-charge-${charge.id}`,
      title: `Promessa sem confirmação de ${charge.customer}`,
      description: `${charge.completedStepLabel}. ${charge.nextStepLabel}.`,
      href: "/dashboard/billing?focus=promises&view=waiting",
      hrefLabel: "Abrir cobranças",
    });
  }

  const contested = billingInsights.items.find((item) => item.suggestedOutcome === "Contestou" && item.requiresHumanAction);
  if (contested) {
    risks.push({
      id: `risk-contested-${contested.chargeId}`,
      title: `Objeção aberta de ${contested.customer}`,
      description: "O cliente contestou a cobrança e o fluxo não deveria seguir no automático.",
      href: "/dashboard/billing?focus=contestations&view=triage",
      hrefLabel: "Tratar objeção",
    });
  }

  const fiscalErrors = nfseDocuments.filter((item) => item.status === "Erro").slice(0, 1);
  for (const document of fiscalErrors) {
    risks.push({
      id: `risk-fiscal-${document.id}`,
      title: `Fiscal em erro para ${document.customer}`,
      description: "O ciclo já recebeu ou avançou, mas a emissão fiscal ficou para trás.",
      href: "/dashboard/fiscal?view=review",
      hrefLabel: "Abrir fiscal",
    });
  }

  if (countQuotesWithManualCadence(quotes) + countChargesWithoutCadence(charges) > 0) {
    risks.push({
      id: "risk-manual-cadence",
      title: "Itens ainda sem cadência persistida",
      description: "Parte da operação ainda depende de leitura inferida em vez de etapa gravada explicitamente.",
      href: "/dashboard/quotes",
      hrefLabel: "Revisar operação",
    });
  }

  return risks.slice(0, 4);
}

export async function getDashboardReportSnapshot(): Promise<DashboardReportSnapshot> {
  const baseData = await getDashboardBaseData();
  const [
    summary,
    cadenceMetrics,
    cadenceRisks,
    cadenceLanes,
    recommendations,
    agenda,
  ] = await Promise.all([
    getDashboardStats(),
    getDashboardCadenceMetrics(),
    getDashboardCadenceRisks(),
    getDashboardCadenceLanes(),
    getDashboardRecommendations(),
    getTodayAgenda(),
  ]);

  const topQuotes = buildQuoteInsights(baseData.quotes, baseData.customers, baseData.customerWhatsappActivity).items.slice(0, 10);
  const topCharges = buildChargeFollowUpActions(baseData.charges).slice(0, 10);
  const topCustomers = buildCustomerEngagementInsights(baseData.customers, baseData.customerWhatsappActivity).items.slice(0, 10);
  const fiscalItems = baseData.fiscalInsights.items.slice(0, 10);

  return {
    generatedAt: formatGeneratedAt(),
    summary,
    cadenceMetrics,
    cadenceRisks,
    cadenceLanes,
    recommendations,
    agenda,
    topQuotes,
    topCharges,
    topCustomers,
    fiscalItems,
  };
}
