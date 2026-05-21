import { Prisma } from "@prisma/client";
import { getCurrentWorkspaceContext, type WorkspaceContext } from "@/lib/auth-session";
import { isLocalDataMode } from "@/lib/data-mode";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { prisma } from "@/lib/prisma";
import type { AuditEntry } from "@/lib/types";

type AuditPayload = {
  summary: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

type RecordAuditEventInput = {
  action: string;
  entityType: string;
  entityId: string;
  payload: AuditPayload;
  context?: WorkspaceContext;
  workspaceId?: string;
  actorId?: string | null;
};

type AuditClient = Prisma.TransactionClient | typeof prisma;

function formatCreatedAt(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function toJsonValue(payload: AuditPayload): Prisma.InputJsonValue {
  return {
    summary: payload.summary,
    metadata: payload.metadata || {},
  };
}

function getSummary(payload: Prisma.JsonValue | null, fallback: string) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const candidate = payload.summary;

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return fallback;
}

export async function recordAuditEvent(
  input: RecordAuditEventInput,
  client: AuditClient = prisma,
) {
  if (isLocalDataMode()) {
    return null;
  }

  const context = input.context || (!input.workspaceId ? await getCurrentWorkspaceContext() : null);
  const workspaceId = input.workspaceId || context?.workspaceId;
  const actorId = Object.prototype.hasOwnProperty.call(input, "actorId")
    ? input.actorId
    : (context?.userId || null);

  if (!workspaceId) {
    throw new Error("Workspace ausente para registrar auditoria.");
  }

  return client.auditEvent.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      workspaceId,
      actorId,
      payload: toJsonValue(input.payload),
    },
  });
}

export async function listAuditEntries(limit = 10): Promise<AuditEntry[]> {
  if (isLocalDataMode()) {
    return [
      {
        id: "demo-audit-setup",
        action: "workspace.audit.demo",
        entityType: "workspace",
        entityId: "demo-workspace",
        actorName: "demo",
        actorEmail: process.env.AUTH_DEMO_EMAIL || "demo@gestaofacil.local",
        createdAt: "Modo local",
        summary: "Ative o banco para registrar auditoria real de equipe e configuracoes.",
      },
    ];
  }

  await ensureDemoCommerceSeeded();
  const context = await getCurrentWorkspaceContext();
  const events = await prisma.auditEvent.findMany({
    where: {
      workspaceId: context.workspaceId,
    },
    include: {
      actor: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return events.map((event) => ({
    id: event.id,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    actorName: event.actor?.name || event.actor?.email?.split("@")[0] || "Sistema",
    actorEmail: event.actor?.email || "sistema@workspace.local",
    createdAt: formatCreatedAt(event.createdAt),
    summary: getSummary(event.payload, "Evento registrado no workspace."),
  }));
}

export async function listWorkspaceAuditEntriesByType(entityType: string, limit = 10): Promise<AuditEntry[]> {
  if (isLocalDataMode()) {
    return [
      {
        id: `demo-audit-${entityType}`,
        action: `${entityType}.demo`,
        entityType,
        entityId: "demo",
        actorName: "Sistema",
        actorEmail: "sistema@workspace.local",
        createdAt: "Modo local",
        summary: `Ative o banco para acompanhar eventos reais de ${entityType}.`,
      },
    ];
  }

  await ensureDemoCommerceSeeded();
  const context = await getCurrentWorkspaceContext();
  const events = await prisma.auditEvent.findMany({
    where: {
      workspaceId: context.workspaceId,
      entityType,
    },
    include: {
      actor: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return events.map((event) => ({
    id: event.id,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    actorName: event.actor?.name || event.actor?.email?.split("@")[0] || "Sistema",
    actorEmail: event.actor?.email || "sistema@workspace.local",
    createdAt: formatCreatedAt(event.createdAt),
    summary: getSummary(event.payload, "Evento registrado no workspace."),
  }));
}

export async function listWorkspaceAuditEntriesByActions(actions: string[], limit = 10): Promise<AuditEntry[]> {
  if (actions.length === 0) {
    return [];
  }

  if (isLocalDataMode()) {
    return [
      {
        id: "demo-audit-actions",
        action: actions[0] || "workspace.demo",
        entityType: "workspace",
        entityId: "demo",
        actorName: "Sistema",
        actorEmail: "sistema@workspace.local",
        createdAt: "Modo local",
        summary: "Ative o banco para acompanhar eventos reais e incidentes operacionais.",
      },
    ];
  }

  await ensureDemoCommerceSeeded();
  const context = await getCurrentWorkspaceContext();
  const events = await prisma.auditEvent.findMany({
    where: {
      workspaceId: context.workspaceId,
      action: {
        in: actions,
      },
    },
    include: {
      actor: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return events.map((event) => ({
    id: event.id,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    actorName: event.actor?.name || event.actor?.email?.split("@")[0] || "Sistema",
    actorEmail: event.actor?.email || "sistema@workspace.local",
    createdAt: formatCreatedAt(event.createdAt),
    summary: getSummary(event.payload, "Evento registrado no workspace."),
  }));
}
