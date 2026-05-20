import type { Charge, ChargeFollowUpEntry, ChargeFollowUpOutcome } from "@/lib/types";
import type { ChargeWhatsappSignal } from "@/lib/charge-whatsapp-signals";

export type BillingWhatsappInsightSummary = {
  openReplyCount: number;
  unresolvedReplyCount: number;
  promisedCount: number;
  contestedCount: number;
  paidInAnalysisCount: number;
  rescheduledCount: number;
};

export type BillingWhatsappInsightItem = {
  chargeId: string;
  customer: string;
  amount: string;
  dueLabel: string;
  status: Charge["status"];
  suggestedOutcome?: ChargeFollowUpOutcome;
  suggestedNote?: string;
  lastMessagePreview?: string;
  lastEventAt?: string;
  requiresHumanAction: boolean;
};

function normalizeSignalText(value: string | undefined) {
  return (value || "").trim().toLowerCase();
}

export function hasRegisteredWhatsappSignal(
  charge: Charge,
  signal: { suggestedOutcome?: ChargeFollowUpOutcome; suggestedNote?: string },
) {
  if (!signal.suggestedOutcome || !signal.suggestedNote) {
    return false;
  }

  return charge.followUps.some((entry: ChargeFollowUpEntry) => (
    entry.channel === "WhatsApp"
    && entry.outcome === signal.suggestedOutcome
    && normalizeSignalText(entry.note) === normalizeSignalText(signal.suggestedNote)
  ));
}

export function buildBillingWhatsappInsights(charges: Charge[], signals: ChargeWhatsappSignal[]) {
  const signalByCustomer = new Map(signals.map((signal) => [signal.customerName, signal]));
  const openCharges = charges.filter((charge) => charge.status !== "Pago");
  const items: BillingWhatsappInsightItem[] = [];

  for (const charge of openCharges) {
    const signal = signalByCustomer.get(charge.customer);

    if (!signal?.inboundReplyDetected) {
      continue;
    }

    items.push({
      chargeId: charge.id,
      customer: charge.customer,
      amount: charge.amount,
      dueLabel: charge.dueLabel,
      status: charge.status,
      suggestedOutcome: signal.suggestedOutcome,
      suggestedNote: signal.suggestedNote,
      lastMessagePreview: signal.lastMessagePreview,
      lastEventAt: signal.lastEventAt,
      requiresHumanAction: !hasRegisteredWhatsappSignal(charge, signal),
    });
  }

  const summary = items.reduce<BillingWhatsappInsightSummary>((acc, item) => {
    acc.openReplyCount += 1;

    if (item.requiresHumanAction) {
      acc.unresolvedReplyCount += 1;
    }

    switch (item.suggestedOutcome) {
      case "Prometeu pagar":
        acc.promisedCount += 1;
        break;
      case "Contestou":
        acc.contestedCount += 1;
        break;
      case "Pago em analise":
        acc.paidInAnalysisCount += 1;
        break;
      case "Reagendado":
        acc.rescheduledCount += 1;
        break;
      default:
        break;
    }

    return acc;
  }, {
    openReplyCount: 0,
    unresolvedReplyCount: 0,
    promisedCount: 0,
    contestedCount: 0,
    paidInAnalysisCount: 0,
    rescheduledCount: 0,
  });

  const prioritizedItems = [...items].sort((left, right) => {
    const leftWeight = left.requiresHumanAction ? 0 : 1;
    const rightWeight = right.requiresHumanAction ? 0 : 1;

    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    const outcomeWeight = (value?: ChargeFollowUpOutcome) => {
      switch (value) {
        case "Contestou":
          return 0;
        case "Pago em analise":
          return 1;
        case "Prometeu pagar":
          return 2;
        case "Reagendado":
          return 3;
        default:
          return 4;
      }
    };

    return outcomeWeight(left.suggestedOutcome) - outcomeWeight(right.suggestedOutcome);
  });

  return {
    summary,
    items: prioritizedItems,
  };
}
