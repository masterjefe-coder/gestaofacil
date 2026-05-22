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
