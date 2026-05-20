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

export type DashboardRecommendation = {
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
  priority: "critical" | "high" | "normal";
  kicker: string;
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

export async function getDashboardStats(): Promise<Stat[]> {
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
  const nfsePreviewEntries = await Promise.all(
    nfseDocuments.map(async (document) => [document.id, await getNfseNationalIssuePreview(document.id)] as const),
  );
  const fiscalInsights = buildFiscalInsights(nfseDocuments, new Map(nfsePreviewEntries));

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
  const [customers, quotes, orders, customerWhatsappActivity] = await Promise.all([
    listCustomers(),
    listQuotes(),
    listOrders(),
    listCustomerWhatsappActivity().catch(() => []),
  ]);

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
  const nfsePreviewEntries = await Promise.all(
    nfseDocuments.map(async (document) => [document.id, await getNfseNationalIssuePreview(document.id)] as const),
  );
  const fiscalInsights = buildFiscalInsights(nfseDocuments, new Map(nfsePreviewEntries));

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
  const [
    customers,
    quotes,
    charges,
    nfseDocuments,
    chargeWhatsappSignals,
    customerWhatsappActivity,
  ] = await Promise.all([
    listCustomers(),
    listQuotes(),
    listCharges(),
    listNfseDocuments(),
    listChargeWhatsappSignals().catch(() => []),
    listCustomerWhatsappActivity().catch(() => []),
  ]);

  const billingInsights = buildBillingWhatsappInsights(charges, chargeWhatsappSignals);
  const customerInsights = buildCustomerEngagementInsights(customers, customerWhatsappActivity);
  const quoteInsights = buildQuoteInsights(quotes, customers, customerWhatsappActivity);
  const nfsePreviewEntries = await Promise.all(
    nfseDocuments.map(async (document) => [document.id, await getNfseNationalIssuePreview(document.id)] as const),
  );
  const fiscalInsights = buildFiscalInsights(nfseDocuments, new Map(nfsePreviewEntries));

  const recommendations: DashboardRecommendation[] = [];

  const contestedItem = billingInsights.items.find((item) => item.suggestedOutcome === "Contestou" && item.requiresHumanAction);

  if (contestedItem) {
    recommendations.push({
      kicker: "Financeiro",
      title: `Tratar contestação de ${contestedItem.customer}`,
      description: "O cliente respondeu no WhatsApp com objeção e vale resolver isso antes de insistir em nova cobrança.",
      href: "/dashboard/billing",
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
      href: "/dashboard/fiscal",
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
      href: "/dashboard/quotes",
      hrefLabel: "Abrir orçamentos",
      priority: "high",
    });
  }

  const hotCustomer = customerInsights.items.find((item) => item.priority === "hot");

  if (hotCustomer) {
    recommendations.push({
      kicker: "Relacionamento",
      title: `Responder ${hotCustomer.customerName}`,
      description: hotCustomer.helper,
      href: "/dashboard/customers",
      hrefLabel: "Abrir clientes",
      priority: "high",
    });
  }

  const promisedPayment = billingInsights.items.find((item) => item.suggestedOutcome === "Prometeu pagar");

  if (promisedPayment) {
    recommendations.push({
      kicker: "Caixa",
      title: `Acompanhar promessa de ${promisedPayment.customer}`,
      description: "O cliente já sinalizou intenção de pagar, então o melhor próximo passo é acompanhamento pontual.",
      href: "/dashboard/billing",
      hrefLabel: "Acompanhar recebimento",
      priority: "normal",
    });
  }

  const readyFiscal = fiscalInsights.items.find((item) => item.priority === "ready");

  if (readyFiscal) {
    recommendations.push({
      kicker: "Emissão",
      title: `Emitir documento de ${readyFiscal.customer}`,
      description: "A fila fiscal já tem documento pronto para seguir sem novo retrabalho operacional.",
      href: "/dashboard/fiscal",
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
      href: "/dashboard/customers",
      hrefLabel: "Ver base de clientes",
      priority: "normal",
    });
  }

  return recommendations
    .sort((left, right) => getRecommendationWeight(left.priority) - getRecommendationWeight(right.priority))
    .slice(0, 6);
}
