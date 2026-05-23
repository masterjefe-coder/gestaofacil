import { NextResponse } from "next/server";
import { getLogger } from "@/lib/api-logger";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { attachRequestId, getOrCreateRequestId } from "@/lib/request-tracing";
import { createCustomer, listCustomers } from "@/lib/customer-repository";

const logger = getLogger({ route: "api/customers" });

export const customersRouteDeps = {
  requireApiModuleAccess,
  listCustomers,
  createCustomer,
};

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await customersRouteDeps.requireApiModuleAccess("customers", "canView");
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  const customers = await customersRouteDeps.listCustomers();
  requestLogger.info("Customers listed", { count: customers.length });
  return attachRequestId(NextResponse.json({ customers }), requestId);
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const requestLogger = logger.child({ requestId });
  const unauthorized = await customersRouteDeps.requireApiModuleAccess("customers", "canManage");
  if (unauthorized) {
    return attachRequestId(unauthorized, requestId);
  }

  const body = (await request.json()) as {
    name?: string;
    document?: string;
    segment?: string;
    city?: string;
    status?: "Ativo" | "Aguardando retorno" | "Recorrente";
    note?: string;
  };

  if (!body.name || !body.segment || !body.city) {
    requestLogger.warn("Customer creation rejected — missing required fields");
    return attachRequestId(NextResponse.json({ error: "Dados obrigatorios ausentes." }, { status: 400 }), requestId);
  }

  const customer = await customersRouteDeps.createCustomer({
    name: body.name,
    document: body.document || undefined,
    segment: body.segment,
    city: body.city,
    status: body.status || "Ativo",
    note: body.note || "",
  });

  requestLogger.info("Customer created", { customerId: customer.id, name: body.name });
  return attachRequestId(NextResponse.json({ customer }, { status: 201 }), requestId);
}
