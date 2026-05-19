import { WorkspaceRole } from "@prisma/client";
import { recordAuditEvent } from "@/lib/audit-repository";
import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/auth-session";
import { isLocalDataMode } from "@/lib/data-mode";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { hashPassword } from "@/lib/password-auth";
import { prisma } from "@/lib/prisma";
import type { WorkspaceMember } from "@/lib/types";

function getDemoEmail() {
  return process.env.AUTH_DEMO_EMAIL || "demo@gestaofacil.local";
}

export class WorkspaceMemberError extends Error {}

type CreateWorkspaceMemberInput = {
  name: string;
  email: string;
  password: string;
  role: WorkspaceRole;
};

type UpdateWorkspaceMemberRoleInput = {
  membershipId: string;
  role: WorkspaceRole;
};

type ResetWorkspaceMemberPasswordInput = {
  membershipId: string;
  password: string;
};

function formatJoinedAt(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function mapRole(role: WorkspaceRole): WorkspaceMember["role"] {
  return role;
}

async function requireWorkspaceManager() {
  const context = await getCurrentWorkspaceContext();

  if (!canManageWorkspace(context.workspaceRole)) {
    throw new WorkspaceMemberError("Apenas owner ou admin podem gerenciar usuarios do workspace.");
  }

  return context;
}

async function getWorkspaceMembershipSummary(workspaceId: string) {
  const memberships = await prisma.workspaceMembership.findMany({
    where: { workspaceId },
    select: {
      id: true,
      role: true,
      userId: true,
    },
  });

  return {
    memberships,
    ownerCount: memberships.filter((membership) => membership.role === WorkspaceRole.OWNER).length,
  };
}

export async function listWorkspaceMembers(): Promise<WorkspaceMember[]> {
  if (isLocalDataMode()) {
    return [
      {
        id: "demo-user",
        name: "demo",
        email: getDemoEmail(),
        role: "OWNER",
        joinedAt: "Modo local",
      },
    ];
  }

  await ensureDemoCommerceSeeded();
  const { workspaceId, userId } = await getCurrentWorkspaceContext();

  const memberships = await prisma.workspaceMembership.findMany({
    where: { workspaceId },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return memberships.map((membership) => ({
    id: membership.id,
    name: membership.user.name || membership.user.email.split("@")[0] || "Operador",
    email: membership.user.email,
    role: mapRole(membership.role),
    joinedAt: formatJoinedAt(membership.createdAt),
    isCurrentUser: membership.userId === userId,
  }));
}

export async function createWorkspaceMember(input: CreateWorkspaceMemberInput) {
  if (isLocalDataMode()) {
    throw new WorkspaceMemberError("Defina DATABASE_URL para adicionar usuarios reais ao workspace.");
  }

  const context = await requireWorkspaceManager();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const password = input.password.trim();

  if (!email || !name || !password) {
    throw new WorkspaceMemberError("Preencha nome, email e senha inicial do novo usuario.");
  }

  if (password.length < 8) {
    throw new WorkspaceMemberError("A senha inicial precisa ter pelo menos 8 caracteres.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: {
          workspaceId: context.workspaceId,
        },
      },
    },
  });

  if (existingUser?.memberships.length) {
    throw new WorkspaceMemberError("Esse usuario ja faz parte do workspace atual.");
  }

  await prisma.$transaction(async (tx) => {
    const user =
      existingUser ||
      (await tx.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
        },
      }));

    if (existingUser && !existingUser.passwordHash) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash: hashPassword(password),
          name: existingUser.name || name,
        },
      });
    }

    const membership = await tx.workspaceMembership.create({
      data: {
        userId: user.id,
        workspaceId: context.workspaceId,
        role: input.role,
      },
    });

    await recordAuditEvent(
      {
        action: "workspace.member.created",
        entityType: "workspace_membership",
        entityId: membership.id,
        context,
        payload: {
          summary: `${email} entrou no workspace com papel ${input.role}.`,
          metadata: {
            email,
            role: input.role,
            userId: user.id,
          },
        },
      },
      tx,
    );
  });
}

export async function updateWorkspaceMemberRole(input: UpdateWorkspaceMemberRoleInput) {
  if (isLocalDataMode()) {
    throw new WorkspaceMemberError("Defina DATABASE_URL para editar papeis reais do workspace.");
  }

  const context = await requireWorkspaceManager();

  const membership = await prisma.workspaceMembership.findUnique({
    where: { id: input.membershipId },
    include: {
      user: true,
    },
  });

  if (!membership || membership.workspaceId !== context.workspaceId) {
    throw new WorkspaceMemberError("Membro do workspace nao encontrado.");
  }

  const summary = await getWorkspaceMembershipSummary(context.workspaceId);

  if (
    membership.role === WorkspaceRole.OWNER &&
    input.role !== WorkspaceRole.OWNER &&
    summary.ownerCount <= 1
  ) {
    throw new WorkspaceMemberError("O workspace precisa manter pelo menos um owner.");
  }

  if (membership.userId === context.userId && membership.role === WorkspaceRole.OWNER && input.role !== WorkspaceRole.OWNER) {
    throw new WorkspaceMemberError("Voce nao pode rebaixar o proprio acesso de owner enquanto for o ultimo owner.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMembership.update({
      where: { id: input.membershipId },
      data: {
        role: input.role,
      },
    });

    await recordAuditEvent(
      {
        action: "workspace.member.role_updated",
        entityType: "workspace_membership",
        entityId: membership.id,
        context,
        payload: {
          summary: `${membership.user.email} mudou de ${membership.role} para ${input.role}.`,
          metadata: {
            email: membership.user.email,
            fromRole: membership.role,
            toRole: input.role,
            userId: membership.userId,
          },
        },
      },
      tx,
    );
  });
}

export async function removeWorkspaceMember(membershipId: string) {
  if (isLocalDataMode()) {
    throw new WorkspaceMemberError("Defina DATABASE_URL para remover usuarios reais do workspace.");
  }

  const context = await requireWorkspaceManager();

  const membership = await prisma.workspaceMembership.findUnique({
    where: { id: membershipId },
    include: {
      user: true,
    },
  });

  if (!membership || membership.workspaceId !== context.workspaceId) {
    throw new WorkspaceMemberError("Membro do workspace nao encontrado.");
  }

  if (membership.userId === context.userId) {
    throw new WorkspaceMemberError("Use outro owner ou admin para remover o seu proprio acesso.");
  }

  const summary = await getWorkspaceMembershipSummary(context.workspaceId);

  if (membership.role === WorkspaceRole.OWNER && summary.ownerCount <= 1) {
    throw new WorkspaceMemberError("O ultimo owner do workspace nao pode ser removido.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMembership.delete({
      where: { id: membershipId },
    });

    await recordAuditEvent(
      {
        action: "workspace.member.removed",
        entityType: "workspace_membership",
        entityId: membership.id,
        context,
        payload: {
          summary: `${membership.user.email} foi removido do workspace.`,
          metadata: {
            email: membership.user.email,
            role: membership.role,
            userId: membership.userId,
          },
        },
      },
      tx,
    );
  });
}

export async function resetWorkspaceMemberPassword(input: ResetWorkspaceMemberPasswordInput) {
  if (isLocalDataMode()) {
    throw new WorkspaceMemberError("Defina DATABASE_URL para redefinir senha de usuarios reais.");
  }

  const context = await requireWorkspaceManager();

  if (!input.password.trim() || input.password.trim().length < 8) {
    throw new WorkspaceMemberError("A nova senha precisa ter pelo menos 8 caracteres.");
  }

  const membership = await prisma.workspaceMembership.findUnique({
    where: { id: input.membershipId },
    include: {
      user: true,
    },
  });

  if (!membership || membership.workspaceId !== context.workspaceId) {
    throw new WorkspaceMemberError("Membro do workspace nao encontrado.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: membership.userId },
      data: {
        passwordHash: hashPassword(input.password.trim()),
      },
    });

    await recordAuditEvent(
      {
        action: "workspace.member.password_reset",
        entityType: "workspace_membership",
        entityId: membership.id,
        context,
        payload: {
          summary: `Senha redefinida para ${membership.user.email}.`,
          metadata: {
            email: membership.user.email,
            userId: membership.userId,
          },
        },
      },
      tx,
    );
  });
}
