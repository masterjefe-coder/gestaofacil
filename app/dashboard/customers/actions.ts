"use server";

import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit-repository";
import { buildCustomerReactivationTemplate } from "@/lib/customer-outreach";
import { createCustomer, deleteCustomer, listCustomers, updateCustomerStatus } from "@/lib/customer-repository";
import { EvolutionApiError, sendEvolutionTextMessage } from "@/lib/evolution-api";
import type { CustomerInput } from "@/lib/types";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function createCustomerAction(formData: FormData) {
  const input: CustomerInput = {
    name: getString(formData, "name"),
    phone: getString(formData, "phone") || undefined,
    document: getString(formData, "document") || undefined,
    segment: getString(formData, "segment"),
    city: getString(formData, "city"),
    status: (getString(formData, "status") as CustomerInput["status"]) || "Ativo",
    note: getString(formData, "note"),
  };

  if (!input.name || !input.segment || !input.city) {
    return;
  }

  await createCustomer(input);
  revalidatePath("/dashboard/customers");
}

export async function deleteCustomerAction(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  await deleteCustomer(id);
  revalidatePath("/dashboard/customers");
}

export async function sendCustomerReactivationWhatsappAction(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  const customers = await listCustomers();
  const customer = customers.find((item) => item.id === id);

  if (!customer?.phone) {
    return;
  }

  const template = buildCustomerReactivationTemplate(customer);

  try {
    await sendEvolutionTextMessage({
      number: customer.phone,
      text: template.message,
    });

    await updateCustomerStatus(id, "Aguardando retorno", "Cliente entrou em reativação assistida via WhatsApp.");
    await recordAuditEvent({
      action: "customer.whatsapp.sent",
      entityType: "customer",
      entityId: id,
      payload: {
        summary: `Mensagem de reativação enviada para ${customer.name}.`,
        metadata: {
          customer: customer.name,
          phone: customer.phone,
          message: template.message,
        },
      },
    });
  } catch (error) {
    const detail = error instanceof EvolutionApiError ? error.message : "Falha desconhecida na reativação pelo WhatsApp.";

    await recordAuditEvent({
      action: "customer.whatsapp.failed",
      entityType: "customer",
      entityId: id,
      payload: {
        summary: `Falha ao enviar mensagem de reativação para ${customer.name}.`,
        metadata: {
          customer: customer.name,
          phone: customer.phone,
          detail,
        },
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/customers");
}
