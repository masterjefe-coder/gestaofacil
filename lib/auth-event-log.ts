import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit-repository";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "@/lib/transactional-email";
import { getWorkspaceUserAlertPreferences } from "@/lib/workspace-user-preferences";

async function resolvePrimaryWorkspaceContextForEmail(email: string) {
  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      user: {
        email,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      workspaceId: true,
      userId: true,
    },
  });

  return membership || null;
}

async function notifySecurityEvent(input: {
  userId: string;
  workspaceId: string;
  email: string;
  subject: string;
  lines: string[];
}) {
  if (!isTransactionalEmailConfigured()) {
    return;
  }

  const preferences = await getWorkspaceUserAlertPreferences({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });

  if (!preferences.emailOnSecurityAlerts) {
    return;
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: {
      name: true,
      company: {
        select: {
          tradeName: true,
        },
      },
    },
  });

  const workspaceName = workspace?.company?.tradeName || workspace?.name || "seu workspace";
  const text = [`Workspace: ${workspaceName}`, ...input.lines].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#14213d">
      <h2 style="margin-bottom:8px;">${input.subject}</h2>
      <p><strong>Workspace:</strong> ${workspaceName}</p>
      ${input.lines.map((line) => `<p>${line}</p>`).join("")}
    </div>
  `.trim();

  await sendTransactionalEmail({
    to: input.email,
    subject: `${input.subject} no Gestão Fácil`,
    text,
    html,
  });
}

export async function recordAuthLoginSuccess(input: {
  email: string;
  userId: string;
  workspaceId: string;
  userAgent?: string | null;
}) {
  await recordAuditEvent({
    action: "auth.login.succeeded",
    entityType: "user",
    entityId: input.userId,
    workspaceId: input.workspaceId,
    actorId: input.userId,
    payload: {
      summary: `${input.email} entrou no workspace com sucesso.`,
      metadata: {
        email: input.email,
        userAgent: input.userAgent || null,
      },
    },
  });
}

export async function recordAuthLoginFailed(input: {
  email: string;
  userAgent?: string | null;
}) {
  const context = await resolvePrimaryWorkspaceContextForEmail(input.email);

  if (!context) {
    return;
  }

  await recordAuditEvent({
    action: "auth.login.failed",
    entityType: "user",
    entityId: context.userId,
    workspaceId: context.workspaceId,
    actorId: context.userId,
    payload: {
      summary: `Falha de login registrada para ${input.email}.`,
      metadata: {
        email: input.email,
        userAgent: input.userAgent || null,
      },
    },
  });
}

export async function recordAuthLoginLocked(input: {
  email: string;
  retryAfterSeconds: number;
  userAgent?: string | null;
}) {
  const context = await resolvePrimaryWorkspaceContextForEmail(input.email);

  if (!context) {
    return;
  }

  await recordAuditEvent({
    action: "auth.login.locked",
    entityType: "user",
    entityId: context.userId,
    workspaceId: context.workspaceId,
    actorId: context.userId,
    payload: {
      summary: `Login temporariamente bloqueado para ${input.email}.`,
      metadata: {
        email: input.email,
        retryAfterSeconds: input.retryAfterSeconds,
        userAgent: input.userAgent || null,
      },
    },
  });

  await notifySecurityEvent({
    userId: context.userId,
    workspaceId: context.workspaceId,
    email: input.email,
    subject: "Proteção de login ativada",
    lines: [
      "O sistema bloqueou temporariamente novas tentativas de entrada para proteger sua conta.",
      `Tente novamente em aproximadamente ${Math.ceil(input.retryAfterSeconds / 60)} minuto(s).`,
    ],
  }).catch(() => null);
}

export async function recordPasswordResetRequested(email: string) {
  const context = await resolvePrimaryWorkspaceContextForEmail(email);

  if (!context) {
    return;
  }

  await recordAuditEvent({
    action: "auth.password_reset.requested",
    entityType: "user",
    entityId: context.userId,
    workspaceId: context.workspaceId,
    actorId: context.userId,
    payload: {
      summary: `${email} pediu redefinição de senha.`,
      metadata: {
        email,
      },
    },
  });
}

export async function recordPasswordResetCompleted(email: string, userId: string) {
  const context = await resolvePrimaryWorkspaceContextForEmail(email);

  if (!context) {
    return;
  }

  await recordAuditEvent({
    action: "auth.password_reset.completed",
    entityType: "user",
    entityId: userId,
    workspaceId: context.workspaceId,
    actorId: userId,
    payload: {
      summary: `${email} concluiu a redefinição de senha.`,
      metadata: {
        email,
      },
    },
  });

  await notifySecurityEvent({
    userId,
    workspaceId: context.workspaceId,
    email,
    subject: "Senha redefinida com sucesso",
    lines: [
      "A senha da sua conta foi alterada.",
      "Se essa alteração não foi feita por você, troque a senha novamente e avise a gestão da empresa.",
    ],
  }).catch(() => null);
}
