import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { isLocalDataMode } from "@/lib/data-mode";
import type { WorkspaceAccessEvent, WorkspaceAccessSummary } from "@/lib/types";

const ACCESS_ACTIONS = [
  "auth.login.succeeded",
  "auth.login.failed",
  "auth.login.locked",
  "auth.logout.requested",
  "auth.password_reset.requested",
  "auth.password_reset.completed",
  "workspace.invite.accepted",
] as const;

type SupportedAccessAction = (typeof ACCESS_ACTIONS)[number];

function formatAccessDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function extractMetadata(payload: unknown): Record<string, string | number | boolean | null | undefined> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  const metadata = (payload as { metadata?: unknown }).metadata;

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, string | number | boolean | null | undefined>;
}

export function summarizeUserAgent(userAgent?: string | null) {
  if (!userAgent?.trim()) {
    return "Dispositivo não informado";
  }

  const value = userAgent.trim();
  const os = value.includes("Windows") ? "Windows"
    : value.includes("Mac OS X") ? "macOS"
    : value.includes("Android") ? "Android"
    : value.includes("iPhone") ? "iPhone"
    : value.includes("Linux") ? "Linux"
    : "Outro sistema";
  const browser = value.includes("Edg/") ? "Edge"
    : value.includes("Chrome/") ? "Chrome"
    : value.includes("Firefox/") ? "Firefox"
    : value.includes("Safari/") && !value.includes("Chrome/") ? "Safari"
    : "Navegador";

  return `${browser} • ${os}`;
}

function buildAccessTitle(action: SupportedAccessAction) {
  switch (action) {
    case "auth.login.succeeded":
      return "Login concluído";
    case "auth.login.failed":
      return "Falha de login";
    case "auth.login.locked":
      return "Proteção de acesso ativada";
    case "auth.logout.requested":
      return "Sessão encerrada";
    case "auth.password_reset.requested":
      return "Recuperação solicitada";
    case "auth.password_reset.completed":
      return "Senha redefinida";
    case "workspace.invite.accepted":
      return "Convite aceito";
  }
}

function buildAccessTone(action: SupportedAccessAction): WorkspaceAccessEvent["tone"] {
  switch (action) {
    case "auth.login.failed":
    case "auth.login.locked":
      return "warning";
    case "auth.login.succeeded":
    case "auth.password_reset.completed":
    case "workspace.invite.accepted":
      return "positive";
    default:
      return "neutral";
  }
}

export async function listWorkspaceAccessEvents(limit = 8): Promise<WorkspaceAccessEvent[]> {
  if (isLocalDataMode()) {
    return [
      {
        id: "demo-access-1",
        title: "Modo local ativo",
        summary: "Ative o banco oficial para acompanhar acessos, redefinições e convites aceitos em tempo real.",
        actorName: "Sistema",
        actorEmail: "sistema@workspace.local",
        createdAt: "Modo local",
        tone: "neutral",
      },
    ];
  }

  const context = await getCurrentWorkspaceContext();
  const events = await prisma.auditEvent.findMany({
    where: {
      workspaceId: context.workspaceId,
      action: {
        in: [...ACCESS_ACTIONS],
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

  return events.map((event) => {
    const metadata = extractMetadata(event.payload);
    const action = event.action as SupportedAccessAction;
    const userAgent = typeof metadata.userAgent === "string" ? metadata.userAgent : null;

    return {
      id: event.id,
      title: buildAccessTitle(action),
      summary: typeof (event.payload as { summary?: unknown } | null)?.summary === "string"
        ? (event.payload as { summary: string }).summary
        : "Evento recente de acesso registrado no workspace.",
      actorName: event.actor?.name || event.actor?.email?.split("@")[0] || "Sistema",
      actorEmail: event.actor?.email || (typeof metadata.email === "string" ? metadata.email : "sistema@workspace.local"),
      createdAt: formatAccessDate(event.createdAt),
      tone: buildAccessTone(action),
      deviceLabel: userAgent ? summarizeUserAgent(userAgent) : undefined,
    };
  });
}

export async function getWorkspaceAccessSummary(days = 7): Promise<WorkspaceAccessSummary> {
  if (isLocalDataMode()) {
    return {
      successCount: 0,
      failedCount: 0,
      lockedCount: 0,
      resetCount: 0,
    };
  }

  const context = await getCurrentWorkspaceContext();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [successCount, failedCount, lockedCount, resetCount] = await Promise.all([
    prisma.auditEvent.count({
      where: {
        workspaceId: context.workspaceId,
        action: "auth.login.succeeded",
        createdAt: { gte: since },
      },
    }),
    prisma.auditEvent.count({
      where: {
        workspaceId: context.workspaceId,
        action: "auth.login.failed",
        createdAt: { gte: since },
      },
    }),
    prisma.auditEvent.count({
      where: {
        workspaceId: context.workspaceId,
        action: "auth.login.locked",
        createdAt: { gte: since },
      },
    }),
    prisma.auditEvent.count({
      where: {
        workspaceId: context.workspaceId,
        action: {
          in: ["auth.password_reset.requested", "auth.password_reset.completed"],
        },
        createdAt: { gte: since },
      },
    }),
  ]);

  return {
    successCount,
    failedCount,
    lockedCount,
    resetCount,
  };
}
