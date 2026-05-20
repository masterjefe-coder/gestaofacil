import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { isLocalDataMode } from "@/lib/data-mode";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { prisma } from "@/lib/prisma";
import type { CustomerWhatsappActivity } from "@/lib/types";

function normalizePhone(value: string | undefined | null) {
  const digits = (value || "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.endsWith("s")) {
    return digits;
  }

  return digits;
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

function readPayloadMetadata(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const metadata = (payload as { metadata?: unknown }).metadata;

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return metadata as Record<string, unknown>;
}

function readPayloadSummary(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }

  const summary = (payload as { summary?: unknown }).summary;
  return typeof summary === "string" ? summary : "";
}

export async function listCustomerWhatsappActivity(): Promise<CustomerWhatsappActivity[]> {
  if (isLocalDataMode()) {
    return [];
  }

  await ensureDemoCommerceSeeded();
  const { workspaceId } = await getCurrentWorkspaceContext();
  const [customers, events] = await Promise.all([
    prisma.customer.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditEvent.findMany({
      where: {
        workspaceId,
        entityType: "evolution",
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const eventsByPhone = new Map<string, Array<{ createdAt: Date; summary: string }>>();

  for (const event of events) {
    const metadata = readPayloadMetadata(event.payload);
    const remoteJid = normalizeRemoteJid(typeof metadata?.remoteJid === "string" ? metadata.remoteJid : null);

    if (!remoteJid) {
      continue;
    }

    const summary = readPayloadSummary(event.payload) || "Evento WhatsApp registrado.";
    const current = eventsByPhone.get(remoteJid) || [];
    current.push({
      createdAt: event.createdAt,
      summary,
    });
    eventsByPhone.set(remoteJid, current);
  }

  return customers
    .map((customer) => {
      const phone = normalizePhone(customer.phone);
      const customerEvents = phone ? (eventsByPhone.get(phone) || []) : [];
      const lastEvent = customerEvents[0];

      return {
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone || undefined,
        lastEventAt: lastEvent ? formatCreatedAt(lastEvent.createdAt) : undefined,
        lastEventSummary: lastEvent?.summary,
        eventCount: customerEvents.length,
      } satisfies CustomerWhatsappActivity;
    })
    .filter((entry) => entry.phone);
}
