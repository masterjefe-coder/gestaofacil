import { listChargeWhatsappHistory } from "@/lib/charge-whatsapp-history";
import { listCharges } from "@/lib/charge-repository";
import { listCustomerWhatsappActivity } from "@/lib/customer-whatsapp-activity";
import { listCustomers } from "@/lib/customer-repository";
import { isLocalDataMode } from "@/lib/data-mode";
import { listNfseDocuments } from "@/lib/nfse-repository";
import { listOrders } from "@/lib/order-repository";
import { prisma } from "@/lib/prisma";
import { listQuotes } from "@/lib/quote-repository";

export type CustomerTimelineEntry = {
  id: string;
  customerId: string;
  createdAt: string;
  title: string;
  detail: string;
  source: "commercial" | "operations" | "billing" | "whatsapp" | "fiscal";
};

type TimelineEntryInternal = CustomerTimelineEntry & {
  sortAt: number;
};

function formatCreatedAt(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Modo local";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getAuditTimelineTitle(action: string, entityType: string) {
  switch (`${entityType}:${action}`) {
    case "customer:customer.created":
      return "Cliente criado";
    case "customer:customer.updated":
      return "Status do cliente atualizado";
    case "customer:customer.whatsapp.sent":
      return "Reativação enviada no WhatsApp";
    case "customer:customer.whatsapp.failed":
      return "Falha em reativação no WhatsApp";
    case "quote:quote.created":
      return "Orçamento criado";
    case "quote:quote.updated":
      return "Orçamento atualizado";
    case "quote:quote.whatsapp.sent":
      return "Follow-up comercial enviado";
    case "quote:quote.whatsapp.failed":
      return "Falha no follow-up comercial";
    case "charge:charge.created":
      return "Cobrança criada";
    case "charge:charge.updated":
      return "Cobrança atualizada";
    case "charge:charge.followup.created":
      return "Follow-up financeiro registrado";
    case "charge:charge.whatsapp.sent":
      return "Cobrança enviada no WhatsApp";
    case "charge:charge.whatsapp.failed":
      return "Falha no envio da cobrança";
    case "charge:charge.whatsapp.signal_applied":
      return "Retorno do WhatsApp aplicado";
    case "nfse:nfse.created":
      return "Rascunho fiscal criado";
    case "nfse:nfse.updated":
      return "Documento fiscal atualizado";
    default:
      return entityType === "nfse" ? "Movimento fiscal" : "Movimento operacional";
  }
}

function getAuditTimelineSource(entityType: string): CustomerTimelineEntry["source"] {
  switch (entityType) {
    case "charge":
      return "billing";
    case "nfse":
      return "fiscal";
    case "customer":
    case "quote":
      return "commercial";
    default:
      return "operations";
  }
}

export async function listCustomerUnifiedTimeline() {
  const [customers, quotes, orders, charges, nfseDocuments, whatsappActivity] = await Promise.all([
    listCustomers(),
    listQuotes(),
    listOrders(),
    listCharges(),
    listNfseDocuments(),
    listCustomerWhatsappActivity().catch(() => []),
  ]);

  const chargeWhatsappHistory = await listChargeWhatsappHistory(charges).catch(() => new Map());
  const customerByName = new Map(customers.map((customer) => [customer.name, customer]));
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));
  const timelines = new Map<string, TimelineEntryInternal[]>();

  const ensureTimeline = (customerId: string) => {
    const current = timelines.get(customerId) || [];
    timelines.set(customerId, current);
    return current;
  };

  if (!isLocalDataMode()) {
    const [dbQuotes, dbOrders, dbCharges, dbNfseDocuments, customerAudit, quoteAudit, chargeAudit, nfseAudit] = await Promise.all([
      prisma.quote.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
          customerId: true,
        },
      }),
      prisma.order.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          createdAt: true,
          customerId: true,
        },
      }),
      prisma.charge.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          createdAt: true,
          customerId: true,
        },
      }),
      prisma.nfseDocument.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          createdAt: true,
          customerId: true,
        },
      }),
      prisma.auditEvent.findMany({
        where: {
          entityType: "customer",
          entityId: {
            in: customers.map((customer) => customer.id),
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.auditEvent.findMany({
        where: {
          entityType: "quote",
          entityId: {
            in: quotes.map((quote) => quote.id),
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.auditEvent.findMany({
        where: {
          entityType: "charge",
          entityId: {
            in: charges.map((charge) => charge.id),
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.auditEvent.findMany({
        where: {
          entityType: "nfse",
          entityId: {
            in: nfseDocuments.map((document) => document.id),
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

    const quoteDates = new Map(dbQuotes.map((item) => [item.id, { customerId: item.customerId, createdAt: item.createdAt }]));
    const orderDates = new Map(dbOrders.map((item) => [item.id, { customerId: item.customerId, createdAt: item.createdAt }]));
    const chargeDates = new Map(dbCharges.map((item) => [item.id, { customerId: item.customerId, createdAt: item.createdAt }]));
    const nfseDates = new Map(dbNfseDocuments.map((item) => [item.id, { customerId: item.customerId, createdAt: item.createdAt }]));
    const chargeCustomerById = new Map(charges.map((charge) => [charge.id, customerByName.get(charge.customer)?.id]));
    const nfseCustomerById = new Map(nfseDocuments.map((document) => [document.id, customerByName.get(document.customer)?.id]));

    for (const quote of quotes) {
      const customer = customerByName.get(quote.customer);
      const dateInfo = quoteDates.get(quote.id);

      if (!customer || !dateInfo || dateInfo.customerId !== customer.id) {
        continue;
      }

      ensureTimeline(customer.id).push({
        id: `quote-${quote.id}`,
        customerId: customer.id,
        createdAt: formatCreatedAt(dateInfo.createdAt),
        sortAt: dateInfo.createdAt.getTime(),
        title: `Orçamento ${quote.status.toLowerCase()}`,
        detail: `${quote.title} · ${quote.amount}. ${quote.dueLabel}`,
        source: "commercial",
      });
    }

    for (const order of orders) {
      const customer = customerByName.get(order.customer);
      const dateInfo = orderDates.get(order.id);

      if (!customer || !dateInfo || dateInfo.customerId !== customer.id) {
        continue;
      }

      ensureTimeline(customer.id).push({
        id: `order-${order.id}`,
        customerId: customer.id,
        createdAt: formatCreatedAt(dateInfo.createdAt),
        sortAt: dateInfo.createdAt.getTime(),
        title: `Pedido ${order.status.toLowerCase()}`,
        detail: `${order.title} · ${order.amount}. ${order.note}`,
        source: "operations",
      });
    }

    for (const charge of charges) {
      const customer = customerByName.get(charge.customer);
      const dateInfo = chargeDates.get(charge.id);

      if (!customer || !dateInfo || dateInfo.customerId !== customer.id) {
        continue;
      }

      ensureTimeline(customer.id).push({
        id: `charge-${charge.id}`,
        customerId: customer.id,
        createdAt: formatCreatedAt(dateInfo.createdAt),
        sortAt: dateInfo.createdAt.getTime(),
        title: `Cobrança ${charge.status.toLowerCase()}`,
        detail: `${charge.amount}. ${charge.dueLabel}`,
        source: "billing",
      });
    }

    for (const document of nfseDocuments) {
      const customer = customerByName.get(document.customer);
      const dateInfo = nfseDates.get(document.id);

      if (!customer || !dateInfo || dateInfo.customerId !== customer.id) {
        continue;
      }

      ensureTimeline(customer.id).push({
        id: `nfse-${document.id}`,
        customerId: customer.id,
        createdAt: formatCreatedAt(dateInfo.createdAt),
        sortAt: dateInfo.createdAt.getTime(),
        title: `NFS-e ${document.status.toLowerCase()}`,
        detail: `${document.serviceAmount}. ${document.serviceDescription}`,
        source: "fiscal",
      });
    }

    for (const event of customerAudit) {
      const customer = customerById.get(event.entityId);

      if (!customer) {
        continue;
      }

      ensureTimeline(customer.id).push({
        id: `customer-audit-${event.id}`,
        customerId: customer.id,
        createdAt: formatCreatedAt(event.createdAt),
        sortAt: event.createdAt.getTime(),
        title: "Atualização de cliente",
        detail: typeof event.payload === "object" && event.payload && "summary" in event.payload && typeof event.payload.summary === "string"
          ? event.payload.summary
          : "Evento registrado no cadastro do cliente.",
        source: "commercial",
      });
    }

    for (const event of quoteAudit) {
      const quote = quoteById.get(event.entityId);
      const customer = quote ? customerByName.get(quote.customer) : null;

      if (!quote || !customer) {
        continue;
      }

      ensureTimeline(customer.id).push({
        id: `quote-audit-${event.id}`,
        customerId: customer.id,
        createdAt: formatCreatedAt(event.createdAt),
        sortAt: event.createdAt.getTime(),
        title: "Movimento de orçamento",
        detail: typeof event.payload === "object" && event.payload && "summary" in event.payload && typeof event.payload.summary === "string"
          ? event.payload.summary
          : "Evento registrado no orçamento do cliente.",
        source: "commercial",
      });
    }

    for (const event of chargeAudit) {
      const customerId = chargeCustomerById.get(event.entityId);

      if (!customerId) {
        continue;
      }

      ensureTimeline(customerId).push({
        id: `charge-audit-${event.id}`,
        customerId,
        createdAt: formatCreatedAt(event.createdAt),
        sortAt: event.createdAt.getTime(),
        title: getAuditTimelineTitle(event.action, "charge"),
        detail: typeof event.payload === "object" && event.payload && "summary" in event.payload && typeof event.payload.summary === "string"
          ? event.payload.summary
          : "Evento registrado na cobrança do cliente.",
        source: getAuditTimelineSource("charge"),
      });
    }

    for (const event of nfseAudit) {
      const customerId = nfseCustomerById.get(event.entityId);

      if (!customerId) {
        continue;
      }

      ensureTimeline(customerId).push({
        id: `nfse-audit-${event.id}`,
        customerId,
        createdAt: formatCreatedAt(event.createdAt),
        sortAt: event.createdAt.getTime(),
        title: getAuditTimelineTitle(event.action, "nfse"),
        detail: typeof event.payload === "object" && event.payload && "summary" in event.payload && typeof event.payload.summary === "string"
          ? event.payload.summary
          : "Evento registrado no documento fiscal do cliente.",
        source: getAuditTimelineSource("nfse"),
      });
    }
  } else {
    for (const quote of quotes) {
      const customer = customerByName.get(quote.customer);

      if (!customer) {
        continue;
      }

      ensureTimeline(customer.id).push({
        id: `quote-${quote.id}`,
        customerId: customer.id,
        createdAt: "Modo local",
        sortAt: 0,
        title: `Orçamento ${quote.status.toLowerCase()}`,
        detail: `${quote.title} · ${quote.amount}. ${quote.dueLabel}`,
        source: "commercial",
      });
    }

    for (const order of orders) {
      const customer = customerByName.get(order.customer);

      if (!customer) {
        continue;
      }

      ensureTimeline(customer.id).push({
        id: `order-${order.id}`,
        customerId: customer.id,
        createdAt: "Modo local",
        sortAt: 0,
        title: `Pedido ${order.status.toLowerCase()}`,
        detail: `${order.title} · ${order.amount}. ${order.note}`,
        source: "operations",
      });
    }

    for (const charge of charges) {
      const customer = customerByName.get(charge.customer);

      if (!customer) {
        continue;
      }

      ensureTimeline(customer.id).push({
        id: `charge-${charge.id}`,
        customerId: customer.id,
        createdAt: "Modo local",
        sortAt: 0,
        title: `Cobrança ${charge.status.toLowerCase()}`,
        detail: `${charge.amount}. ${charge.dueLabel}`,
        source: "billing",
      });

      for (const followUp of charge.followUps || []) {
        ensureTimeline(customer.id).push({
          id: `charge-followup-${followUp.id}`,
          customerId: customer.id,
          createdAt: formatCreatedAt(followUp.createdAt),
          sortAt: new Date(followUp.createdAt).getTime() || 0,
          title: `Follow-up financeiro · ${followUp.outcome}`,
          detail: `${followUp.channel}. ${followUp.note}`,
          source: followUp.channel === "WhatsApp" || followUp.channel === "Pix reenviado" ? "whatsapp" : "billing",
        });
      }
    }

    for (const document of nfseDocuments) {
      const customer = customerByName.get(document.customer);

      if (!customer) {
        continue;
      }

      ensureTimeline(customer.id).push({
        id: `nfse-${document.id}`,
        customerId: customer.id,
        createdAt: "Modo local",
        sortAt: 0,
        title: `NFS-e ${document.status.toLowerCase()}`,
        detail: `${document.serviceAmount}. ${document.serviceDescription}`,
        source: "fiscal",
      });
    }
  }

  for (const customer of customers) {
    const activity = whatsappActivity.find((item) => item.customerId === customer.id);

    if (activity?.eventCount) {
      ensureTimeline(customer.id).push({
        id: `wa-activity-${customer.id}`,
        customerId: customer.id,
        createdAt: activity.lastEventAt || "Modo local",
        sortAt: 0,
        title: "Sinal recente no WhatsApp",
        detail: activity.lastEventSummary || "Webhook associou atividade real a este cliente.",
        source: "whatsapp",
      });
    }
  }

  for (const charge of charges) {
    const customer = customerByName.get(charge.customer);
    const whatsappEntries = chargeWhatsappHistory.get(charge.id) || [];

    if (!customer) {
      continue;
    }

    for (const entry of whatsappEntries) {
      ensureTimeline(customer.id).push({
        id: `wa-history-${entry.id}`,
        customerId: customer.id,
        createdAt: entry.createdAt,
        sortAt: 0,
        title: "Evento de WhatsApp na cobrança",
        detail: entry.summary,
        source: "whatsapp",
      });
    }
  }

  for (const [customerId, entries] of timelines.entries()) {
    timelines.set(
      customerId,
      entries
        .sort((left, right) => right.sortAt - left.sortAt)
        .slice(0, 8),
    );
  }

  return new Map(
    [...timelines.entries()].map(([customerId, entries]) => [
      customerId,
      entries.map((entry) => ({
        id: entry.id,
        customerId: entry.customerId,
        createdAt: entry.createdAt,
        title: entry.title,
        detail: entry.detail,
        source: entry.source,
      })),
    ]),
  ) as Map<string, CustomerTimelineEntry[]>;
}
