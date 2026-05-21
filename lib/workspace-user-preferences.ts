import { recordAuditEvent } from "@/lib/audit-repository";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { isLocalDataMode } from "@/lib/data-mode";
import { prisma } from "@/lib/prisma";
import type { WorkspaceUserAlertPreferences } from "@/lib/types";

const DEFAULT_ALERT_PREFERENCES: WorkspaceUserAlertPreferences = {
  showOperationalAlerts: true,
  showNotificationCenter: true,
  emailOnInviteAccepted: true,
  emailOnSecurityAlerts: true,
};

export function getDefaultWorkspaceUserAlertPreferences(): WorkspaceUserAlertPreferences {
  return { ...DEFAULT_ALERT_PREFERENCES };
}

function mapPreferenceRecord(record: Partial<WorkspaceUserAlertPreferences> | null | undefined): WorkspaceUserAlertPreferences {
  return {
    showOperationalAlerts: record?.showOperationalAlerts ?? true,
    showNotificationCenter: record?.showNotificationCenter ?? true,
    emailOnInviteAccepted: record?.emailOnInviteAccepted ?? true,
    emailOnSecurityAlerts: record?.emailOnSecurityAlerts ?? true,
  };
}

export async function getCurrentUserAlertPreferences(): Promise<WorkspaceUserAlertPreferences> {
  if (isLocalDataMode()) {
    return getDefaultWorkspaceUserAlertPreferences();
  }

  const context = await getCurrentWorkspaceContext();
  const record = await prisma.workspaceUserPreference.findUnique({
    where: {
      userId_workspaceId: {
        userId: context.userId,
        workspaceId: context.workspaceId,
      },
    },
  });

  return mapPreferenceRecord(record);
}

export async function getWorkspaceUserAlertPreferences(input: {
  workspaceId: string;
  userId: string;
}): Promise<WorkspaceUserAlertPreferences> {
  if (isLocalDataMode()) {
    return getDefaultWorkspaceUserAlertPreferences();
  }

  const record = await prisma.workspaceUserPreference.findUnique({
    where: {
      userId_workspaceId: {
        userId: input.userId,
        workspaceId: input.workspaceId,
      },
    },
  });

  return mapPreferenceRecord(record);
}

export async function updateCurrentUserAlertPreferences(input: WorkspaceUserAlertPreferences) {
  if (isLocalDataMode()) {
    return getDefaultWorkspaceUserAlertPreferences();
  }

  const context = await getCurrentWorkspaceContext();
  const updated = await prisma.workspaceUserPreference.upsert({
    where: {
      userId_workspaceId: {
        userId: context.userId,
        workspaceId: context.workspaceId,
      },
    },
    update: input,
    create: {
      userId: context.userId,
      workspaceId: context.workspaceId,
      ...input,
    },
  });

  await recordAuditEvent({
    action: "workspace.user_preferences.updated",
    entityType: "workspace_user_preference",
    entityId: updated.id,
    context,
    payload: {
      summary: `${context.email} atualizou as preferências pessoais de alerta do workspace.`,
      metadata: input,
    },
  });

  return mapPreferenceRecord(updated);
}
