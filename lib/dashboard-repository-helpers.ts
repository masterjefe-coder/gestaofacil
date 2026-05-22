import type { DashboardCadenceItem, DashboardCadenceLane, DashboardRecommendation } from "@/lib/dashboard-repository-types";

export function parseCurrencyToNumber(value: string) {
  return Number(
    value
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim(),
  );
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCountLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function getRecommendationWeight(priority: DashboardRecommendation["priority"]) {
  switch (priority) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "normal":
      return 2;
  }
}

export function toCadenceLanes(items: DashboardCadenceItem[]): DashboardCadenceLane[] {
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

export function formatGeneratedAt(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
