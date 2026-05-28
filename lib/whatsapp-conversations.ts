import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { isLocalDataMode } from "@/lib/data-mode";
import { prisma } from "@/lib/prisma";
import { normalizePhone, normalizeRemoteJid } from "@/lib/whatsapp-message-metadata";

export type WhatsappConversationMessageDirection = "inbound" | "outbound" | "failed" | "system";

export type WhatsappConversationMessage = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  createdAtSort: number;
  direction: WhatsappConversationMessageDirection;
  summary: string;
  preview: string;
  relatedHref: string;
};

export type WhatsappConversation = {
  customerId?: string;
  customerName: string;
  phone: string;
  lastEventAt: string;
  lastEventAtSort: number;
  lastSummary: string;
  inboundCount: number;
  outboundCount: number;
  failedCount: number;
  pendingReply: boolean;
  relatedHref: string;
  messages: WhatsappConversationMessage[];
};

type CustomerConversationTarget = {
  id: string;
  name: string;
  phone?: string | null;
};

type AuditEventLike = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: Date;
  payload: unknown;
};

type ConversationEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: Date;
  phone: string;
  customerName?: string;
  summary: string;
  preview: string;
};

const WHATSAPP_ACTIONS = [
  "evolution.messages_upsert",
  "customer.whatsapp.sent",
  "customer.whatsapp.failed",
  "quote.whatsapp.sent",
  "quote.whatsapp.failed",
  "charge.whatsapp.sent",
  "charge.whatsapp.failed",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readSummary(payload: unknown) {
  if (!isRecord(payload)) {
    return "Evento WhatsApp registrado.";
  }

  return typeof payload.summary === "string" && payload.summary.trim()
    ? payload.summary.trim()
    : "Evento WhatsApp registrado.";
}

function readMetadata(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.metadata)) {
    return null;
  }

  return payload.metadata;
}

function readString(record: Record<string, unknown> | null, key: string) {
  if (!record) {
    return "";
  }

  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function formatCreatedAt(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function buildPreview(summary: string, metadata: Record<string, unknown> | null) {
  const preview = readString(metadata, "messagePreview")
    || readString(metadata, "message")
    || readString(metadata, "detail");

  if (preview) {
    return preview;
  }

  return summary;
}

function resolveConversationPhone(metadata: Record<string, unknown> | null) {
  const directPhone = normalizePhone(readString(metadata, "phone"));

  if (directPhone) {
    return directPhone;
  }

  return normalizeRemoteJid(readString(metadata, "remoteJid"));
}

function getDirection(action: string): WhatsappConversationMessageDirection {
  if (action === "evolution.messages_upsert") {
    return "inbound";
  }

  if (action.endsWith(".whatsapp.sent")) {
    return "outbound";
  }

  if (action.endsWith(".whatsapp.failed")) {
    return "failed";
  }

  return "system";
}

function getRelatedHref(entityType: string) {
  switch (entityType) {
    case "charge":
      return "/dashboard/billing";
    case "quote":
      return "/dashboard/quotes";
    case "customer":
      return "/dashboard/customers";
    default:
      return "/dashboard/whatsapp";
  }
}

function buildConversationEvent(event: AuditEventLike): ConversationEvent | null {
  const metadata = readMetadata(event.payload);
  const phone = resolveConversationPhone(metadata);

  if (!phone) {
    return null;
  }

  const summary = readSummary(event.payload);

  return {
    id: event.id,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    createdAt: event.createdAt,
    phone,
    customerName: readString(metadata, "customer") || undefined,
    summary,
    preview: buildPreview(summary, metadata),
  };
}

export function buildWhatsappConversationSnapshot(
  customers: CustomerConversationTarget[],
  events: AuditEventLike[],
): WhatsappConversation[] {
  const customerByPhone = new Map(
    customers
      .map((customer) => [normalizePhone(customer.phone), customer] as const)
      .filter(([phone]) => Boolean(phone)),
  );
  const grouped = new Map<string, WhatsappConversation>();

  for (const event of events) {
    const normalized = buildConversationEvent(event);

    if (!normalized) {
      continue;
    }

    const customer = customerByPhone.get(normalized.phone);
    const current = grouped.get(normalized.phone);
    const direction = getDirection(normalized.action);
    const message: WhatsappConversationMessage = {
      id: normalized.id,
      action: normalized.action,
      entityType: normalized.entityType,
      entityId: normalized.entityId,
      createdAt: formatCreatedAt(normalized.createdAt),
      createdAtSort: normalized.createdAt.getTime(),
      direction,
      summary: normalized.summary,
      preview: normalized.preview,
      relatedHref: getRelatedHref(normalized.entityType),
    };

    if (!current) {
      grouped.set(normalized.phone, {
        customerId: customer?.id,
        customerName: customer?.name || normalized.customerName || `Contato ${normalized.phone.slice(-4)}`,
        phone: normalized.phone,
        lastEventAt: message.createdAt,
        lastEventAtSort: message.createdAtSort,
        lastSummary: message.summary,
        inboundCount: direction === "inbound" ? 1 : 0,
        outboundCount: direction === "outbound" ? 1 : 0,
        failedCount: direction === "failed" ? 1 : 0,
        pendingReply: direction === "inbound",
        relatedHref: message.relatedHref,
        messages: [message],
      });
      continue;
    }

    current.messages.push(message);
    current.customerId ||= customer?.id;
    current.customerName = customer?.name || current.customerName;
    current.inboundCount += direction === "inbound" ? 1 : 0;
    current.outboundCount += direction === "outbound" ? 1 : 0;
    current.failedCount += direction === "failed" ? 1 : 0;

    if (message.createdAtSort >= current.lastEventAtSort) {
      current.lastEventAt = message.createdAt;
      current.lastEventAtSort = message.createdAtSort;
      current.lastSummary = message.summary;
      current.relatedHref = message.relatedHref;
    }
  }

  return [...grouped.values()]
    .map((conversation) => {
      const messages = conversation.messages
        .sort((left, right) => right.createdAtSort - left.createdAtSort)
        .slice(0, 8);
      const latest = messages[0];

      return {
        ...conversation,
        pendingReply: latest?.direction === "inbound",
        messages,
      };
    })
    .sort((left, right) => right.lastEventAtSort - left.lastEventAtSort);
}

export async function listWhatsappConversations(): Promise<WhatsappConversation[]> {
  if (isLocalDataMode()) {
    return [];
  }

  await ensureDemoCommerceSeeded();
  const { workspaceId } = await getCurrentWorkspaceContext();
  const [customers, events] = await Promise.all([
    prisma.customer.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    }),
    prisma.auditEvent.findMany({
      where: {
        workspaceId,
        action: {
          in: [...WHATSAPP_ACTIONS],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 300,
    }),
  ]);

  return buildWhatsappConversationSnapshot(customers, events);
}
