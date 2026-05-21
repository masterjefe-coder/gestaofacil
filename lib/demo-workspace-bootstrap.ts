import { prisma } from "@/lib/prisma";
import { canUsePublicDemoCredentials } from "@/lib/runtime-safety";
import { DEMO_WORKSPACE_ID } from "@/lib/data-mode";
import {
  encodeChargeMeta,
  encodeCustomerNotes,
  encodeQuoteSummary,
  inferDueDateFromLabel,
  inferPaymentMethod,
  mapChargeStatus,
  mapQuoteStatus,
  parseCurrencyToNumber,
} from "@/lib/demo-data-codecs";
import { readDemoWorkspaceData } from "@/lib/demo-store";

declare global {
  var gestaoFacilDemoWorkspacePromise: Promise<Awaited<ReturnType<typeof ensureDemoWorkspaceRecordInternal>>> | undefined;
  var gestaoFacilDemoCommercePromise: Promise<Awaited<ReturnType<typeof ensureDemoCommerceSeededInternal>>> | undefined;
}

function getDemoEmail() {
  return process.env.AUTH_DEMO_EMAIL || "demo@gestaofacil.local";
}

async function ensureDemoWorkspaceRecordInternal() {
  const data = await readDemoWorkspaceData();

  const workspace = await prisma.workspace.upsert({
    where: { slug: data.workspace.slug },
    update: {
      name: data.workspace.name,
    },
    create: {
      id: DEMO_WORKSPACE_ID,
      slug: data.workspace.slug,
      name: data.workspace.name,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: getDemoEmail() },
    update: {
      name: "demo",
    },
    create: {
      email: getDemoEmail(),
      name: "demo",
    },
  });

  await prisma.workspaceMembership.upsert({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId: workspace.id,
      },
    },
    update: {
      role: "OWNER",
    },
    create: {
      userId: user.id,
      workspaceId: workspace.id,
      role: "OWNER",
    },
  });

  return {
    workspace,
    user,
    localData: data,
  };
}

export async function ensureDemoWorkspaceRecord() {
  if (!global.gestaoFacilDemoWorkspacePromise) {
    global.gestaoFacilDemoWorkspacePromise = ensureDemoWorkspaceRecordInternal().catch((error) => {
      global.gestaoFacilDemoWorkspacePromise = undefined;
      throw error;
    });
  }

  return global.gestaoFacilDemoWorkspacePromise;
}

async function ensureDemoCommerceSeededInternal() {
  const state = await ensureDemoWorkspaceRecord();
  const workspaceId = state.workspace.id;

  const { nfseCount, customerCount, quoteCount, orderCount, chargeCount } = await Promise.all([
    prisma.nfseDocument.count({ where: { workspaceId } }),
    prisma.customer.count({ where: { workspaceId } }),
    prisma.quote.count({ where: { workspaceId } }),
    prisma.order.count({ where: { workspaceId } }),
    prisma.charge.count({ where: { workspaceId } }),
  ]).then(([nfseCount, customerCount, quoteCount, orderCount, chargeCount]) => ({
    nfseCount,
    customerCount,
    quoteCount,
    orderCount,
    chargeCount,
  }));

  if (customerCount === 0) {
    for (const customer of state.localData.customers) {
      await prisma.customer.create({
        data: {
          id: customer.id,
          workspaceId,
          name: customer.name,
          phone: customer.phone,
          city: customer.city,
          notes: encodeCustomerNotes(customer),
        },
      });
    }
  }

  const customers = await prisma.customer.findMany({
    where: { workspaceId },
  });
  const customersByName = new Map(customers.map((customer) => [customer.name, customer]));

  if (quoteCount === 0) {
    for (const quote of state.localData.quotes) {
      let customer = customersByName.get(quote.customer);

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            workspaceId,
            name: quote.customer,
            phone: null,
            notes: encodeCustomerNotes({
              segment: "Servico",
              status: "Ativo",
              note: "Cliente criado automaticamente a partir do seed de orcamentos.",
            }),
          },
        });

        customersByName.set(customer.name, customer);
      }

      const amount = parseCurrencyToNumber(quote.amount);

      await prisma.quote.create({
        data: {
          id: quote.id,
          workspaceId,
          customerId: customer.id,
          title: quote.title,
          summary: encodeQuoteSummary(quote),
          status: mapQuoteStatus(quote.status),
          subtotal: amount,
          total: amount,
          discount: 0,
        },
      });
    }
  }

  const quotes = await prisma.quote.findMany({
    where: { workspaceId },
  });
  const quotesById = new Map(quotes.map((quote) => [quote.id, quote]));

  if (orderCount === 0) {
    for (const order of state.localData.orders) {
      const customer = customersByName.get(order.customer);
      const quote = quotesById.get(order.sourceQuoteId);

      if (!customer || !quote) {
        continue;
      }

      await prisma.order.create({
        data: {
          id: order.id,
          workspaceId,
          customerId: customer.id,
          quoteId: quote.id,
          status:
            order.status === "Agendado"
              ? "SCHEDULED"
              : order.status === "Em execucao"
                ? "IN_PROGRESS"
                : order.status === "Concluido"
                  ? "COMPLETED"
                  : "PENDING",
          internalNotes: order.note,
        },
      });
    }
  }

  const orders = await prisma.order.findMany({
    where: { workspaceId },
    include: { quote: true, customer: true },
  });

  const orderByCustomerAndAmount = new Map(
    orders.map((order) => [`${order.customer.name}:::${Number(order.quote.total)}`, order]),
  );

  if (chargeCount === 0) {
    for (const charge of state.localData.charges) {
      let customer = customersByName.get(charge.customer);

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            workspaceId,
            name: charge.customer,
            phone: null,
            notes: encodeCustomerNotes({
              segment: "Servico",
              status: "Ativo",
              note: "Cliente criado automaticamente a partir do seed de cobrancas.",
            }),
          },
        });

        customersByName.set(customer.name, customer);
      }

      const amount = parseCurrencyToNumber(charge.amount);
      let order = orderByCustomerAndAmount.get(`${customer.name}:::${amount}`);

      if (!order) {
        const supportQuote = await prisma.quote.create({
          data: {
            id: `seed_quote_${charge.id}`,
            workspaceId,
            customerId: customer.id,
            title: `Base tecnica da cobranca - ${customer.name}`,
            summary: encodeQuoteSummary({
              status: "Aprovado",
              dueLabel: charge.dueLabel,
              summary: "Orcamento tecnico criado para sustentar cobranca seeded.",
            }),
            status: mapQuoteStatus("Aprovado"),
            subtotal: amount,
            total: amount,
            discount: 0,
          },
        });

        order = await prisma.order.create({
          data: {
            id: `seed_order_${charge.id}`,
            workspaceId,
            customerId: customer.id,
            quoteId: supportQuote.id,
            status: "PENDING",
            internalNotes: "Pedido tecnico criado para seed de cobranca demo.",
          },
          include: {
            quote: true,
            customer: true,
          },
        });
        orderByCustomerAndAmount.set(`${customer.name}:::${amount}`, order);
      }

      await prisma.charge.create({
        data: {
          id: charge.id,
          workspaceId,
          customerId: customer.id,
          orderId: order.id,
          amount,
          status: mapChargeStatus(charge.status),
          paymentMethod: inferPaymentMethod(charge.source),
          pixCode: encodeChargeMeta(charge),
          dueDate: charge.dueDate ? new Date(`${charge.dueDate}T12:00:00`) : inferDueDateFromLabel(charge.dueLabel),
        },
      });
    }
  }

  if (nfseCount === 0) {
    for (const document of state.localData.nfseDocuments || []) {
      const customer = customersByName.get(document.customer);
      const order = orders.find((item) => item.id === document.orderId);

      if (!customer || !order) {
        continue;
      }

      await prisma.nfseDocument.create({
        data: {
          id: document.id,
          workspaceId,
          customerId: customer.id,
          orderId: order.id,
          serviceAmount: parseCurrencyToNumber(document.serviceAmount),
          status:
            document.status === "Pronta"
              ? "READY"
              : document.status === "Emitida"
                ? "ISSUED"
                : document.status === "Erro"
                  ? "ERROR"
                  : document.status === "Cancelada"
                    ? "CANCELED"
                    : "DRAFT",
          verificationCode: document.verificationCode || null,
          externalId: document.externalId || null,
          issuedAt: document.issuedAt ? new Date(document.issuedAt) : null,
          errorMessage: document.errorMessage || null,
        },
      });
    }
  }

  return state;
}

export async function ensureDemoCommerceSeeded() {
  if (!canUsePublicDemoCredentials()) {
    return null;
  }

  if (!global.gestaoFacilDemoCommercePromise) {
    global.gestaoFacilDemoCommercePromise = ensureDemoCommerceSeededInternal().catch((error) => {
      global.gestaoFacilDemoCommercePromise = undefined;
      throw error;
    });
  }

  return global.gestaoFacilDemoCommercePromise;
}
