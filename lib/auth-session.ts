import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import type { Session } from "next-auth";
import type { WorkspaceRole } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { DEMO_WORKSPACE_ID, isLocalDataMode } from "@/lib/data-mode";
import { prisma } from "@/lib/prisma";

export class AuthSessionError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthSessionError";
    this.status = status;
  }
}

export type WorkspaceContext = {
  userId: string;
  email: string;
  workspaceId: string;
  workspaceRole: WorkspaceRole | "OWNER";
};

export type WorkspaceMembershipSelection = {
  userId: string;
  userEmail: string;
  workspaceId: string;
  role: WorkspaceRole;
};

export const ACTIVE_WORKSPACE_COOKIE = "gestao_facil_workspace";

export function canManageWorkspace(role: WorkspaceContext["workspaceRole"]) {
  return role === "OWNER" || role === "ADMIN";
}

export function resolvePreferredWorkspaceId(input: {
  cookieWorkspaceId?: string | null;
  sessionWorkspaceId?: string | null;
}) {
  return input.cookieWorkspaceId?.trim()
    || input.sessionWorkspaceId?.trim()
    || undefined;
}

export function buildWorkspaceContextFromMembership(membership: WorkspaceMembershipSelection): WorkspaceContext {
  return {
    userId: membership.userId,
    email: membership.userEmail,
    workspaceId: membership.workspaceId,
    workspaceRole: membership.role,
  };
}

export async function requireSessionUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim();

  if (!email) {
    throw new AuthSessionError("Sessao invalida ou ausente.", 401);
  }

  return {
    session: session as Session,
    email,
  };
}

export async function getCurrentWorkspaceContext(): Promise<WorkspaceContext> {
  const { session, email } = await requireSessionUser();
  const cookieStore = await cookies();
  const preferredWorkspaceId = resolvePreferredWorkspaceId({
    cookieWorkspaceId: cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value,
    sessionWorkspaceId: session.user?.workspaceId,
  });

  if (isLocalDataMode()) {
    return {
      userId: session.user?.id || "demo-user",
      email,
      workspaceId: session.user?.workspaceId || DEMO_WORKSPACE_ID,
      workspaceRole: session.user?.workspaceRole || "OWNER",
    };
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      workspaceId: preferredWorkspaceId || undefined,
      user: {
        email,
      },
    },
    include: {
      user: true,
      workspace: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!membership && preferredWorkspaceId) {
    throw new AuthSessionError("Workspace selecionado nao pertence ao usuario autenticado.", 403);
  }

  if (!membership) {
    const fallbackMembership = await prisma.workspaceMembership.findFirst({
      where: {
        user: {
          email,
        },
      },
      include: {
        user: true,
        workspace: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!fallbackMembership) {
      throw new AuthSessionError("Usuario sem workspace vinculado.", 403);
    }

    return buildWorkspaceContextFromMembership({
      userId: fallbackMembership.userId,
      userEmail: fallbackMembership.user.email,
      workspaceId: fallbackMembership.workspaceId,
      role: fallbackMembership.role,
    });
  }

  return buildWorkspaceContextFromMembership({
    userId: membership.userId,
    userEmail: membership.user.email,
    workspaceId: membership.workspaceId,
    role: membership.role,
  });
}
