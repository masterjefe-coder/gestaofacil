import { NextResponse } from "next/server";
import { getLogger } from "@/lib/api-logger";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { ApiInputError, parseCustomerPayload, readJsonObject } from "@/lib/api-inputs";
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

  try {
    const body = parseCustomerPayload(await readJsonObject(request));
    const customer = await customersRouteDeps.createCustomer(body);

    requestLogger.info("Customer created", { customerId: customer.id, name: body.name });
    return attachRequestId(NextResponse.json({ customer }, { status: 201 }), requestId);
  } catch (error) {
    if (error instanceof ApiInputError) {
      requestLogger.warn("Customer creation rejected — invalid request payload", { reason: error.message });
      return attachRequestId(NextResponse.json({ error: error.message }, { status: 400 }), requestId);
    }

    const message = error instanceof Error ? error.message : "Falha ao criar o cliente.";
    requestLogger.error("Customer creation failed", error instanceof Error ? error : undefined);
    return attachRequestId(NextResponse.json({ error: message }, { status: 400 }), requestId);
  }
}
