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
  cadenceLabel: string;
  executionLabel: string;
  completedStepLabel: string;
  nextStepLabel: string;
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

export type ChargeReminderTask = {
  id: string;
  chargeId: string;
  customer: string;
  amount: string;
  channel: "WhatsApp" | "Ligacao" | "Email" | "Pix reenviado";
  title: string;
  reason: string;
  message: string;
  suggestedOutcome: "Sem resposta" | "Prometeu pagar";
  slaLabel: string;
  nextFollowUpLabel: string;
  deliveryLabel: string | undefined;
  deliveryUrl: string | undefined;
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

function inferReminderChannel(charge: Charge, action: ChargeFollowUpAction) {
  const source = charge.source.toLowerCase();

  if (source.includes("pix") && (action.slaStatus === "overdue" || action.slaStatus === "today")) {
    return "Pix reenviado" as const;
  }

  if (source.includes("email")) {
    return "Email" as const;
  }

  if (action.slaStatus === "waiting") {
    return "Ligacao" as const;
  }

  return "WhatsApp" as const;
}

function buildReminderReason(action: ChargeFollowUpAction) {
  switch (action.slaStatus) {
    case "overdue":
      return "Lembrete em atraso e com SLA vencido.";
    case "today":
      return "Contato precisa acontecer hoje para não escorregar o caixa.";
    case "scheduled":
      return "Contato preventivo para manter a cobrança no radar.";
    case "waiting":
      return "Último retorno pede conferência antes de insistir no mesmo canal.";
    case "settled":
      return "Cobrança sem necessidade de lembrete.";
  }
}

function buildReminderTitle(charge: Charge, action: ChargeFollowUpAction) {
  switch (action.slaStatus) {
    case "overdue":
      return `Cobrar ${charge.customer} agora`;
    case "today":
      return `Lembrar ${charge.customer} hoje`;
    case "scheduled":
      return `Programar próximo toque com ${charge.customer}`;
    case "waiting":
      return `Checar retorno de ${charge.customer}`;
    case "settled":
      return `Sem lembrete para ${charge.customer}`;
  }
}

function buildReminderMessage(charge: Charge, action: ChargeFollowUpAction, channel: ChargeReminderTask["channel"]) {
  if (channel === "Pix reenviado") {
    return `Oi, ${charge.customer}. Reenviei o Pix da cobrança de ${charge.amount}. Se preferir, me confirma o horário em que consegue regularizar para eu acompanhar por aqui.`;
  }

  if (channel === "Ligacao") {
    return `Ligar para ${charge.customer} e confirmar o melhor plano para a cobrança de ${charge.amount}, registrando a resposta ainda no painel.`;
  }

  if (channel === "Email") {
    return `Olá, ${charge.customer}. Reforço a cobrança de ${charge.amount}. ${action.suggestedMessage.replace(/^Oi,\s[^.]+\.\s?/u, "")}`;
  }

  return action.suggestedMessage;
}

function buildReminderDelivery(task: {
  channel: ChargeReminderTask["channel"];
  customer: string;
  message: string;
  amount: string;
}) {
  switch (task.channel) {
    case "WhatsApp":
    case "Pix reenviado":
      return {
        deliveryLabel: task.channel === "Pix reenviado" ? "Abrir WhatsApp com Pix" : "Abrir WhatsApp",
        deliveryUrl: `https://wa.me/?text=${encodeURIComponent(task.message)}`,
      };
    case "Email":
      return {
        deliveryLabel: "Abrir email",
        deliveryUrl: `mailto:?subject=${encodeURIComponent(`Cobranca ${task.amount} - ${task.customer}`)}&body=${encodeURIComponent(task.message)}`,
      };
    case "Ligacao":
      return {
        deliveryLabel: undefined,
        deliveryUrl: undefined,
      };
  }
}

export function buildChargeReminderQueue(charges: Charge[], now = new Date()): ChargeReminderTask[] {
  const actions = buildChargeFollowUpActions(charges, now);
  const chargeMap = new Map(charges.map((charge) => [charge.id, charge]));

  return actions
    .filter((action) => action.slaStatus !== "settled")
    .filter((action) => action.slaStatus !== "scheduled" || action.nextFollowUpDate)
    .slice(0, 6)
    .reduce<ChargeReminderTask[]>((tasks, action) => {
      const charge = chargeMap.get(action.id);

      if (!charge) {
        return tasks;
      }

      const channel = inferReminderChannel(charge, action);
      const message = buildReminderMessage(charge, action, channel);
      const delivery = buildReminderDelivery({
        channel,
        customer: charge.customer,
        message,
        amount: charge.amount,
      });

      tasks.push({
        id: `${action.id}:${channel}`,
        chargeId: action.id,
        customer: charge.customer,
        amount: charge.amount,
        channel,
        title: buildReminderTitle(charge, action),
        reason: buildReminderReason(action),
        message,
        suggestedOutcome: action.slaStatus === "waiting" ? "Prometeu pagar" : "Sem resposta",
        slaLabel: action.slaLabel,
        nextFollowUpLabel: action.nextFollowUpLabel,
        deliveryLabel: delivery.deliveryLabel,
        deliveryUrl: delivery.deliveryUrl,
      });

      return tasks;
    }, []);
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

function buildCadenceLabel(action: {
  urgency: ChargeUrgency;
  slaStatus: ChargeFollowUpSlaStatus;
  lastFollowUp?: ChargeFollowUpEntry;
  charge?: Charge;
}) {
  if (action.charge?.cadence?.cadenceLabel) {
    return action.charge.cadence.cadenceLabel;
  }

  if (action.lastFollowUp?.outcome === "Contestou") {
    return "Cobrança em tratamento de objeção";
  }

  if (action.lastFollowUp?.outcome === "Reagendado") {
    return "Cobrança em prazo renegociado";
  }

  if (action.lastFollowUp?.outcome === "Prometeu pagar" || action.lastFollowUp?.outcome === "Pago em analise") {
    return "Cobrança aguardando confirmação do cliente";
  }

  switch (action.slaStatus) {
    case "overdue":
      return "Cobrança em atraso com SLA vencido";
    case "today":
      return "Cobrança com toque programado para hoje";
    case "scheduled":
      return action.urgency === "unscheduled"
        ? "Cobrança sem vencimento real definido"
        : "Cobrança em monitoramento preventivo";
    case "waiting":
      return "Cobrança pausada aguardando retorno";
    case "settled":
      return "Cobrança sem cadência ativa";
  }
}

function buildExecutionLabel(action: {
  urgency: ChargeUrgency;
  slaStatus: ChargeFollowUpSlaStatus;
  lastFollowUp?: ChargeFollowUpEntry;
  charge?: Charge;
}) {
  if (action.charge?.cadence?.executionLabel) {
    return action.charge.cadence.executionLabel;
  }

  if (action.lastFollowUp?.outcome === "Contestou") {
    return "Tratar objeção antes de insistir";
  }

  if (action.lastFollowUp?.outcome === "Reagendado") {
    return "Ajustar data e reprogramar";
  }

  if (action.lastFollowUp?.outcome === "Prometeu pagar") {
    return "Acompanhar promessa pontualmente";
  }

  if (action.lastFollowUp?.outcome === "Pago em analise") {
    return "Conferir comprovante ou conciliação";
  }

  switch (action.slaStatus) {
    case "overdue":
      return "Cobrar agora";
    case "today":
      return "Executar hoje";
    case "scheduled":
      return action.urgency === "unscheduled" ? "Definir vencimento real" : "Manter no radar";
    case "waiting":
      return "Aguardar retorno antes do próximo toque";
    case "settled":
      return "Sem ação";
  }
}

function buildCompletedStepLabel(action: {
  urgency: ChargeUrgency;
  lastFollowUp?: ChargeFollowUpEntry;
  charge?: Charge;
}) {
  if (action.charge?.cadence?.completedStepLabel) {
    return action.charge.cadence.completedStepLabel;
  }

  if (action.lastFollowUp?.outcome === "Contestou") {
    return "Cliente contestou a cobrança";
  }

  if (action.lastFollowUp?.outcome === "Reagendado") {
    return "Cliente pediu novo prazo";
  }

  if (action.lastFollowUp?.outcome === "Prometeu pagar") {
    return "Cliente prometeu regularizar";
  }

  if (action.lastFollowUp?.outcome === "Pago em analise") {
    return "Comprovante ou pagamento informado";
  }

  switch (action.urgency) {
    case "overdue":
      return "Vencimento já passou";
    case "today":
      return "Cobrança entrou na agenda de hoje";
    case "upcoming":
      return "Cobrança já está no radar";
    case "unscheduled":
      return "Cobrança criada sem vencimento exato";
    case "paid":
      return "Pagamento já foi registrado";
  }
}

function buildNextStepLabel(action: {
  urgency: ChargeUrgency;
  slaStatus: ChargeFollowUpSlaStatus;
  lastFollowUp?: ChargeFollowUpEntry;
  charge?: Charge;
}) {
  if (action.charge?.cadence?.nextStepLabel) {
    return action.charge.cadence.nextStepLabel;
  }

  if (action.lastFollowUp?.outcome === "Contestou") {
    return "Resolver objeção e redefinir abordagem";
  }

  if (action.lastFollowUp?.outcome === "Reagendado") {
    return "Atualizar vencimento e reagendar cobrança";
  }

  if (action.lastFollowUp?.outcome === "Prometeu pagar") {
    return "Confirmar pagamento no prazo prometido";
  }

  if (action.lastFollowUp?.outcome === "Pago em analise") {
    return "Conferir baixa ou comprovante";
  }

  switch (action.slaStatus) {
    case "overdue":
      return "Cobrar agora e registrar retorno";
    case "today":
      return "Executar contato ainda hoje";
    case "scheduled":
      return action.urgency === "unscheduled" ? "Definir data real de vencimento" : "Preparar próximo lembrete";
    case "waiting":
      return "Esperar retorno antes de insistir";
    case "settled":
      return "Encaminhar para fiscal se aplicável";
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
        cadenceLabel: buildCadenceLabel({
          urgency,
          slaStatus,
          lastFollowUp: latestFollowUp,
          charge,
        }),
        executionLabel: buildExecutionLabel({
          urgency,
          slaStatus,
          lastFollowUp: latestFollowUp,
          charge,
        }),
        completedStepLabel: buildCompletedStepLabel({
          urgency,
          lastFollowUp: latestFollowUp,
          charge,
        }),
        nextStepLabel: buildNextStepLabel({
          urgency,
          slaStatus,
          lastFollowUp: latestFollowUp,
          charge,
        }),
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
