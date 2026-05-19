import type { Charge } from "@/lib/types";

export type ChargeUrgency = "overdue" | "today" | "upcoming" | "unscheduled" | "paid";

export function parseChargeDueDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function diffInDays(left: Date, right: Date) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.round((startOfDay(left).getTime() - startOfDay(right).getTime()) / millisecondsPerDay);
}

export function getChargeUrgency(charge: Charge, now = new Date()): ChargeUrgency {
  if (charge.status === "Pago") {
    return "paid";
  }

  const dueDate = parseChargeDueDate(charge.dueDate);

  if (!dueDate) {
    return charge.status === "Hoje" ? "today" : "unscheduled";
  }

  const daysUntilDue = diffInDays(dueDate, now);

  if (daysUntilDue < 0) {
    return "overdue";
  }

  if (daysUntilDue === 0 || charge.status === "Hoje") {
    return "today";
  }

  return "upcoming";
}

export function getChargeUrgencyLabel(charge: Charge, now = new Date()) {
  const urgency = getChargeUrgency(charge, now);
  const dueDate = parseChargeDueDate(charge.dueDate);

  switch (urgency) {
    case "overdue":
      return "Atrasada";
    case "today":
      return "Vence hoje";
    case "upcoming":
      return dueDate ? `Vence em ${diffInDays(dueDate, now)}d` : "Proxima";
    case "paid":
      return "Recebida";
    default:
      return "Sem data";
  }
}

function getChargeSortWeight(charge: Charge, now = new Date()) {
  const urgency = getChargeUrgency(charge, now);

  switch (urgency) {
    case "overdue":
      return 0;
    case "today":
      return 1;
    case "upcoming":
      return 2;
    case "unscheduled":
      return 3;
    case "paid":
      return 4;
  }
}

export function sortChargesByPriority(charges: Charge[], now = new Date()) {
  return [...charges].sort((left, right) => {
    const leftWeight = getChargeSortWeight(left, now);
    const rightWeight = getChargeSortWeight(right, now);

    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    const leftDate = parseChargeDueDate(left.dueDate);
    const rightDate = parseChargeDueDate(right.dueDate);

    if (leftDate && rightDate) {
      return leftDate.getTime() - rightDate.getTime();
    }

    if (leftDate) {
      return -1;
    }

    if (rightDate) {
      return 1;
    }

    return left.customer.localeCompare(right.customer, "pt-BR");
  });
}
