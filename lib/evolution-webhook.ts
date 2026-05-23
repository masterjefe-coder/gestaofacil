import { recordAuditEvent } from "@/lib/audit-repository";
import { isLocalDataMode } from "@/lib/data-mode";
import { prisma } from "@/lib/prisma";
import { extractMessageId, normalizePhone } from "@/lib/whatsapp-message-metadata";

type EvolutionWebhookPayload = {
  event?: string;
  instance?: string;
  data?: Record<string, unknown> | null;
  sender?: string;
  date_time?: string;
  [key: string]: unknown;
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildPreview(value: unknown, maxLength = 120) {
  const text = getString(value);

  if (!text) {
    return "";
  }

  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function pickMessagePreview(payload: EvolutionWebhookPayload) {
  const data = payload.data;

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "";
  }

  const message = data.message;
  const body = data.body;
  const text = data.text;

  if (message && typeof message === "object" && !Array.isArray(message)) {
    const candidate = (message as Record<string, unknown>).conversation
      || (message as Record<string, unknown>).text;

    return buildPreview(candidate);
  }

  return buildPreview(body || text);
}

function buildSummary(payload: EvolutionWebhookPayload) {
  const event = getString(payload.event) || "EVENTO_DESCONHECIDO";
  const instance = getString(payload.instance) || "sem-instancia";
  const preview = pickMessagePreview(payload);

  switch (event) {
    case "QRCODE_UPDATED":
      return `QR atualizado para a instância ${instance}.`;
    case "CONNECTION_UPDATE":
      return `Conexão do WhatsApp atualizada para a instância ${instance}.`;
    case "MESSAGES_UPSERT":
      return preview
        ? `Nova mensagem recebida na instância ${instance}: ${preview}`
        : `Nova mensagem recebida na instância ${instance}.`;
    case "MESSAGES_UPDATE":
      return `Status de mensagem atualizado na instância ${instance}.`;
    case "SEND_MESSAGE":
      return preview
        ? `Mensagem enviada pela instância ${instance}: ${preview}`
        : `Mensagem enviada pela instância ${instance}.`;
    default:
      return `Evento ${event} recebido da instância ${instance}.`;
  }
}

async function resolveWorkspaceIdFromInstance(instanceName: string) {
  if (!instanceName || isLocalDataMode()) {
    return null;
  }

  const exactMatch = await prisma.workspace.findUnique({
    where: { slug: instanceName },
    select: { id: true },
  });

  if (exactMatch) {
    return exactMatch.id;
  }

  const defaultInstance = process.env.EVOLUTION_API_INSTANCE?.trim();

  if (defaultInstance && instanceName === defaultInstance) {
    const workspaces = await prisma.workspace.findMany({
      select: { id: true },
      take: 2,
      orderBy: { createdAt: "asc" },
    });

    if (workspaces.length === 1) {
      return workspaces[0].id;
    }
  }

  return null;
}

async function resolveLinkedChargeId(workspaceId: string, remoteJid: string) {
  const normalizedRemote = normalizePhone(remoteJid.split("@")[0] || remoteJid);

  if (!normalizedRemote) {
    return null;
  }

  const recentSentAudits = await prisma.auditEvent.findMany({
    where: {
      workspaceId,
      entityType: "charge",
      action: "charge.whatsapp.sent",
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const matchedSentAudit = recentSentAudits.find((event) => {
    if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
      return false;
    }

    const metadata = event.payload.metadata;

    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return false;
    }

    const phone = normalizePhone(typeof metadata.phone === "string" ? metadata.phone : null);
    return Boolean(phone && phone === normalizedRemote);
  });

  if (matchedSentAudit) {
    return matchedSentAudit.entityId;
  }

  const customers = await prisma.customer.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      phone: {
        not: null,
      },
    },
    select: {
      id: true,
      phone: true,
    },
  });

  const customer = customers.find((entry) => normalizePhone(entry.phone) === normalizedRemote);

  if (!customer || normalizePhone(customer.phone) !== normalizedRemote) {
    return null;
  }

  const charge = await prisma.charge.findFirst({
    where: {
      workspaceId,
      customerId: customer.id,
      deletedAt: null,
      status: {
        not: "PAID",
      },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  return charge?.id || null;
}

async function resolveLinkedChargeIdByMessageId(workspaceId: string, messageId: string) {
  if (!messageId) {
    return null;
  }

  const recentSentAudits = await prisma.auditEvent.findMany({
    where: {
      workspaceId,
      entityType: "charge",
      action: "charge.whatsapp.sent",
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const matchedSentAudit = recentSentAudits.find((event) => {
    if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
      return false;
    }

    const metadata = event.payload.metadata;

    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return false;
    }

    return typeof metadata.messageId === "string" && metadata.messageId === messageId;
  });

  return matchedSentAudit?.entityId || null;
}

export async function handleEvolutionWebhook(payload: EvolutionWebhookPayload) {
  const instanceName = getString(payload.instance);
  const workspaceId = await resolveWorkspaceIdFromInstance(instanceName);

  if (!workspaceId) {
    return {
      stored: false,
      reason: "workspace_not_resolved",
      instance: instanceName || null,
    };
  }

  const event = getString(payload.event) || "EVENTO_DESCONHECIDO";
  const data = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
    ? payload.data as Record<string, unknown>
    : null;
  const remoteJid = getString(data?.remoteJid) || null;
  const messageId = extractMessageId(data);
  const linkedChargeId = await resolveLinkedChargeIdByMessageId(workspaceId, messageId)
    || (remoteJid ? await resolveLinkedChargeId(workspaceId, remoteJid) : null);

  await recordAuditEvent({
    action: `evolution.${event.toLowerCase()}`,
    entityType: "evolution",
    entityId: instanceName || "evolution-instance",
    workspaceId,
    actorId: null,
    payload: {
      summary: buildSummary(payload),
      metadata: {
        instance: instanceName || null,
        event,
        sender: getString(payload.sender) || null,
        remoteJid,
        messageId: messageId || null,
        messagePreview: pickMessagePreview(payload) || null,
        eventAt: getString(payload.date_time) || null,
        linkedChargeId,
      },
    },
  });

  if (linkedChargeId && event === "MESSAGES_UPSERT") {
    await recordAuditEvent({
      action: "charge.whatsapp.received",
      entityType: "charge",
      entityId: linkedChargeId,
      workspaceId,
      actorId: null,
      payload: {
        summary: buildSummary(payload),
        metadata: {
          instance: instanceName || null,
          remoteJid,
          messageId: messageId || null,
          messagePreview: pickMessagePreview(payload) || null,
        },
      },
    });
  }

  return {
    stored: true,
    workspaceId,
    instance: instanceName || null,
    event,
    linkedChargeId,
  };
}
