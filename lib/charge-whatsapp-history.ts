import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { isLocalDataMode } from "@/lib/data-mode";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { prisma } from "@/lib/prisma";
import type { Charge } from "@/lib/types";

export type ChargeWhatsappHistoryEntry = {
  id: string;
  chargeId: string;
  createdAt: string;
  summary: string;
  source: "charge" | "evolution";
  action: string;
};

function formatCreatedAt(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

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

function readPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  return payload as { summary?: unknown; metadata?: unknown };
}

function readSummary(payload: unknown, fallback: string) {
  const parsed = readPayload(payload);
  return typeof parsed?.summary === "string" && parsed.summary.trim() ? parsed.summary : fallback;
}

function readMetadata(payload: unknown) {
  const parsed = readPayload(payload);

  if (!parsed?.metadata || typeof parsed.metadata !== "object" || Array.isArray(parsed.metadata)) {
    return null;
  }

  return parsed.metadata as Record<string, unknown>;
}

function pickRelevantChargeForCustomer(charges: Charge[]) {
  return charges.find((charge) => charge.status !== "Pago") || charges[0] || null;
}

export async function listChargeWhatsappHistory(charges: Charge[]) {
  if (isLocalDataMode() || charges.length === 0) {
    return new Map<string, ChargeWhatsappHistoryEntry[]>();
  }

  await ensureDemoCommerceSeeded();
  const { workspaceId } = await getCurrentWorkspaceContext();
  const customers = await prisma.customer.findMany({
    where: {
      workspaceId,
      deletedAt: null,
    },
    select: {
      name: true,
      phone: true,
    },
  });

  const chargeIds = charges.map((charge) => charge.id);
  const customerPhoneByName = new Map(customers.map((customer) => [customer.name, normalizePhone(customer.phone)]));
  const chargesByCustomerName = new Map<string, Charge[]>();

  for (const charge of charges) {
    const current = chargesByCustomerName.get(charge.customer) || [];
    current.push(charge);
    chargesByCustomerName.set(charge.customer, current);
  }

  const [chargeEvents, evolutionEvents] = await Promise.all([
    prisma.auditEvent.findMany({
      where: {
        workspaceId,
        entityType: "charge",
        entityId: { in: chargeIds },
        action: {
          in: [
            "charge.whatsapp.sent",
            "charge.whatsapp.failed",
            "charge.whatsapp.received",
            "charge.whatsapp.signal_applied",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
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

  const historyByChargeId = new Map<string, ChargeWhatsappHistoryEntry[]>();

  for (const event of chargeEvents) {
    const current = historyByChargeId.get(event.entityId) || [];
    current.push({
      id: event.id,
      chargeId: event.entityId,
      createdAt: formatCreatedAt(event.createdAt),
      summary: readSummary(event.payload, "Evento WhatsApp vinculado a cobranca."),
      source: "charge",
      action: event.action,
    });
    historyByChargeId.set(event.entityId, current);
  }

  for (const event of evolutionEvents) {
    const metadata = readMetadata(event.payload);
    const linkedChargeId = typeof metadata?.linkedChargeId === "string" ? metadata.linkedChargeId : null;

    if (linkedChargeId && chargeIds.includes(linkedChargeId)) {
      const current = historyByChargeId.get(linkedChargeId) || [];
      current.push({
        id: event.id,
        chargeId: linkedChargeId,
        createdAt: formatCreatedAt(event.createdAt),
        summary: readSummary(event.payload, "Evento WhatsApp associado a cobranca."),
        source: "evolution",
        action: event.action,
      });
      historyByChargeId.set(linkedChargeId, current);
      continue;
    }

    const remoteJid = normalizeRemoteJid(typeof metadata?.remoteJid === "string" ? metadata.remoteJid : null);

    if (!remoteJid) {
      continue;
    }

    const customerName = [...customerPhoneByName.entries()].find(([, phone]) => phone === remoteJid)?.[0];

    if (!customerName) {
      continue;
    }

    const linkedCharge = pickRelevantChargeForCustomer(chargesByCustomerName.get(customerName) || []);

    if (!linkedCharge) {
      continue;
    }

    const current = historyByChargeId.get(linkedCharge.id) || [];
    current.push({
      id: event.id,
      chargeId: linkedCharge.id,
      createdAt: formatCreatedAt(event.createdAt),
      summary: readSummary(event.payload, "Evento WhatsApp associado pelo numero do cliente."),
      source: "evolution",
      action: event.action,
    });
    historyByChargeId.set(linkedCharge.id, current);
  }

  for (const [chargeId, entries] of historyByChargeId.entries()) {
    historyByChargeId.set(
      chargeId,
      entries.slice(0, 5),
    );
  }

  return historyByChargeId;
}
