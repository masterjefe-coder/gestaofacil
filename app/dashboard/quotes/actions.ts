"use server";

import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit-repository";
import { buildQuoteFollowUpTemplate } from "@/lib/customer-outreach";
import { listCustomers } from "@/lib/customer-repository";
import { EvolutionApiError, sendEvolutionTextMessage } from "@/lib/evolution-api";
import { createQuote, deleteQuote, listQuotes, updateQuote } from "@/lib/quote-repository";
import type { QuoteInput } from "@/lib/types";

function buildQuoteCadenceState(status: QuoteInput["status"]) {
  switch (status) {
    case "Aprovado":
      return {
        cadenceLabel: "Aprovação pronta para conversão operacional",
        executionLabel: "Gerar cobrança ou pedido",
        completedStepLabel: "Proposta aprovada pelo cliente",
        nextStepLabel: "Converter em cobrança ou pedido",
      };
    case "Follow-up":
      return {
        cadenceLabel: "Proposta já entrou em follow-up ativo",
        executionLabel: "Enviar nova tentativa",
        completedStepLabel: "Primeiro envio já aconteceu",
        nextStepLabel: "Executar nova tentativa com CTA claro",
      };
    default:
      return {
        cadenceLabel: "Aguardando leitura ou resposta do cliente",
        executionLabel: "Monitorar e puxar próxima cadência",
        completedStepLabel: "Proposta enviada e aguardando reação",
        nextStepLabel: "Programar próximo contato",
      };
  }
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function createQuoteAction(formData: FormData) {
  const input: QuoteInput = {
    customer: getString(formData, "customer"),
    title: getString(formData, "title"),
    amount: getString(formData, "amount"),
    status: (getString(formData, "status") as QuoteInput["status"]) || "Enviado",
    dueLabel: getString(formData, "dueLabel"),
    summary: getString(formData, "summary"),
    cadence: buildQuoteCadenceState((getString(formData, "status") as QuoteInput["status"]) || "Enviado"),
  };

  if (!input.customer || !input.title || !input.amount) {
    return;
  }

  await createQuote(input);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/quotes");
}

export async function deleteQuoteAction(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  await deleteQuote(id);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/quotes");
}

export async function sendQuoteWhatsappAction(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  const [quotes, customers] = await Promise.all([
    listQuotes(),
    listCustomers(),
  ]);
  const quote = quotes.find((item) => item.id === id);

  if (!quote) {
    return;
  }

  const customer = customers.find((item) => item.name === quote.customer);

  if (!customer?.phone) {
    return;
  }

  const template = buildQuoteFollowUpTemplate({
    quote,
    customer,
  });

  try {
    await sendEvolutionTextMessage({
      number: customer.phone,
      text: template.message,
    });

    await updateQuote(id, {
      status: quote.status === "Aprovado" ? "Aprovado" : "Follow-up",
      dueLabel: "Follow-up comercial enviado por WhatsApp",
      cadence: buildQuoteCadenceState(quote.status === "Aprovado" ? "Aprovado" : "Follow-up"),
    });
    await recordAuditEvent({
      action: "quote.whatsapp.sent",
      entityType: "quote",
      entityId: id,
      payload: {
        summary: `Follow-up de orçamento enviado para ${quote.customer}.`,
        metadata: {
          customer: quote.customer,
          phone: customer.phone,
          title: quote.title,
          message: template.message,
        },
      },
    });
  } catch (error) {
    const detail = error instanceof EvolutionApiError ? error.message : "Falha desconhecida no envio comercial.";

    await recordAuditEvent({
      action: "quote.whatsapp.failed",
      entityType: "quote",
      entityId: id,
      payload: {
        summary: `Falha ao enviar follow-up de orçamento para ${quote.customer}.`,
        metadata: {
          customer: quote.customer,
          phone: customer.phone,
          title: quote.title,
          detail,
        },
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/quotes");
  revalidatePath("/dashboard/customers");
}

export async function advanceQuoteCadenceAction(formData: FormData) {
  const id = getString(formData, "id");
  const status = getString(formData, "status") as QuoteInput["status"];
  const dueLabel = getString(formData, "dueLabel");
  const summary = getString(formData, "summary");

  if (!id || !status) {
    return;
  }

  await updateQuote(id, {
    status,
    dueLabel: dueLabel || undefined,
    summary: summary || undefined,
    cadence: buildQuoteCadenceState(status),
  });

  await recordAuditEvent({
    action: "quote.cadence.advanced",
    entityType: "quote",
    entityId: id,
    payload: {
      summary: `Cadência comercial avançada para ${status.toLowerCase()}.`,
      metadata: {
        status,
        dueLabel: dueLabel || null,
        summary: summary || null,
      },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/quotes");
  revalidatePath("/dashboard/customers");
}
