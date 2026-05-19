import {
  getChargeUrgency,
  getChargeUrgencyLabel,
  parseChargeDueDate,
  type ChargeUrgency,
} from "@/lib/charge-priority";
import type { Charge } from "@/lib/types";

export type ChargeFollowUpBucket = "urgent" | "attention" | "planned" | "unmapped";

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
};

export type ChargeFollowUpSummary = {
  urgentCount: number;
  attentionCount: number;
  plannedCount: number;
  unmappedCount: number;
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
      };
    });
}

export function summarizeChargeFollowUp(actions: ChargeFollowUpAction[]): ChargeFollowUpSummary {
  const urgentCount = actions.filter((action) => action.bucket === "urgent").length;
  const attentionCount = actions.filter((action) => action.bucket === "attention").length;
  const plannedCount = actions.filter((action) => action.bucket === "planned").length;
  const unmappedCount = actions.filter((action) => action.bucket === "unmapped").length;

  if (urgentCount > 0) {
    return {
      urgentCount,
      attentionCount,
      plannedCount,
      unmappedCount,
      headline: `${urgentCount} cobrança(s) atrasada(s) puxam a fila agora`,
      helper: "Priorize contato imediato antes de abrir novas rotinas comerciais.",
    };
  }

  if (attentionCount > 0) {
    return {
      urgentCount,
      attentionCount,
      plannedCount,
      unmappedCount,
      headline: `${attentionCount} cobrança(s) vencem hoje`,
      helper: "O financeiro do dia pede lembrete rápido com Pix ou link em mãos.",
    };
  }

  if (unmappedCount > 0) {
    return {
      urgentCount,
      attentionCount,
      plannedCount,
      unmappedCount,
      headline: `${unmappedCount} cobrança(s) ainda não têm data real`,
      helper: "Vale organizar vencimento real para a previsão de caixa ficar menos manual.",
    };
  }

  return {
    urgentCount,
    attentionCount,
    plannedCount,
    unmappedCount,
    headline: plannedCount > 0 ? `${plannedCount} cobrança(s) já estão no radar` : "Fila financeira sob controle",
    helper: plannedCount > 0
      ? "A operação financeira atual está previsível e pode trabalhar preventivamente."
      : "Nenhuma cobrança aberta exige follow-up financeiro imediato.",
  };
}
