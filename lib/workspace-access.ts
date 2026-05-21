import type { WorkspaceContext } from "@/lib/auth-session";

type WorkspaceRoleLike = WorkspaceContext["workspaceRole"];
export type WorkspaceModuleKey = "dashboard" | "customers" | "quotes" | "orders" | "billing" | "fiscal" | "reports" | "setup";

export type WorkspaceModuleCapabilities = {
  canView: boolean;
  canManage: boolean;
  canOperate: boolean;
  canConfigure: boolean;
};

function isManager(role: WorkspaceRoleLike) {
  return role === "OWNER" || role === "ADMIN";
}

export function getWorkspaceModuleCapabilities(
  role: WorkspaceRoleLike,
  module: WorkspaceModuleKey,
): WorkspaceModuleCapabilities {
  const manager = isManager(role);

  switch (module) {
    case "setup":
      return {
        canView: true,
        canManage: manager,
        canOperate: false,
        canConfigure: manager,
      };
    case "fiscal":
      return {
        canView: true,
        canManage: manager,
        canOperate: manager,
        canConfigure: manager,
      };
    case "billing":
      return {
        canView: true,
        canManage: manager,
        canOperate: true,
        canConfigure: false,
      };
    default:
      return {
        canView: true,
        canManage: true,
        canOperate: true,
        canConfigure: false,
      };
  }
}

export function getWorkspaceRoleLabel(role: WorkspaceRoleLike) {
  switch (role) {
    case "OWNER":
      return "Responsável";
    case "ADMIN":
      return "Gestão";
    case "MEMBER":
      return "Operação";
    default:
      return role;
  }
}
