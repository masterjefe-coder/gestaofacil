import { randomUUID } from "node:crypto";
import { ChargeStatus, type Charge as DbCharge } from "@prisma/client";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
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
    where: { workspaceId: workspace.id },
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

  await prisma.customer.deleteMany({
    where: {
      id,
      workspaceId,
    },
  });
}
