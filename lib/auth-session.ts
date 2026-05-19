import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import type { WorkspaceRole } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { DEMO_WORKSPACE_ID, isLocalDataMode } from "@/lib/data-mode";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
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

export function canManageWorkspace(role: WorkspaceContext["workspaceRole"]) {
  return role === "OWNER" || role === "ADMIN";
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

  if (isLocalDataMode()) {
    return {
      userId: session.user?.id || "demo-user",
      email,
      workspaceId: session.user?.workspaceId || DEMO_WORKSPACE_ID,
      workspaceRole: session.user?.workspaceRole || "OWNER",
    };
  }

  await ensureDemoCommerceSeeded();

  const membership = await prisma.workspaceMembership.findFirst({
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

  if (!membership) {
    throw new AuthSessionError("Usuario sem workspace vinculado.", 403);
  }

  return {
    userId: membership.userId,
    email: membership.user.email,
    workspaceId: membership.workspaceId,
    workspaceRole: membership.role,
  };
}
