"use server";

import { revalidatePath } from "next/cache";
import { addChargeFollowUp, createCharge, createChargeFromQuote, deleteCharge, updateCharge } from "@/lib/charge-repository";
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

export async function deleteChargeAction(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    return;
  }

  await deleteCharge(id);
  revalidateBillingViews();
}
