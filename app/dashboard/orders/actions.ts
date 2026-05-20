"use server";

import { revalidatePath } from "next/cache";
import { ensureOrderFromQuote, updateOrderStatus } from "@/lib/order-repository";
import type { Order } from "@/lib/types";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function revalidateOrderViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/fiscal");
  revalidatePath("/dashboard/reports");
}

export async function createOrderFromQuoteAction(formData: FormData) {
  const quoteId = getString(formData, "quoteId");

  if (!quoteId) {
    return;
  }

  await ensureOrderFromQuote(quoteId);
  revalidateOrderViews();
}

export async function updateOrderStatusAction(formData: FormData) {
  const id = getString(formData, "id");
  const status = getString(formData, "status") as Order["status"];
  const note = getString(formData, "note");

  if (!id || !status) {
    return;
  }

  await updateOrderStatus(id, {
    status,
    note: note || undefined,
  });
  revalidateOrderViews();
}
