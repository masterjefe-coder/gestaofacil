import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { isLocalDataMode } from "@/lib/data-mode";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { prisma } from "@/lib/prisma";
import type { ChargeFollowUpOutcome } from "@/lib/types";

export type ChargeWhatsappSignal = {
  customerName: string;
  phone?: string;
  eventCount: number;
  lastEventAt?: string;
  lastEventSummary?: string;
  lastMessagePreview?: string;
  inboundReplyDetected: boolean;
  suggestedOutcome?: ChargeFollowUpOutcome;
  suggestedNote?: string;
};

type EventSnapshot = {
  createdAt: Date;
  action: string;
  summary: string;
  messagePreview?: string;
};

function normalizePhone(value: string | undefined | null) {
  return (value || "").replace(/\D/g, "");
}

function normalizeRemoteJid(value: string | undefined | null) {
  const raw = (value || "").trim();

  if (!raw) {
    return "";
  }

  return raw.split("@")[0]?.replace(/\D/g, "") || "";
}

function formatCreatedAt(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function readPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  return payload as { summary?: unknown; metadata?: unknown };
}

function readMetadata(payload: unknown) {
  const parsed = readPayload(payload);

  if (!parsed?.metadata || typeof parsed.metadata !== "object" || Array.isArray(parsed.metadata)) {
    return null;
  }

  return parsed.metadata as Record<string, unknown>;
}

function readSummary(payload: unknown) {
  const parsed = readPayload(payload);
  return typeof parsed?.summary === "string" ? parsed.summary : "";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inferSuggestedOutcome(preview: string): ChargeFollowUpOutcome | undefined {
  const normalized = normalizeText(preview);

  if (!normalized) {
    return undefined;
  }

  if (/(ja paguei|foi pago|paguei|enviei o comprovante|segue o comprovante|comprovante)/.test(normalized)) {
    return "Pago em analise";
  }

  if (/(nao reconhec|nao recebi|cobranca errada|valor errado|duplicad|contest|cancel)/.test(normalized)) {
    return "Contestou";
  }

  if (/(amanha|sexta|segunda|terca|quarta|quinta|sabado|semana que vem|mes que vem|dia \d{1,2}|prazo)/.test(normalized)) {
    return "Reagendado";
  }

  if (/(vou pagar|consigo pagar|te pago|regularizo|pix hoje|pago hoje|pago ainda hoje|ate hoje|ate amanha)/.test(normalized)) {
    return "Prometeu pagar";
  }

  return undefined;
}

function buildSuggestedNote(signal: {
  summary: string;
  preview?: string;
  createdAt: Date;
  outcome?: ChargeFollowUpOutcome;
}) {
  if (!signal.outcome) {
    return undefined;
  }

  const details = [signal.summary];

  if (signal.preview) {
    details.push(`Mensagem: "${signal.preview}"`);
  }

  details.push(`Sinal recebido em ${formatCreatedAt(signal.createdAt)}.`);

  return details.join(" ");
}

function isInboundReply(event: EventSnapshot) {
  return event.action === "evolution.messages_upsert" && event.summary.toLowerCase().includes("nova mensagem recebida");
}

export async function listChargeWhatsappSignals(): Promise<ChargeWhatsappSignal[]> {
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
        name: true,
        phone: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditEvent.findMany({
      where: {
        workspaceId,
        entityType: "evolution",
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const eventsByPhone = new Map<string, EventSnapshot[]>();

  for (const event of events) {
    const metadata = readMetadata(event.payload);
    const remoteJid = normalizeRemoteJid(typeof metadata?.remoteJid === "string" ? metadata.remoteJid : null);

    if (!remoteJid) {
      continue;
    }

    const current = eventsByPhone.get(remoteJid) || [];
    current.push({
      createdAt: event.createdAt,
      action: event.action,
      summary: readSummary(event.payload) || "Evento WhatsApp registrado.",
      messagePreview: typeof metadata?.messagePreview === "string" ? metadata.messagePreview : undefined,
    });
    eventsByPhone.set(remoteJid, current);
  }

  return customers
    .map((customer) => {
      const phone = normalizePhone(customer.phone);
      const customerEvents = phone ? (eventsByPhone.get(phone) || []) : [];
      const lastEvent = customerEvents[0];
      const lastInboundReply = customerEvents.find((event) => isInboundReply(event));
      const suggestedOutcome = lastInboundReply?.messagePreview
        ? inferSuggestedOutcome(lastInboundReply.messagePreview)
        : undefined;

      return {
        customerName: customer.name,
        phone: customer.phone || undefined,
        eventCount: customerEvents.length,
        lastEventAt: lastEvent ? formatCreatedAt(lastEvent.createdAt) : undefined,
        lastEventSummary: lastEvent?.summary,
        lastMessagePreview: lastInboundReply?.messagePreview,
        inboundReplyDetected: Boolean(lastInboundReply),
        suggestedOutcome,
        suggestedNote: lastInboundReply
          ? buildSuggestedNote({
            summary: lastInboundReply.summary,
            preview: lastInboundReply.messagePreview,
            createdAt: lastInboundReply.createdAt,
            outcome: suggestedOutcome,
          })
          : undefined,
      } satisfies ChargeWhatsappSignal;
    })
    .filter((entry) => entry.phone);
}
