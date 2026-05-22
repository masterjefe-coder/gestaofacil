import { NextResponse } from "next/server";
import { AuthSessionError, requireSessionUser } from "@/lib/auth-session";
import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { getWorkspaceModuleCapabilities, type WorkspaceModuleKey } from "@/lib/workspace-access";

type WorkspaceCapability = "canView" | "canManage" | "canOperate" | "canConfigure";

export async function requireApiSession() {
  try {
    await requireSessionUser();
    return null;
  } catch (error) {
    if (error instanceof AuthSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Falha ao validar sessao." }, { status: 500 });
  }
}

export async function requireApiModuleAccess(
  module: WorkspaceModuleKey,
  capability: WorkspaceCapability,
  errorMessage?: string,
) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const context = await getCurrentWorkspaceContext();
    const capabilities = getWorkspaceModuleCapabilities(context.workspaceRole, module);

    if (!capabilities[capability]) {
      return NextResponse.json(
        { error: errorMessage || "Seu perfil atual nao pode executar esta operacao neste workspace." },
        { status: 403 },
      );
    }

    return null;
  } catch (error) {
    if (error instanceof AuthSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Falha ao validar permissoes do workspace." }, { status: 500 });
  }
}
