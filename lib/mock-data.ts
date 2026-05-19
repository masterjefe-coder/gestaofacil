import type { Charge, Customer, NavItem, Order, PipelineColumn, Quote, Stat } from "@/lib/types";

export const dashboardNav: NavItem[] = [
  { href: "/dashboard", label: "Visao geral", helper: "Resumo do dia" },
  { href: "/dashboard/customers", label: "Clientes", helper: "Historico comercial" },
  { href: "/dashboard/quotes", label: "Orcamentos", helper: "Propostas e follow-up" },
  { href: "/dashboard/billing", label: "Cobrancas", helper: "Pix e recebimentos" },
  { href: "/dashboard/setup", label: "Setup", helper: "Workspace e empresa" },
];

export const dashboardStats: Stat[] = [
  {
    label: "Orcamentos ativos",
    value: "18",
    helper: "6 aguardando resposta hoje",
  },
  {
    label: "Recebimentos pendentes",
    value: "R$ 12.480",
    helper: "4 cobrancas vencem nas proximas 24h",
  },
  {
    label: "Notas prontas",
    value: "7",
    helper: "servicos concluidos aguardando emissao",
  },
];

export const pipelineColumns: PipelineColumn[] = [
  {
    title: "Novas conversas",
    total: "5",
    items: [
      {
        title: "Clinica Horizonte",
        subtitle: "Pediu manutencao recorrente",
        meta: "Lead vindo do WhatsApp",
      },
      {
        title: "Studio Lume",
        subtitle: "Quer proposta mensal",
        meta: "Responder ainda hoje",
      },
    ],
  },
  {
    title: "Orcamentos enviados",
    total: "8",
    items: [
      {
        title: "Oficina Ponto Certo",
        subtitle: "R$ 2.400 em instalacao",
        meta: "Follow-up em 2 horas",
      },
      {
        title: "Clinica Viva",
        subtitle: "Plano trimestral",
        meta: "Aguardando aprovacao",
      },
    ],
  },
  {
    title: "Pedidos em andamento",
    total: "4",
    items: [
      {
        title: "Conserta Ja",
        subtitle: "Servico marcado para amanha",
        meta: "Pix gerado",
      },
      {
        title: "Casa Nobre",
        subtitle: "Equipe em execucao",
        meta: "Nota apos conclusao",
      },
    ],
  },
];

export const customers: Customer[] = [
  {
    id: "cus_001",
    name: "Clinica Horizonte",
    segment: "Clinica pequena",
    city: "Belo Horizonte",
    status: "Recorrente",
    lastSale: "15 maio",
    openAmount: "R$ 0",
    note: "Cliente ideal para contrato mensal.",
  },
  {
    id: "cus_002",
    name: "Studio Lume",
    segment: "Agencia pequena",
    city: "Sao Paulo",
    status: "Aguardando retorno",
    lastSale: "Sem venda ainda",
    openAmount: "R$ 0",
    note: "Orcamento enviado e follow-up hoje as 17h.",
  },
  {
    id: "cus_003",
    name: "Oficina Ponto Certo",
    segment: "Assistencia tecnica",
    city: "Campinas",
    status: "Ativo",
    lastSale: "17 maio",
    openAmount: "R$ 2.400",
    note: "Pagamento parcial aguardando confirmacao.",
  },
  {
    id: "cus_004",
    name: "Casa Nobre",
    segment: "Servico local",
    city: "Curitiba",
    status: "Ativo",
    lastSale: "18 maio",
    openAmount: "R$ 1.180",
    note: "Servico em execucao e nota apos entrega.",
  },
];

export const quotes: Quote[] = [
  {
    id: "quo_001",
    customer: "Studio Lume",
    title: "Gestao mensal de campanhas",
    amount: "R$ 1.900",
    status: "Enviado",
    dueLabel: "Follow-up hoje",
    summary: "Proposta com setup inicial e recorrencia mensal.",
  },
  {
    id: "quo_002",
    customer: "Oficina Ponto Certo",
    title: "Instalacao de rede e ajuste",
    amount: "R$ 2.400",
    status: "Aprovado",
    dueLabel: "Virar pedido",
    summary: "Aprovado por WhatsApp, pronto para cobranca.",
  },
  {
    id: "quo_003",
    customer: "Clinica Viva",
    title: "Plano trimestral de suporte",
    amount: "R$ 3.600",
    status: "Follow-up",
    dueLabel: "Sem resposta ha 3 dias",
    summary: "Precisa de mensagem curta com CTA para decisao.",
  },
];

export const charges: Charge[] = [
  {
    id: "chg_001",
    customer: "Oficina Ponto Certo",
    amount: "R$ 2.400",
    dueLabel: "vence hoje",
    status: "Hoje",
    source: "Pix copia e cola",
  },
  {
    id: "chg_002",
    customer: "Casa Nobre",
    amount: "R$ 1.180",
    dueLabel: "vence amanha",
    status: "Pendente",
    source: "Link de pagamento",
  },
  {
    id: "chg_003",
    customer: "Clinica Horizonte",
    amount: "R$ 890",
    dueLabel: "recebido ontem",
    status: "Pago",
    source: "Pix confirmado",
  },
];

export const orders: Order[] = [
  {
    id: "ord_001",
    customer: "Oficina Ponto Certo",
    title: "Instalacao de rede e ajuste",
    amount: "R$ 2.400",
    status: "Pendente",
    sourceQuoteId: "quo_002",
    note: "Pedido gerado a partir de orcamento aprovado.",
  },
];
