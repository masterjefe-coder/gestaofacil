"use server";

import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit-repository";
import { buildChargeReminderQueue } from "@/lib/charge-follow-up";
import {
  addChargeFollowUp,
  createCharge,
  createChargeFromQuote,
  deleteCharge,
  listCharges,
  updateCharge,
} from "@/lib/charge-repository";
import { listCustomers } from "@/lib/customer-repository";
import { EvolutionApiError, sendEvolutionTextMessage } from "@/lib/evolution-api";
import {
  extractMessageId,
  extractMessagePreview,
  extractRemoteJid,
  normalizePhone,
  normalizeRemoteJid,
} from "@/lib/whatsapp-message-metadata";
import type { ChargeFollowUpChannel, ChargeFollowUpOutcome, ChargeInput } from "@/lib/types";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function addDaysToIsoDate(days: number) {
  const nextDate = new Date();
  nextDate.setHours(12, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + days);

  const year = nextDate.getFullYear();
  const month = String(nextDate.getMonth() + 1).padStart(2, "0");
  const day = String(nextDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function revalidateBillingViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/setup");
}

export async function createChargeAction(formData: FormData) {
  const quoteId = getString(formData, "quoteId");
  const paymentMethod = getString(formData, "paymentMethod") || "Pix";
  const dueLabel = getString(formData, "dueLabel");
  const dueDate = getString(formData, "dueDate") || undefined;
  const status = (getString(formData, "status") as ChargeInput["status"]) || "Pendente";

  if (quoteId) {
    await createChargeFromQuote(quoteId, paymentMethod, dueLabel, dueDate, status);
    revalidateBillingViews();
    return;
  }

  const input: ChargeInput = {
    customer: getString(formData, "customer"),
    amount: getString(formData, "amount"),
    dueLabel,
    dueDate,
    status,
    source: getString(formData, "source") || paymentMethod,
  };

  if (!input.customer || !input.amount) {
    return;
  }

  await createCharge(input);
  revalidateBillingViews();
}

export async function markChargeAsPaidAction(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  await updateCharge(id, {
    status: "Pago",
    dueLabel: "recebido",
  });
  revalidateBillingViews();
}

export async function markChargeAsDueTodayAction(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  const dueDate = addDaysToIsoDate(0);
  await updateCharge(id, {
    status: "Hoje",
    dueDate,
    dueLabel: "vence hoje",
  });
  revalidateBillingViews();
}

export async function postponeChargeAction(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  const dueDate = addDaysToIsoDate(3);
  await updateCharge(id, {
    status: "Pendente",
    dueDate,
  });
  revalidateBillingViews();
}

export async function addChargeFollowUpAction(formData: FormData) {
  const id = getString(formData, "id");
  const channel = getString(formData, "channel") as ChargeFollowUpChannel;
  const outcome = getString(formData, "outcome") as ChargeFollowUpOutcome;
  const note = getString(formData, "note");

  if (!id || !channel || !outcome) {
    return;
  }

  await addChargeFollowUp(id, {
    channel,
    outcome,
    note,
  });
  revalidateBillingViews();
}

export async function runChargeReminderAction(formData: FormData) {
  const id = getString(formData, "id");
  const channel = getString(formData, "channel") as ChargeFollowUpChannel;
  const outcome = (getString(formData, "outcome") as ChargeFollowUpOutcome) || "Sem resposta";
  const message = getString(formData, "message");
  const reason = getString(formData, "reason");

  if (!id || !channel) {
    return;
  }

  const note = [reason, message].filter(Boolean).join(" ");

  await addChargeFollowUp(id, {
    channel,
    outcome,
    note: note || "Lembrete operacional registrado na fila automática.",
  });
  revalidateBillingViews();
}

export async function sendChargeReminderWhatsappAction(formData: FormData) {
  const id = getString(formData, "id");
  const customerName = getString(formData, "customer");
  const customerPhone = getString(formData, "phone");
  const message = getString(formData, "message");
  const channel = (getString(formData, "channel") as ChargeFollowUpChannel) || "WhatsApp";

  if (!id || !customerName || !customerPhone || !message) {
    return;
  }

  try {
    const response = await sendEvolutionTextMessage({
      number: customerPhone,
      text: message,
    });

    const charges = await listCharges();
    const customers = await listCustomers();
    const charge = charges.find((item) => item.id === id);
    const customer = customers.find((item) => item.name === customerName);
    const reminder = charge ? buildChargeReminderQueue([charge]).find((task) => task.chargeId === id && task.channel === channel) : null;
    const responseMessageId = extractMessageId(response);
    const responseRemoteJid = extractRemoteJid(response);
    const normalizedCustomerPhone = normalizePhone(customer?.phone || customerPhone);
    const normalizedResponsePhone = normalizeRemoteJid(responseRemoteJid);
    const resolvedPhone = normalizedResponsePhone || normalizedCustomerPhone;
    const responsePreview = extractMessagePreview(response) || message;

    await addChargeFollowUp(id, {
      channel,
      outcome: reminder?.suggestedOutcome || "Sem resposta",
      note: `Mensagem enviada via Evolution API para ${customer?.phone || customerPhone}. ${message}`,
    });
    await recordAuditEvent({
      action: "charge.whatsapp.sent",
      entityType: "charge",
      entityId: id,
      payload: {
        summary: `Mensagem de cobrança enviada por WhatsApp para ${customerName}.`,
        metadata: {
          customer: customerName,
          phone: resolvedPhone,
          channel,
          outcome: reminder?.suggestedOutcome || "Sem resposta",
          message,
          messageId: responseMessageId || null,
          remoteJid: responseRemoteJid || null,
          messagePreview: responsePreview,
        },
      },
    });
    revalidateBillingViews();
    return;
  } catch (error) {
    const detail = error instanceof EvolutionApiError ? error.message : "Falha desconhecida no envio pelo WhatsApp.";

    await addChargeFollowUp(id, {
      channel,
      outcome: "Sem resposta",
      note: `Falha no envio via Evolution API: ${detail}`,
    });
    await recordAuditEvent({
      action: "charge.whatsapp.failed",
      entityType: "charge",
      entityId: id,
      payload: {
        summary: `Falha no envio de WhatsApp para ${customerName}.`,
        metadata: {
          customer: customerName,
          phone: customerPhone,
          channel,
          detail,
        },
      },
    });
    revalidateBillingViews();
    return;
  }
}

export async function applyWhatsappSignalFollowUpAction(formData: FormData) {
  const id = getString(formData, "id");
  const outcome = getString(formData, "outcome") as ChargeFollowUpOutcome;
  const note = getString(formData, "note");

  if (!id || !outcome || !note) {
    return;
  }

  await addChargeFollowUp(id, {
    channel: "WhatsApp",
    outcome,
    note,
  });
  await recordAuditEvent({
    action: "charge.whatsapp.signal_applied",
    entityType: "charge",
    entityId: id,
    payload: {
      summary: `Retorno do WhatsApp registrado como ${outcome.toLowerCase()}.`,
      metadata: {
        channel: "WhatsApp",
        outcome,
        note,
      },
    },
  });
  revalidateBillingViews();
}

export async function deleteChargeAction(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  await deleteCharge(id);
  revalidateBillingViews();
}
