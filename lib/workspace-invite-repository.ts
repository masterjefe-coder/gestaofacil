import { createHash, randomBytes } from "node:crypto";
import { WorkspaceRole } from "@prisma/client";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { recordAuditEvent } from "@/lib/audit-repository";
import { canManageWorkspace, getCurrentWorkspaceContext, requireSessionUser } from "@/lib/auth-session";
import { isLocalDataMode } from "@/lib/data-mode";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { hashPassword } from "@/lib/password-auth";
import { prisma } from "@/lib/prisma";
import { decryptWorkspaceSecret, encryptWorkspaceSecret } from "@/lib/secret-crypto";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "@/lib/transactional-email";
import { getWorkspaceUserAlertPreferences } from "@/lib/workspace-user-preferences";
import type { WorkspaceInviteDeliveryStatus, WorkspaceInviteStatus, WorkspaceInviteSummary, WorkspaceMember } from "@/lib/types";

const INVITE_TTL_DAYS = 7;

export class WorkspaceInviteError extends Error {}

type CreateWorkspaceInviteInput = {
  email: string;
  name?: string;
  role: WorkspaceRole;
};

type AcceptWorkspaceInviteInput =
  | {
      token: string;
      mode: "existing_user";
    }
  | {
      token: string;
      mode: "new_user";
      name: string;
      password: string;
    };

function mapRole(role: WorkspaceRole): WorkspaceMember["role"] {
  return role;
}

function formatInviteDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatInviteLogDate(value: Date | null | undefined) {
  return value ? formatInviteDate(value) : undefined;
}

export function hashWorkspaceInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getWorkspaceInviteStatus(input: {
  acceptedAt?: Date | null;
  revokedAt?: Date | null;
  expiresAt: Date;
  now?: Date;
}): WorkspaceInviteStatus {
  if (input.acceptedAt) {
    return "Aceito";
  }

  if (input.revokedAt) {
    return "Revogado";
  }

  const now = input.now || new Date();
  return input.expiresAt.getTime() < now.getTime() ? "Expirado" : "Pendente";
}

export function getWorkspaceInviteDeliveryStatus(input: {
  sendCount: number;
  lastDeliveryError?: string | null;
  lastSentAt?: Date | null;
}): WorkspaceInviteDeliveryStatus {
  if (input.lastDeliveryError && !input.lastSentAt) {
    return "Falhou";
  }

  if (input.lastSentAt || input.sendCount > 0) {
    return input.lastDeliveryError ? "Falhou" : "Enviado";
  }

  return "Pendente";
}

export function buildWorkspaceInviteUrl(token: string) {
  const path = `/convite?token=${encodeURIComponent(token)}`;
  const baseUrl = resolveAppBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}

function decodeInviteToken(ciphertext: string) {
  try {
    return decryptWorkspaceSecret(ciphertext) || "";
  } catch {
    return "";
  }
}

function buildWorkspaceInviteEmail(input: {
  inviteUrl: string;
  workspaceName: string;
  inviterEmail?: string | null;
  role: WorkspaceMember["role"];
  recipientName?: string;
  expiresAt: Date;
}) {
  const roleLabel = input.role === "OWNER" ? "Responsável" : input.role === "ADMIN" ? "Gestão" : "Operação";
  const subject = `Convite para entrar em ${input.workspaceName} no Gestão Fácil`;
  const expiry = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(input.expiresAt);
  const greeting = input.recipientName?.trim() ? `Olá, ${input.recipientName.trim()}!` : "Olá!";
  const inviter = input.inviterEmail?.trim() ? `Esse convite foi enviado por ${input.inviterEmail.trim()}.` : "Seu acesso foi preparado pela equipe do workspace.";
  const text = [
    greeting,
    `Você foi convidado para entrar em ${input.workspaceName} no Gestão Fácil com papel ${roleLabel}.`,
    inviter,
    `Aceitar convite: ${input.inviteUrl}`,
    `Esse link expira em ${expiry}.`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#14213d">
      <h2 style="margin-bottom:8px;">${greeting}</h2>
      <p>Você foi convidado para entrar em <strong>${input.workspaceName}</strong> no Gestão Fácil com papel <strong>${roleLabel}</strong>.</p>
      <p>${inviter}</p>
      <p>
        <a href="${input.inviteUrl}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#0d63ff;color:#fff;text-decoration:none;font-weight:700;">
          Aceitar convite
        </a>
      </p>
      <p>Se preferir, use este link direto:<br /><a href="${input.inviteUrl}">${input.inviteUrl}</a></p>
      <p>Esse link expira em ${expiry}.</p>
    </div>
  `.trim();

  return { subject, text, html };
}

async function markInviteDeliveryResult(input: {
  inviteId: string;
  workspaceId: string;
  actorId?: string | null;
  email: string;
  role: WorkspaceRole;
  sent: boolean;
  error?: string;
}) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.workspaceInvite.update({
      where: { id: input.inviteId },
      data: input.sent
        ? {
            sentAt: now,
            lastSentAt: now,
            sendCount: {
              increment: 1,
            },
            lastDeliveryError: null,
          }
        : {
            sendCount: {
              increment: 1,
            },
            lastDeliveryError: input.error || "Falha ao enviar convite.",
          },
    });

    await recordAuditEvent({
      action: input.sent ? "workspace.invite.email_sent" : "workspace.invite.email_failed",
      entityType: "workspace_invite",
      entityId: input.inviteId,
      workspaceId: input.workspaceId,
      actorId: input.actorId || null,
      payload: {
        summary: input.sent
          ? `Convite por email enviado para ${input.email}.`
          : `Falha ao enviar convite por email para ${input.email}.`,
        metadata: {
          email: input.email,
          role: input.role,
          error: input.error || null,
        },
      },
    }, tx);
  });
}

async function deliverWorkspaceInviteEmail(input: {
  inviteId: string;
  inviteUrl: string;
  email: string;
  workspaceName: string;
  inviterEmail?: string | null;
  role: WorkspaceRole;
  recipientName?: string;
  expiresAt: Date;
  workspaceId: string;
  actorId?: string | null;
}) {
  if (!isTransactionalEmailConfigured()) {
    return { sent: false as const, skipped: true as const, error: "Envio transacional não configurado." };
  }

  const emailPayload = buildWorkspaceInviteEmail({
    inviteUrl: input.inviteUrl,
    workspaceName: input.workspaceName,
    inviterEmail: input.inviterEmail,
    role: mapRole(input.role),
    recipientName: input.recipientName,
    expiresAt: input.expiresAt,
  });

  try {
    await sendTransactionalEmail({
      to: input.email,
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text,
    });

    await markInviteDeliveryResult({
      inviteId: input.inviteId,
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      email: input.email,
      role: input.role,
      sent: true,
    });

    return { sent: true as const, skipped: false as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar convite.";
    await markInviteDeliveryResult({
      inviteId: input.inviteId,
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      email: input.email,
      role: input.role,
      sent: false,
      error: message,
    });

    return { sent: false as const, skipped: false as const, error: message };
  }
}

async function notifyInviteAccepted(input: {
  workspaceId: string;
  acceptedEmail: string;
  role: WorkspaceRole;
  acceptedName?: string | null;
}) {
  if (!isTransactionalEmailConfigured()) {
    return;
  }

  const managers = await prisma.workspaceMembership.findMany({
    where: {
      workspaceId: input.workspaceId,
      role: {
        in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
      },
    },
    include: {
      user: true,
      workspace: {
        include: {
          company: true,
        },
      },
    },
    take: 10,
  });

  const workspaceName = managers[0]?.workspace.company?.tradeName || managers[0]?.workspace.name || "seu workspace";
  const roleLabel = mapRole(input.role) === "OWNER" ? "Responsável" : mapRole(input.role) === "ADMIN" ? "Gestão" : "Operação";
  const managerPreferences = await Promise.all(managers.map(async (item) => ({
    email: item.user.email,
    preferences: await getWorkspaceUserAlertPreferences({
      workspaceId: input.workspaceId,
      userId: item.userId,
    }),
  })));
  const recipients = managerPreferences
    .filter((item) => item.preferences.emailOnInviteAccepted)
    .map((item) => item.email)
    .filter((email, index, list) => Boolean(email) && list.indexOf(email) === index);

  if (recipients.length === 0) {
    return;
  }

  await Promise.all(recipients.map(async (recipient) => {
    await sendTransactionalEmail({
      to: recipient,
      subject: `${input.acceptedEmail} entrou em ${workspaceName}`,
      text: [
        `${input.acceptedName || input.acceptedEmail} aceitou o convite do workspace.`,
        `Email: ${input.acceptedEmail}`,
        `Papel: ${roleLabel}`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#14213d">
          <h2 style="margin-bottom:8px;">Novo acesso confirmado</h2>
          <p><strong>${input.acceptedName || input.acceptedEmail}</strong> aceitou o convite do workspace <strong>${workspaceName}</strong>.</p>
          <p>Email: ${input.acceptedEmail}<br />Papel: ${roleLabel}</p>
        </div>
      `.trim(),
    });
  }));
}

async function requireWorkspaceManager() {
  const context = await getCurrentWorkspaceContext();

  if (!canManageWorkspace(context.workspaceRole)) {
    throw new WorkspaceInviteError("Apenas owner ou admin podem convidar usuarios para o workspace.");
  }

  return context;
}

export async function listWorkspaceInvites(): Promise<WorkspaceInviteSummary[]> {
  if (isLocalDataMode()) {
    return [];
  }

  await ensureDemoCommerceSeeded();
  const { workspaceId } = await getCurrentWorkspaceContext();
  const invites = await prisma.workspaceInvite.findMany({
    where: { workspaceId },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  return invites.map((invite) => {
    const token = decodeInviteToken(invite.tokenCiphertext);

    return {
      id: invite.id,
      email: invite.email,
      name: invite.name || undefined,
      role: mapRole(invite.role),
      status: getWorkspaceInviteStatus(invite),
      deliveryStatus: getWorkspaceInviteDeliveryStatus(invite),
      expiresAt: formatInviteDate(invite.expiresAt),
      inviteUrl: token ? buildWorkspaceInviteUrl(token) : undefined,
      lastSentAt: formatInviteLogDate(invite.lastSentAt),
      lastDeliveryError: invite.lastDeliveryError || undefined,
    };
  });
}

export async function createWorkspaceInvite(input: CreateWorkspaceInviteInput) {
  if (isLocalDataMode()) {
    throw new WorkspaceInviteError("Defina DATABASE_URL para criar convites reais de workspace.");
  }

  const context = await requireWorkspaceManager();
  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim() || undefined;

  if (!email) {
    throw new WorkspaceInviteError("Informe o email de quem deve receber o convite.");
  }

  const existingMembership = await prisma.workspaceMembership.findFirst({
    where: {
      workspaceId: context.workspaceId,
      user: {
        email,
      },
    },
    select: { id: true },
  });

  if (existingMembership) {
    throw new WorkspaceInviteError("Esse email ja faz parte do workspace atual.");
  }

  const token = randomBytes(24).toString("hex");
  const tokenHash = hashWorkspaceInviteToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invite = await prisma.$transaction(async (tx) => {
    await tx.workspaceInvite.updateMany({
      where: {
        workspaceId: context.workspaceId,
        email,
        acceptedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const createdInvite = await tx.workspaceInvite.create({
      data: {
        workspaceId: context.workspaceId,
        email,
        name,
        role: input.role,
        tokenHash,
        tokenCiphertext: encryptWorkspaceSecret(token),
        invitedByEmail: context.email,
        expiresAt,
      },
    });

    await recordAuditEvent(
      {
        action: "workspace.invite.created",
        entityType: "workspace_invite",
        entityId: createdInvite.id,
        context,
        payload: {
          summary: `${email} foi convidado para o workspace com papel ${input.role}.`,
          metadata: {
            email,
            role: input.role,
            expiresAt: expiresAt.toISOString(),
          },
        },
      },
      tx,
    );

    return createdInvite;
  });

  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
    inviteUrl: buildWorkspaceInviteUrl(token),
  };
}

export async function createAndDeliverWorkspaceInvite(input: CreateWorkspaceInviteInput) {
  const invite = await createWorkspaceInvite(input);
  const context = await getCurrentWorkspaceContext();
  const workspace = await prisma.workspace.findUnique({
    where: { id: context.workspaceId },
    select: {
      name: true,
      company: {
        select: {
          tradeName: true,
        },
      },
    },
  });

  const delivery = await deliverWorkspaceInviteEmail({
    inviteId: invite.id,
    inviteUrl: invite.inviteUrl,
    email: invite.email,
    workspaceName: workspace?.company?.tradeName || workspace?.name || "seu workspace",
    inviterEmail: context.email,
    role: invite.role,
    recipientName: input.name,
    expiresAt: invite.expiresAt,
    workspaceId: context.workspaceId,
    actorId: context.userId,
  });

  return {
    ...invite,
    delivery,
  };
}

export async function revokeWorkspaceInvite(inviteId: string) {
  if (isLocalDataMode()) {
    throw new WorkspaceInviteError("Defina DATABASE_URL para revogar convites reais.");
  }

  const context = await requireWorkspaceManager();
  const invite = await prisma.workspaceInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite || invite.workspaceId !== context.workspaceId) {
    throw new WorkspaceInviteError("Convite do workspace nao encontrado.");
  }

  if (invite.acceptedAt) {
    throw new WorkspaceInviteError("Esse convite ja foi aceito e nao pode mais ser revogado.");
  }

  if (invite.revokedAt) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: {
        revokedAt: new Date(),
      },
    });

    await recordAuditEvent(
      {
        action: "workspace.invite.revoked",
        entityType: "workspace_invite",
        entityId: invite.id,
        context,
        payload: {
          summary: `O convite de ${invite.email} foi revogado.`,
          metadata: {
            email: invite.email,
            role: invite.role,
          },
        },
      },
      tx,
    );
  });
}

export async function resendWorkspaceInvite(inviteId: string) {
  if (isLocalDataMode()) {
    throw new WorkspaceInviteError("Defina DATABASE_URL para reenviar convites reais.");
  }

  const context = await requireWorkspaceManager();
  const invite = await prisma.workspaceInvite.findUnique({
    where: { id: inviteId },
    include: {
      workspace: {
        include: {
          company: true,
        },
      },
    },
  });

  if (!invite || invite.workspaceId !== context.workspaceId) {
    throw new WorkspaceInviteError("Convite do workspace nao encontrado.");
  }

  if (invite.acceptedAt) {
    throw new WorkspaceInviteError("Esse convite ja foi aceito.");
  }

  if (invite.revokedAt || invite.expiresAt.getTime() < Date.now()) {
    throw new WorkspaceInviteError("Esse convite precisa ser renovado antes do reenvio.");
  }

  const token = decodeInviteToken(invite.tokenCiphertext);

  if (!token) {
    throw new WorkspaceInviteError("Nao foi possivel reconstruir o link deste convite.");
  }

  return deliverWorkspaceInviteEmail({
    inviteId: invite.id,
    inviteUrl: buildWorkspaceInviteUrl(token),
    email: invite.email,
    workspaceName: invite.workspace.company?.tradeName || invite.workspace.name,
    inviterEmail: context.email,
    role: invite.role,
    recipientName: invite.name || undefined,
    expiresAt: invite.expiresAt,
    workspaceId: context.workspaceId,
    actorId: context.userId,
  });
}

export async function renewWorkspaceInvite(inviteId: string) {
  if (isLocalDataMode()) {
    throw new WorkspaceInviteError("Defina DATABASE_URL para renovar convites reais.");
  }

  const context = await requireWorkspaceManager();
  const invite = await prisma.workspaceInvite.findUnique({
    where: { id: inviteId },
    include: {
      workspace: {
        include: {
          company: true,
        },
      },
    },
  });

  if (!invite || invite.workspaceId !== context.workspaceId) {
    throw new WorkspaceInviteError("Convite do workspace nao encontrado.");
  }

  if (invite.acceptedAt) {
    throw new WorkspaceInviteError("Esse convite ja foi aceito e nao pode ser renovado.");
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const renewed = await prisma.$transaction(async (tx) => {
    const updated = await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: {
        tokenHash: hashWorkspaceInviteToken(token),
        tokenCiphertext: encryptWorkspaceSecret(token),
        expiresAt,
        revokedAt: null,
        lastDeliveryError: null,
      },
    });

    await recordAuditEvent({
      action: "workspace.invite.renewed",
      entityType: "workspace_invite",
      entityId: invite.id,
      context,
      payload: {
        summary: `Convite de ${invite.email} foi renovado com novo prazo.`,
        metadata: {
          email: invite.email,
          role: invite.role,
          expiresAt: expiresAt.toISOString(),
        },
      },
    }, tx);

    return updated;
  });

  const delivery = await deliverWorkspaceInviteEmail({
    inviteId: renewed.id,
    inviteUrl: buildWorkspaceInviteUrl(token),
    email: renewed.email,
    workspaceName: invite.workspace.company?.tradeName || invite.workspace.name,
    inviterEmail: context.email,
    role: renewed.role,
    recipientName: renewed.name || undefined,
    expiresAt: renewed.expiresAt,
    workspaceId: context.workspaceId,
    actorId: context.userId,
  });

  return {
    inviteUrl: buildWorkspaceInviteUrl(token),
    delivery,
  };
}

export async function getWorkspaceInviteByToken(token: string) {
  if (isLocalDataMode()) {
    return null;
  }

  if (!token.trim()) {
    return null;
  }

  const tokenHash = hashWorkspaceInviteToken(token.trim());
  const invite = await prisma.workspaceInvite.findUnique({
    where: { tokenHash },
    include: {
      workspace: {
        include: {
          company: true,
        },
      },
    },
  });

  if (!invite) {
    return null;
  }

  return {
    id: invite.id,
    token,
    email: invite.email,
    name: invite.name || undefined,
    role: mapRole(invite.role),
    status: getWorkspaceInviteStatus(invite),
    expiresAt: invite.expiresAt,
    workspaceId: invite.workspaceId,
    workspaceName: invite.workspace.name,
    workspaceTradeName: invite.workspace.company?.tradeName || invite.workspace.name,
  };
}

export async function acceptWorkspaceInvite(input: AcceptWorkspaceInviteInput) {
  if (isLocalDataMode()) {
    throw new WorkspaceInviteError("Defina DATABASE_URL para aceitar convites reais.");
  }

  const token = input.token.trim();
  const tokenHash = hashWorkspaceInviteToken(token);
  const invite = await prisma.workspaceInvite.findUnique({
    where: { tokenHash },
  });

  if (!invite) {
    throw new WorkspaceInviteError("Convite nao encontrado ou ja invalidado.");
  }

  const status = getWorkspaceInviteStatus(invite);

  if (status === "Aceito") {
    throw new WorkspaceInviteError("Esse convite ja foi aceito.");
  }

  if (status === "Revogado") {
    throw new WorkspaceInviteError("Esse convite foi revogado pelo workspace.");
  }

  if (status === "Expirado") {
    throw new WorkspaceInviteError("Esse convite expirou. Gere um novo convite no setup da empresa.");
  }

  const sessionData = input.mode === "existing_user"
    ? await requireSessionUser()
    : null;
  const acceptedEmail = sessionData?.email || invite.email;

  if (sessionData && acceptedEmail !== invite.email) {
    throw new WorkspaceInviteError("O convite pertence a outro email. Entre com a conta convidada para aceitar.");
  }

  const membershipEmail = input.mode === "new_user" ? invite.email : acceptedEmail;
  const existingUser = await prisma.user.findUnique({
    where: { email: membershipEmail },
    include: {
      memberships: {
        where: {
          workspaceId: invite.workspaceId,
        },
      },
    },
  });

  if (input.mode === "new_user" && existingUser) {
    throw new WorkspaceInviteError("Esse email ja possui conta. Entre no sistema para aceitar o convite.");
  }

  if (input.mode === "new_user" && input.password.trim().length < 8) {
    throw new WorkspaceInviteError("A senha precisa ter pelo menos 8 caracteres.");
  }

  const accepted = await prisma.$transaction(async (tx) => {
    let userId = existingUser?.id;

    if (!userId && input.mode === "new_user") {
      const user = await tx.user.create({
        data: {
          email: invite.email,
          name: input.name.trim(),
          passwordHash: hashPassword(input.password.trim()),
        },
      });
      userId = user.id;
    }

    if (!userId) {
      throw new WorkspaceInviteError("Nao foi possivel identificar o usuario para aceitar o convite.");
    }

    const membership =
      existingUser?.memberships[0] ||
      await tx.workspaceMembership.create({
        data: {
          userId,
          workspaceId: invite.workspaceId,
          role: invite.role,
        },
      });

    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: {
        acceptedAt: new Date(),
      },
    });

    await recordAuditEvent(
      {
        action: "workspace.invite.accepted",
        entityType: "workspace_invite",
        entityId: invite.id,
        workspaceId: invite.workspaceId,
        actorId: userId,
        payload: {
          summary: `${invite.email} aceitou o convite do workspace.`,
          metadata: {
            email: invite.email,
            role: invite.role,
            userId,
          },
        },
      },
      tx,
    );

    return {
      workspaceId: invite.workspaceId,
      userId,
      membershipId: membership.id,
      email: invite.email,
    };
  });

  await notifyInviteAccepted({
    workspaceId: invite.workspaceId,
    acceptedEmail: invite.email,
    role: invite.role,
    acceptedName: input.mode === "new_user" ? input.name.trim() : existingUser?.name || null,
  }).catch(() => null);

  return accepted;
}
