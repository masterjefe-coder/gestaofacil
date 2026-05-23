import { randomUUID } from "node:crypto";
import { ChargeStatus, type Charge as DbCharge } from "@prisma/client";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { recordAuditEvent } from "@/lib/audit-repository";
import { isLocalDataMode } from "@/lib/data-mode";
import { decodeCustomerNotes, encodeCustomerNotes, formatCurrency } from "@/lib/demo-data-codecs";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import type { Customer, CustomerInput } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { readDemoWorkspaceData, writeDemoWorkspaceData } from "@/lib/demo-store";

function formatLastSale(charges: DbCharge[]) {
  const paidDates = charges
    .map((charge) => charge.paidAt)
    .filter((paidAt): paidAt is Date => paidAt instanceof Date)
    .sort((left, right) => right.getTime() - left.getTime());

  if (paidDates.length === 0) {
    return "Sem venda ainda";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(paidDates[0]);
}

function formatOpenAmount(charges: DbCharge[]) {
  const total = charges
    .filter((charge) => charge.status !== ChargeStatus.PAID && charge.status !== ChargeStatus.CANCELED)
    .reduce((sum, charge) => sum + Number(charge.amount), 0);

  return formatCurrency(total);
}

async function ensureDemoCustomersSeeded() {
  await ensureDemoCommerceSeeded();
  const { workspaceId } = await getCurrentWorkspaceContext();

  return { id: workspaceId };
}

export async function listCustomers(): Promise<Customer[]> {
  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    return data.customers;
  }

  const workspace = await ensureDemoCustomersSeeded();

  const dbCustomers = await prisma.customer.findMany({
    where: {
      workspaceId: workspace.id,
      deletedAt: null,
    },
    include: {
      charges: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return dbCustomers.map((customer): Customer => {
    const meta = decodeCustomerNotes(customer.notes);

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone || undefined,
      document: customer.document || undefined,
      segment: meta.segment,
      city: customer.city || "Sem cidade",
      status: meta.status,
      lastSale: formatLastSale(customer.charges),
      openAmount: formatOpenAmount(customer.charges),
      note: meta.note,
    };
  });
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    const customer: Customer = {
      id: randomUUID(),
      name: input.name,
      phone: input.phone,
      document: input.document,
      segment: input.segment,
      city: input.city,
      status: input.status,
      lastSale: "Sem venda ainda",
      openAmount: "R$ 0",
      note: input.note || "Novo cliente criado no dashboard.",
    };

    data.customers = [customer, ...data.customers];
    await writeDemoWorkspaceData(data);
    return customer;
  }

  const workspace = await ensureDemoCustomersSeeded();

  const customer = await prisma.customer.create({
      data: {
        workspaceId: workspace.id,
        name: input.name,
        phone: input.phone,
        document: input.document,
        city: input.city,
        notes: encodeCustomerNotes(input),
    },
  });

  await recordAuditEvent({
    action: "customer.created",
    entityType: "customer",
    entityId: customer.id,
    payload: {
      summary: `Cliente ${customer.name} criado na base.`,
      metadata: {
        customer: customer.name,
        status: input.status,
        city: customer.city || "",
      },
    },
  });

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone || undefined,
    document: customer.document || undefined,
    segment: input.segment,
    city: customer.city || "Sem cidade",
    status: input.status,
    lastSale: "Sem venda ainda",
    openAmount: "R$ 0",
    note: input.note || "Novo cliente criado no dashboard.",
  } satisfies Customer;
}

export async function updateCustomerStatus(
  id: string,
  status: Customer["status"],
  note?: string,
): Promise<Customer | null> {
  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    const index = data.customers.findIndex((customer) => customer.id === id);

    if (index === -1) {
      return null;
    }

    const current = data.customers[index];
    const updated: Customer = {
      ...current,
      status,
      note: note || current.note,
    };

    data.customers[index] = updated;
    await writeDemoWorkspaceData(data);
    return updated;
  }

  await ensureDemoCommerceSeeded();
  const { workspaceId } = await getCurrentWorkspaceContext();
  const existing = await prisma.customer.findFirst({
    where: {
      id,
      workspaceId,
      deletedAt: null,
    },
    include: {
      charges: true,
    },
  });

  if (!existing) {
    return null;
  }

  const currentMeta = decodeCustomerNotes(existing.notes);
  const nextMeta = {
    segment: currentMeta.segment,
    status,
    note: note || currentMeta.note,
  };

  const updated = await prisma.customer.update({
    where: { id: existing.id },
    data: {
      notes: encodeCustomerNotes(nextMeta),
      version: {
        increment: 1,
      },
    },
    include: {
      charges: true,
    },
  });

  await recordAuditEvent({
    action: "customer.updated",
    entityType: "customer",
    entityId: updated.id,
    payload: {
      summary: `Cliente ${updated.name} atualizado para ${status.toLowerCase()}.`,
      metadata: {
        customer: updated.name,
        status,
        note: nextMeta.note,
      },
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    phone: updated.phone || undefined,
    document: updated.document || undefined,
    segment: currentMeta.segment,
    city: updated.city || "Sem cidade",
    status,
    lastSale: formatLastSale(updated.charges),
    openAmount: formatOpenAmount(updated.charges),
    note: nextMeta.note,
  };
}

function normalizeLookup(value: string) {
  return value.replace(/\W/g, "").toLowerCase();
}

export async function findCustomerByLookup(lookup: string): Promise<Customer | null> {
  const normalizedLookup = normalizeLookup(lookup);

  if (!normalizedLookup) {
    return null;
  }

  const customers = await listCustomers();

  return customers.find((customer) => {
    const normalizedName = normalizeLookup(customer.name);
    const normalizedDocument = normalizeLookup(customer.document || "");

    return normalizedDocument === normalizedLookup || normalizedName.includes(normalizedLookup);
  }) || null;
}

export async function deleteCustomer(id: string): Promise<void> {
  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    data.customers = data.customers.filter((customer) => customer.id !== id);
    await writeDemoWorkspaceData(data);
    return;
  }

  await ensureDemoCommerceSeeded();
  const { workspaceId } = await getCurrentWorkspaceContext();

  await prisma.customer.updateMany({
    where: {
      id,
      workspaceId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
      version: {
        increment: 1,
      },
    },
  });
}
