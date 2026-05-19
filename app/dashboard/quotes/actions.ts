"use server";

import { revalidatePath } from "next/cache";
import { createQuote, deleteQuote } from "@/lib/quote-repository";
import type { QuoteInput } from "@/lib/types";

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
