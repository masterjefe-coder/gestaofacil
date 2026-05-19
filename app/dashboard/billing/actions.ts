"use server";

import { revalidatePath } from "next/cache";
import { createCharge, createChargeFromQuote, deleteCharge } from "@/lib/charge-repository";
import type { ChargeInput } from "@/lib/types";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function createChargeAction(formData: FormData) {
  const quoteId = getString(formData, "quoteId");
  const paymentMethod = getString(formData, "paymentMethod") || "Pix";
  const dueLabel = getString(formData, "dueLabel");
  const dueDate = getString(formData, "dueDate") || undefined;
  const status = (getString(formData, "status") as ChargeInput["status"]) || "Pendente";

  if (quoteId) {
    await createChargeFromQuote(quoteId, paymentMethod, dueLabel, dueDate, status);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/billing");
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
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
}

export async function deleteChargeAction(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  await deleteCharge(id);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
}
