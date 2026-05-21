import type { AuditEntry } from "@/lib/types";
import { listWorkspaceAuditEntriesByActions } from "@/lib/audit-repository";
import { getCurrentUserAlertPreferences } from "@/lib/workspace-user-preferences";

export type DashboardNotificationItem = {
  id: string;
  title: string;
  message: string;
  tone: "info" | "warning";
};

function buildNotificationTitle(action: string) {
  switch (action) {
    case "auth.login.failed":
      return "Falha de login";
    case "auth.login.locked":
      return "Proteção de acesso ativada";
    case "auth.password_reset.requested":
      return "Pedido de redefinição";
    case "auth.password_reset.completed":
      return "Senha redefinida";
    case "workspace.invite.accepted":
      return "Convite aceito";
    case "workspace.invite.email_failed":
      return "Falha no envio do convite";
    default:
      return "Evento recente";
  }
}

function mapAuditToNotification(entry: AuditEntry): DashboardNotificationItem {
  const tone = entry.action === "auth.login.failed" || entry.action === "auth.login.locked" || entry.action === "workspace.invite.email_failed"
    ? "warning"
    : "info";

  return {
    id: entry.id,
    title: buildNotificationTitle(entry.action),
    message: `${entry.summary} • ${entry.createdAt}`,
    tone,
  };
}

export async function getDashboardNotificationCenter(limit = 5) {
  const preferences = await getCurrentUserAlertPreferences();

  if (!preferences.showNotificationCenter) {
    return [];
  }

  const entries = await listWorkspaceAuditEntriesByActions([
    "auth.login.failed",
    "auth.login.locked",
    "auth.password_reset.requested",
    "auth.password_reset.completed",
    "workspace.invite.accepted",
    "workspace.invite.email_failed",
  ], limit);

  return entries.map(mapAuditToNotification);
}
