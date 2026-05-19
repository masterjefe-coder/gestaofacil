import type { DefaultSession } from "next-auth";
import type { WorkspaceRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id?: string;
      workspaceId?: string;
      workspaceRole?: WorkspaceRole;
    };
  }

  interface User {
    workspaceId?: string;
    workspaceRole?: WorkspaceRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    workspaceId?: string;
    workspaceRole?: WorkspaceRole;
  }
}
