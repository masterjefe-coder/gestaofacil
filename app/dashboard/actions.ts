"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createChargeFromQuote, updateCharge } from "@/lib/charge-repository";
import { updateCustomerStatus } from "@/lib/customer-repository";
import { ACTIVE_WORKSPACE_COOKIE, requireSessionUser } from "@/lib/auth-session";
import {
  FormInputError,
  readOptionalFormMaybeString,
  readOptionalFormString,
  readRequiredFormEnum,
} from "@/lib/form-inputs";
import { writeDashboardQueuePreference, type DashboardQueueModule } from "@/lib/dashboard-queue-preferences";
import { prisma } from "@/lib/prisma";
import { updateQuote } from "@/lib/quote-repository";
import type { Customer } from "@/lib/types";

function buildRedirectUrl(path: string, view?: string, focus?: string) {
  const params = new URLSearchParams();

  if (view) {
    params.set("view", view);
  }

  if (focus) {
    params.set("focus", focus);
  }

  return params.size > 0 ? `${path}?${params.toString()}` : path;
}

function todayIsoDate() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function revalidateDashboardOperationViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/quotes");
}

export async function persistDashboardQueuePreferenceAction(formData: FormData) {
  const path = readOptionalFormString(formData, "path") || "/dashboard";
  const view = readOptionalFormString(formData, "view");
  const focus = readOptionalFormString(formData, "focus");
  const moduleKey = readOptionalFormString(formData, "module") as DashboardQueueModule;

  if (!moduleKey) {
    redirect(path);
  }

  await writeDashboardQueuePreference(moduleKey, {
    view,
    focus,
  });

  redirect(buildRedirectUrl(path, view, focus));
}

export async function switchActiveWorkspaceAction(formData: FormData) {
  const workspaceId = readOptionalFormString(formData, "workspaceId");
  const returnTo = readOptionalFormString(formData, "returnTo") || "/dashboard";

  if (!workspaceId) {
    redirect(returnTo);
  }

  const { email } = await requireSessionUser();
  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      workspaceId,
      user: {
        email,
      },
    },
    select: {
      workspaceId: true,
    },
  });

  if (!membership) {
    redirect(`${returnTo}?workspaceError=1`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirect(returnTo);
}

export async function markDashboardQuoteFollowUpAction(formData: FormData) {
  const id = readOptionalFormString(formData, "id");
  const dueLabel = readOptionalFormString(formData, "dueLabel") || "Follow-up hoje";

  if (!id) {
    return;
  }

  await updateQuote(id, {
    status: "Follow-up",
    dueLabel,
  });
  revalidateDashboardOperationViews();
}

export async function generateDashboardChargeFromQuoteAction(formData: FormData) {
  const id = readOptionalFormString(formData, "id");

  if (!id) {
    return;
  }

  await createChargeFromQuote(id, "Pix", "cobrar hoje", todayIsoDate(), "Hoje");
  revalidateDashboardOperationViews();
  revalidatePath("/dashboard/fiscal");
}

export async function markDashboardCustomerStatusAction(formData: FormData) {
  const id = readOptionalFormString(formData, "id");

  if (!id) {
    return;
  }

  try {
    const status = readRequiredFormEnum(
      formData,
      "status",
      ["Ativo", "Aguardando retorno", "Recorrente"] satisfies readonly Customer["status"][],
    );
    const note = readOptionalFormMaybeString(formData, "note");

    await updateCustomerStatus(id, status, note);
    revalidateDashboardOperationViews();
  } catch (error) {
    if (error instanceof FormInputError) {
      return;
    }

    throw error;
  }
}

export async function markDashboardChargeTodayAction(formData: FormData) {
  const id = readOptionalFormString(formData, "id");

  if (!id) {
    return;
  }

  await updateCharge(id, {
    status: "Hoje",
    dueDate: todayIsoDate(),
    dueLabel: "vence hoje",
  });
  revalidateDashboardOperationViews();
}

export async function markDashboardQuoteApprovedAction(formData: FormData) {
  const id = readOptionalFormString(formData, "id");

  if (!id) {
    return;
  }

  await updateQuote(id, {
    status: "Aprovado",
    dueLabel: "Aprovado e pronto para operação",
  });
  revalidateDashboardOperationViews();
}
