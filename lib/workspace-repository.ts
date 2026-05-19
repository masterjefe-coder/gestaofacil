import { buildChargeFollowUpActions, summarizeChargeFollowUp } from "@/lib/charge-follow-up";
import { getChargeUrgency, sortChargesByPriority } from "@/lib/charge-priority";
import { listCharges } from "@/lib/charge-repository";
import { listCustomers } from "@/lib/customer-repository";
import { listNfseDocuments, listNfseReadyQueue } from "@/lib/nfse-repository";
import { listOrders } from "@/lib/order-repository";
import { listQuotes } from "@/lib/quote-repository";
import type { PipelineColumn, Stat } from "@/lib/types";

type AgendaItem = {
  title: string;
  description: string;
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

export async function getDashboardStats(): Promise<Stat[]> {
  const [customers, quotes, charges, orders, nfseDocuments, nfseReadyQueue] = await Promise.all([
    listCustomers(),
    listQuotes(),
    listCharges(),
    listOrders(),
    listNfseDocuments(),
    listNfseReadyQueue(),
  ]);

  const activeQuotes = quotes.filter((quote) => quote.status !== "Aprovado");
  const openCharges = charges.filter((charge) => charge.status !== "Pago");
  const overdueCharges = openCharges.filter((charge) => getChargeUrgency(charge) === "overdue");
  const followUpSummary = summarizeChargeFollowUp(buildChargeFollowUpActions(charges));
  const openAmount = openCharges.reduce((total, charge) => total + parseCurrencyToNumber(charge.amount), 0);
  const activeOrders = orders.filter((order) => order.status !== "Concluido");
  const recurringCustomers = customers.filter((customer) => customer.status === "Recorrente").length;
  const fiscalPendingCount = nfseReadyQueue.length + nfseDocuments.filter((document) => document.status === "Rascunho" || document.status === "Pronta" || document.status === "Erro").length;

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
  ];
}

export async function getDashboardPipeline(): Promise<PipelineColumn[]> {
  const [customers, quotes, orders] = await Promise.all([listCustomers(), listQuotes(), listOrders()]);

  const newConversations = customers
    .filter((customer) => customer.status === "Aguardando retorno")
    .slice(0, 4)
    .map((customer) => ({
      title: customer.name,
      subtitle: customer.segment,
      meta: customer.note,
    }));

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
  const [customers, quotes, charges, orders, nfseDocuments, nfseReadyQueue] = await Promise.all([
    listCustomers(),
    listQuotes(),
    listCharges(),
    listOrders(),
    listNfseDocuments(),
    listNfseReadyQueue(),
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

  return agenda.slice(0, 4);
}
