import { getChargeUrgency, sortChargesByPriority } from "@/lib/charge-priority";
import { listCharges } from "@/lib/charge-repository";
import { listCustomers } from "@/lib/customer-repository";
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
  const [customers, quotes, charges, orders] = await Promise.all([
    listCustomers(),
    listQuotes(),
    listCharges(),
    listOrders(),
  ]);

  const activeQuotes = quotes.filter((quote) => quote.status !== "Aprovado");
  const openCharges = charges.filter((charge) => charge.status !== "Pago");
  const overdueCharges = openCharges.filter((charge) => getChargeUrgency(charge) === "overdue");
  const openAmount = openCharges.reduce((total, charge) => total + parseCurrencyToNumber(charge.amount), 0);
  const activeOrders = orders.filter((order) => order.status !== "Concluido");
  const recurringCustomers = customers.filter((customer) => customer.status === "Recorrente").length;

  return [
    {
      label: "Orcamentos ativos",
      value: String(quotes.length),
      helper: `${activeQuotes.length} aguardando resposta, follow-up ou aprovacao final`,
    },
    {
      label: "Recebimentos pendentes",
      value: formatCurrency(openAmount),
      helper:
        overdueCharges.length > 0
          ? `${overdueCharges.length} cobrancas ja estao atrasadas e puxam a fila`
          : `${openCharges.length} cobrancas exigem atencao hoje ou nos proximos passos`,
    },
    {
      label: "Operacao em andamento",
      value: String(activeOrders.length),
      helper: `${recurringCustomers} clientes recorrentes sustentam base de previsibilidade`,
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
                meta: "A base atual nao mostra gargalo de primeira resposta.",
              },
            ],
    },
    {
      title: "Orcamentos enviados",
      total: String(activeQuotes.length),
      items:
        activeQuotes.length > 0
          ? activeQuotes
          : [
              {
                title: "Sem follow-up aberto",
                subtitle: "Nenhum orcamento aguardando resposta",
                meta: "O proximo passo pode ser gerar novas propostas.",
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
                title: "Operacao sem fila",
                subtitle: "Nenhum pedido em andamento agora",
                meta: "Quando um orcamento aprovar, ele passa a aparecer aqui.",
              },
            ],
    },
  ];
}

export async function getTodayAgenda(): Promise<AgendaItem[]> {
  const [customers, quotes, charges, orders] = await Promise.all([
    listCustomers(),
    listQuotes(),
    listCharges(),
    listOrders(),
  ]);

  const prioritizedCharges = sortChargesByPriority(charges.filter((charge) => charge.status !== "Pago"));
  const overdueCharges = prioritizedCharges.filter((charge) => getChargeUrgency(charge) === "overdue");
  const dueTodayCharges = prioritizedCharges.filter((charge) => getChargeUrgency(charge) === "today");
  const nextCharge = prioritizedCharges.find((charge) => getChargeUrgency(charge) === "upcoming");
  const pendingQuotes = quotes.filter((quote) => quote.status === "Follow-up" || quote.status === "Enviado");
  const approvedQuotes = quotes.filter((quote) => quote.status === "Aprovado");
  const ongoingOrders = orders.filter((order) => order.status === "Pendente" || order.status === "Agendado");
  const waitingCustomers = customers.filter((customer) => customer.status === "Aguardando retorno");

  const agenda: AgendaItem[] = [
    {
      title:
        overdueCharges.length > 0
          ? `Resolver ${formatCountLabel(overdueCharges.length, "cobranca", "cobrancas")} atrasadas`
          : `Cobrar ${formatCountLabel(dueTodayCharges.length, "cliente", "clientes")} com vencimento imediato`,
      description:
        overdueCharges.length > 0
          ? "As cobrancas com vencimento passado precisam aparecer antes de qualquer nova rotina comercial."
          : dueTodayCharges.length > 0
            ? "As cobrancas que vencem hoje devem virar prioridade operacional do financeiro."
            : nextCharge
              ? `A proxima cobranca com data real e de ${nextCharge.customer}, entao o caixa ja tem fila previsivel.`
              : "Nenhuma cobranca com data real pede acao imediata agora.",
    },
    {
      title: `Retomar ${formatCountLabel(pendingQuotes.length, "orcamento", "orcamentos")} em aberto`,
      description:
        pendingQuotes.length > 0
          ? "Existe follow-up comercial pendente que pode virar venda sem criar novas propostas."
          : "Os orcamentos atuais nao estao pedindo follow-up imediato.",
    },
    {
      title: `Converter ${formatCountLabel(approvedQuotes.length, "aprovacao", "aprovacoes")} em operacao ou cobranca`,
      description:
        approvedQuotes.length > ongoingOrders.length
          ? "Ha aprovacoes disponiveis para empurrar o fluxo de pedido e recebimento."
          : "As aprovacoes atuais ja estao relativamente bem encaixadas na operacao.",
    },
    {
      title: `Acompanhar ${formatCountLabel(waitingCustomers.length, "cliente", "clientes")} sem retorno`,
      description:
        waitingCustomers.length > 0
          ? "A base mostra clientes que ainda pedem reativacao comercial ou resposta curta."
          : "Nenhum cliente marcado como aguardando retorno neste momento.",
    },
  ];

  if (ongoingOrders.length > 0) {
    agenda.splice(2, 0, {
      title: `Executar ${formatCountLabel(ongoingOrders.length, "pedido", "pedidos")} em andamento`,
      description: "A operacao ja tem pedidos abertos e precisa fechar entrega sem perder o ritmo de cobranca.",
    });
  }

  return agenda.slice(0, 4);
}
