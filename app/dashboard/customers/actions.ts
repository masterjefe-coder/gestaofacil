"use server";

import { revalidatePath } from "next/cache";
import { createCustomer, deleteCustomer } from "@/lib/customer-repository";
import type { CustomerInput } from "@/lib/types";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function createCustomerAction(formData: FormData) {
  const input: CustomerInput = {
    name: getString(formData, "name"),
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
