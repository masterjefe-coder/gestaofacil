"use server";

import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit-repository";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { listCustomers } from "@/lib/customer-repository";
import { EvolutionApiError, sendEvolutionTextMessage } from "@/lib/evolution-api";
import { extractMessageId, extractMessagePreview, extractRemoteJid, normalizePhone, normalizeRemoteJid } from "@/lib/whatsapp-message-metadata";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function revalidateWhatsappViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/whatsapp");
}

export async function sendManualWhatsappMessageAction(formData: FormData) {
  await getCurrentWorkspaceContext();

  const customerId = getString(formData, "customerId");
  const phoneInput = getString(formData, "phone");
  const message = getString(formData, "message");

  if (!message) {
    return;
  }

  const customers = await listCustomers();
  const customer = customerId
    ? customers.find((item) => item.id === customerId)
    : customers.find((item) => normalizePhone(item.phone) === normalizePhone(phoneInput));
  const phone = customer?.phone || phoneInput;

  if (!phone) {
    return;
  }

  try {
    const response = await sendEvolutionTextMessage({
      number: phone,
      text: message,
    });
    const responseMessageId = extractMessageId(response);
    const responseRemoteJid = extractRemoteJid(response);
    const resolvedPhone = normalizeRemoteJid(responseRemoteJid) || normalizePhone(phone);

    if (customer) {
      await recordAuditEvent({
        action: "customer.whatsapp.sent",
        entityType: "customer",
        entityId: customer.id,
        payload: {
          summary: `Mensagem manual enviada para ${customer.name}.`,
          metadata: {
            customer: customer.name,
            phone: resolvedPhone,
            message,
            messageId: responseMessageId || null,
            remoteJid: responseRemoteJid || null,
            messagePreview: extractMessagePreview(response) || message,
          },
        },
      });
    }
  } catch (error) {
    const detail = error instanceof EvolutionApiError ? error.message : "Falha desconhecida no envio manual.";

    if (customer) {
      await recordAuditEvent({
        action: "customer.whatsapp.failed",
        entityType: "customer",
        entityId: customer.id,
        payload: {
          summary: `Falha ao enviar mensagem manual para ${customer.name}.`,
          metadata: {
            customer: customer.name,
            phone: normalizePhone(phone),
            message,
            detail,
          },
        },
      });
    }
  }

  revalidateWhatsappViews();
}
