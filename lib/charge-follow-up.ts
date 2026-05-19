import {
  getChargeUrgency,
  getChargeUrgencyLabel,
  parseChargeDueDate,
  type ChargeUrgency,
} from "@/lib/charge-priority";
import type { Charge, ChargeFollowUpEntry } from "@/lib/types";

export type ChargeFollowUpBucket = "urgent" | "attention" | "planned" | "unmapped";
export type ChargeFollowUpSlaStatus = "overdue" | "today" | "scheduled" | "waiting" | "settled";

export type ChargeFollowUpAction = {
  id: string;
  customer: string;
  amount: string;
  urgency: ChargeUrgency;
  urgencyLabel: string;
  bucket: ChargeFollowUpBucket;
  title: string;
  summary: string;
  recommendedAction: string;
  suggestedMessage: string;
  nextFollowUpDate?: string;
  nextFollowUpLabel: string;
  slaStatus: ChargeFollowUpSlaStatus;
  slaLabel: string;
  lastContactLabel: string;
};

export type ChargeFollowUpSummary = {
  urgentCount: number;
  attentionCount: number;
  plannedCount: number;
  unmappedCount: number;
  slaOverdueCount: number;
  slaTodayCount: number;
  waitingCount: number;
  headline: string;
  helper: string;
};

function diffInDays(left: Date, right: Date) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  leftDate.setHours(0, 0, 0, 0);
  rightDate.setHours(0, 0, 0, 0);
  return Math.round((leftDate.getTime() - rightDate.getTime()) / millisecondsPerDay);
}

function getBucketFromUrgency(urgency: ChargeUrgency): ChargeFollowUpBucket {
  switch (urgency) {
    case "overdue":
      return "urgent";
    case "today":
      return "attention";
    case "upcoming":
      return "planned";
    case "unscheduled":
      return "unmapped";
    case "paid":
      return "planned";
  }
}

function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(value);
}

function formatDateTimeLabel(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + amount);
  return date;
}

function subtractDays(value: Date, amount: number) {
  return addDays(value, amount * -1);
}

function getLatestFollowUp(charge: Charge) {
  return [...charge.followUps].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
}

function getNextFollowUpDate(charge: Charge, urgency: ChargeUrgency, now = new Date()) {
  if (charge.status === "Pago") {
    return null;
  }

  const latestFollowUp = getLatestFollowUp(charge);
  const dueDate = parseChargeDueDate(charge.dueDate);

  if (latestFollowUp?.outcome === "Pago em analise") {
    return null;
  }

  if (latestFollowUp?.outcome === "Prometeu pagar") {
    return dueDate ? dueDate : addDays(now, 1);
  }

  if (latestFollowUp?.outcome === "Reagendado") {
    return dueDate ? dueDate : addDays(now, 2);
  }

  if (latestFollowUp?.outcome === "Contestou") {
    return addDays(now, 1);
  }

  switch (urgency) {
    case "overdue":
      return addDays(now, 0);
    case "today":
      return addDays(now, 0);
    case "upcoming":
      if (!dueDate) {
        return addDays(now, 2);
      }
      return diffInDays(dueDate, now) <= 2 ? addDays(now, 1) : subtractDays(dueDate, 2);
    case "unscheduled":
      return addDays(now, 0);
    case "paid":
      return null;
  }
}

function getSlaStatus(charge: Charge, nextFollowUpDate: Date | null, now = new Date()): ChargeFollowUpSlaStatus {
  if (charge.status === "Pago") {
    return "settled";
  }

  const latestFollowUp = getLatestFollowUp(charge);

  if (latestFollowUp?.outcome === "Pago em analise") {
    return "waiting";
  }

  if (!nextFollowUpDate) {
    return "waiting";
  }

  const daysUntilNext = diffInDays(nextFollowUpDate, now);

  if (daysUntilNext < 0) {
    return "overdue";
  }

  if (daysUntilNext === 0) {
    return "today";
  }

  return "scheduled";
}

function getSlaLabel(status: ChargeFollowUpSlaStatus, nextFollowUpDate: Date | null) {
  switch (status) {
    case "overdue":
      return "SLA vencido";
    case "today":
      return "Ação hoje";
    case "scheduled":
      return nextFollowUpDate ? `Próximo em ${formatDateLabel(nextFollowUpDate)}` : "Planejado";
    case "waiting":
      return "Aguardando retorno";
    case "settled":
      return "Sem ação";
  }
}

function getLastContactLabel(entry: ChargeFollowUpEntry | undefined) {
  if (!entry) {
    return "Sem contato registrado ainda.";
  }

  return `${formatDateTimeLabel(new Date(entry.createdAt))} · ${entry.channel} · ${entry.outcome}`;
}

function getNextFollowUpLabel(status: ChargeFollowUpSlaStatus, nextFollowUpDate: Date | null) {
  switch (status) {
    case "overdue":
      return "Follow-up precisava ter acontecido antes.";
    case "today":
      return "Contato precisa acontecer hoje.";
    case "scheduled":
      return nextFollowUpDate ? `Próximo contato sugerido em ${formatDateLabel(nextFollowUpDate)}.` : "Contato futuro planejado.";
    case "waiting":
      return "Aguardar retorno do cliente ou confirmação financeira.";
    case "settled":
      return "Cobrança sem follow-up ativo.";
  }
}

function buildSuggestedMessage(charge: Charge, urgency: ChargeUrgency, now = new Date()) {
  const dueDate = parseChargeDueDate(charge.dueDate);

  switch (urgency) {
    case "overdue": {
      const daysLate = dueDate ? Math.abs(diffInDays(dueDate, now)) : 1;
      return `Oi, ${charge.customer}. A cobrança de ${charge.amount} está em aberto há ${daysLate} dia(s). Pode me confirmar o pagamento ou a melhor data para regularizar?`;
    }
    case "today":
      return `Oi, ${charge.customer}. Passando para lembrar da cobrança de ${charge.amount} com vencimento hoje. Se precisar, eu te reenvio o Pix agora.`;
    case "upcoming":
      return `Oi, ${charge.customer}. Só reforçando que a cobrança de ${charge.amount} vence em breve. Se quiser, já te envio o Pix para adiantar o pagamento.`;
    case "unscheduled":
      return `Oi, ${charge.customer}. Quero alinhar a melhor data para a cobrança de ${charge.amount}. Me confirma qual vencimento faz mais sentido para você?`;
    case "paid":
      return `Pagamento de ${charge.amount} recebido de ${charge.customer}. Fluxo pronto para seguir para conciliação ou fiscal.`;
  }
}

function buildRecommendedAction(charge: Charge, urgency: ChargeUrgency) {
  switch (urgency) {
    case "overdue":
      return `Cobrar agora e registrar retorno do cliente sobre ${charge.dueLabel.toLowerCase()}.`;
    case "today":
      return "Enviar lembrete curto com Pix ou link antes do fim do expediente.";
    case "upcoming":
      return "Programar lembrete preventivo e confirmar se a forma de pagamento continua a mesma.";
    case "unscheduled":
      return "Definir data real de vencimento para essa cobrança sair do campo manual.";
    case "paid":
      return "Nenhuma ação financeira imediata; seguir fluxo de baixa e fiscal se houver.";
  }
}

function buildSummary(charge: Charge, urgency: ChargeUrgency, now = new Date()) {
  const dueDate = parseChargeDueDate(charge.dueDate);

  switch (urgency) {
    case "overdue": {
      const daysLate = dueDate ? Math.abs(diffInDays(dueDate, now)) : 1;
      return `${charge.amount} em atraso para ${charge.customer}, com ${daysLate} dia(s) além do vencimento.`;
    }
    case "today":
      return `${charge.amount} vence hoje para ${charge.customer} e pede contato rápido.`;
    case "upcoming": {
      const daysUntilDue = dueDate ? diffInDays(dueDate, now) : null;
      return daysUntilDue !== null
        ? `${charge.amount} vence em ${daysUntilDue} dia(s) para ${charge.customer}.`
        : `${charge.amount} está previsto para os próximos passos de ${charge.customer}.`;
    }
    case "unscheduled":
      return `${charge.amount} ainda não tem data real de vencimento para ${charge.customer}.`;
    case "paid":
      return `${charge.amount} já foi recebido de ${charge.customer}.`;
  }
}

export function buildChargeFollowUpActions(charges: Charge[], now = new Date()): ChargeFollowUpAction[] {
  return charges
    .filter((charge) => charge.status !== "Pago")
    .map((charge) => {
      const urgency = getChargeUrgency(charge, now);
      const latestFollowUp = getLatestFollowUp(charge);
      const nextFollowUpDate = getNextFollowUpDate(charge, urgency, now);
      const slaStatus = getSlaStatus(charge, nextFollowUpDate, now);

      return {
        id: charge.id,
        customer: charge.customer,
        amount: charge.amount,
        urgency,
        urgencyLabel: getChargeUrgencyLabel(charge, now),
        bucket: getBucketFromUrgency(urgency),
        title: `${charge.customer} · ${charge.amount}`,
        summary: buildSummary(charge, urgency, now),
        recommendedAction: buildRecommendedAction(charge, urgency),
        suggestedMessage: buildSuggestedMessage(charge, urgency, now),
        nextFollowUpDate: nextFollowUpDate ? nextFollowUpDate.toISOString() : undefined,
        nextFollowUpLabel: getNextFollowUpLabel(slaStatus, nextFollowUpDate),
        slaStatus,
        slaLabel: getSlaLabel(slaStatus, nextFollowUpDate),
        lastContactLabel: getLastContactLabel(latestFollowUp),
      };
    })
    .sort((left, right) => {
      const statusWeight = getSlaWeight(left.slaStatus) - getSlaWeight(right.slaStatus);

      if (statusWeight !== 0) {
        return statusWeight;
      }

      if (left.nextFollowUpDate && right.nextFollowUpDate) {
        return new Date(left.nextFollowUpDate).getTime() - new Date(right.nextFollowUpDate).getTime();
      }

      if (left.nextFollowUpDate) {
        return -1;
      }

      if (right.nextFollowUpDate) {
        return 1;
      }

      return left.customer.localeCompare(right.customer, "pt-BR");
    });
}

function getSlaWeight(status: ChargeFollowUpSlaStatus) {
  switch (status) {
    case "overdue":
      return 0;
    case "today":
      return 1;
    case "scheduled":
      return 2;
    case "waiting":
      return 3;
    case "settled":
      return 4;
  }
}

export function summarizeChargeFollowUp(actions: ChargeFollowUpAction[]): ChargeFollowUpSummary {
  const urgentCount = actions.filter((action) => action.bucket === "urgent").length;
  const attentionCount = actions.filter((action) => action.bucket === "attention").length;
  const plannedCount = actions.filter((action) => action.bucket === "planned").length;
  const unmappedCount = actions.filter((action) => action.bucket === "unmapped").length;
  const slaOverdueCount = actions.filter((action) => action.slaStatus === "overdue").length;
  const slaTodayCount = actions.filter((action) => action.slaStatus === "today").length;
  const waitingCount = actions.filter((action) => action.slaStatus === "waiting").length;

  if (slaOverdueCount > 0) {
    return {
      urgentCount,
      attentionCount,
      plannedCount,
      unmappedCount,
      slaOverdueCount,
      slaTodayCount,
      waitingCount,
      headline: `${slaOverdueCount} follow-up(s) estão com SLA vencido`,
      helper: "A fila automática já mostra quem precisava de contato antes de qualquer nova rotina comercial.",
    };
  }

  if (slaTodayCount > 0) {
    return {
      urgentCount,
      attentionCount,
      plannedCount,
      unmappedCount,
      slaOverdueCount,
      slaTodayCount,
      waitingCount,
      headline: `${slaTodayCount} follow-up(s) precisam acontecer hoje`,
      helper: "O financeiro do dia já está priorizado com lembrete e cadência prática.",
    };
  }

  if (unmappedCount > 0) {
    return {
      urgentCount,
      attentionCount,
      plannedCount,
      unmappedCount,
      slaOverdueCount,
      slaTodayCount,
      waitingCount,
      headline: `${unmappedCount} cobrança(s) ainda não têm data real`,
      helper: "Vale organizar vencimento real para a previsão de caixa ficar menos manual.",
    };
  }

  if (waitingCount > 0) {
    return {
      urgentCount,
      attentionCount,
      plannedCount,
      unmappedCount,
      slaOverdueCount,
      slaTodayCount,
      waitingCount,
      headline: `${waitingCount} cobrança(s) aguardam retorno do cliente`,
      helper: "O histórico já separa o que precisa insistência do que pode só esperar confirmação.",
    };
  }

  return {
    urgentCount,
    attentionCount,
    plannedCount,
    unmappedCount,
    slaOverdueCount,
    slaTodayCount,
    waitingCount,
    headline: plannedCount > 0 ? `${plannedCount} cobrança(s) já estão no radar` : "Fila financeira sob controle",
    helper: plannedCount > 0
      ? "A operação financeira atual está previsível e pode trabalhar preventivamente."
      : "Nenhuma cobrança aberta exige follow-up financeiro imediato.",
  };
}
