import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { isLocalDataMode } from "@/lib/data-mode";
import { readDemoWorkspaceData, writeDemoWorkspaceData } from "@/lib/demo-store";
import { prisma } from "@/lib/prisma";

export type WorkspaceAsaasConnection = {
  mode: "workspace" | "root_fallback" | "disabled";
  environment: "sandbox" | "production";
  apiKey: string | null;
  accountId?: string;
  walletId?: string;
  apiKeyConfigured: boolean;
  splitEnabled: boolean;
};

function resolveEnvironment() {
  return process.env.ASAAS_ENVIRONMENT?.trim().toLowerCase() === "production" ? "production" as const : "sandbox" as const;
}

function rootFallbackEnabled() {
  const value = process.env.ASAAS_ALLOW_ROOT_ACCOUNT_FALLBACK?.trim().toLowerCase();
  return value !== "false";
}

export async function getWorkspaceAsaasConnection(): Promise<WorkspaceAsaasConnection> {
  const environment = resolveEnvironment();
  const rootApiKey = process.env.ASAAS_API_KEY?.trim() || null;

  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    const ownApiKey = data.company.asaasUseOwnAccount && data.company.asaasApiKey ? data.company.asaasApiKey : null;

    if (ownApiKey) {
      return {
        mode: "workspace",
        environment,
        apiKey: ownApiKey,
        accountId: data.company.asaasAccountId,
        walletId: data.company.asaasWalletId,
        apiKeyConfigured: true,
        splitEnabled: Boolean(data.company.asaasSplitEnabled),
      };
    }

    if (rootApiKey && rootFallbackEnabled()) {
      return {
        mode: "root_fallback",
        environment,
        apiKey: rootApiKey,
        apiKeyConfigured: true,
        splitEnabled: false,
      };
    }

    return {
      mode: "disabled",
      environment,
      apiKey: null,
      apiKeyConfigured: false,
      splitEnabled: false,
    };
  }

  const { workspaceId } = await getCurrentWorkspaceContext();
  const company = await prisma.company.findUnique({
    where: { workspaceId },
    select: {
      asaasApiKey: true,
      asaasAccountId: true,
      asaasWalletId: true,
      asaasUseOwnAccount: true,
      asaasSplitEnabled: true,
    },
  });

  if (company?.asaasUseOwnAccount && company.asaasApiKey) {
    return {
      mode: "workspace",
      environment,
      apiKey: company.asaasApiKey,
      accountId: company.asaasAccountId || undefined,
      walletId: company.asaasWalletId || undefined,
      apiKeyConfigured: true,
      splitEnabled: company.asaasSplitEnabled,
    };
  }

  if (rootApiKey && rootFallbackEnabled()) {
    return {
      mode: "root_fallback",
      environment,
      apiKey: rootApiKey,
      apiKeyConfigured: true,
      splitEnabled: false,
    };
  }

  return {
    mode: "disabled",
    environment,
    apiKey: null,
    apiKeyConfigured: false,
    splitEnabled: false,
  };
}

export async function saveWorkspaceAsaasConnection(input: {
  apiKey: string;
  accountId?: string;
  walletId?: string;
  splitEnabled: boolean;
}) {
  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();

    data.company.asaasApiKey = input.apiKey;
    data.company.asaasAccountId = input.accountId || "";
    data.company.asaasWalletId = input.walletId || "";
    data.company.asaasUseOwnAccount = true;
    data.company.asaasSplitEnabled = input.splitEnabled;

    await writeDemoWorkspaceData(data);
    return;
  }

  const { workspaceId } = await getCurrentWorkspaceContext();

  await prisma.company.upsert({
    where: { workspaceId },
    update: {
      asaasApiKey: input.apiKey,
      asaasAccountId: input.accountId || null,
      asaasWalletId: input.walletId || null,
      asaasUseOwnAccount: true,
      asaasSplitEnabled: input.splitEnabled,
    },
    create: {
      workspaceId,
      legalName: "Empresa sem razão social definida",
      tradeName: "Workspace sem setup completo",
      document: `workspace-${workspaceId}`,
      asaasApiKey: input.apiKey,
      asaasAccountId: input.accountId || null,
      asaasWalletId: input.walletId || null,
      asaasUseOwnAccount: true,
      asaasSplitEnabled: input.splitEnabled,
    },
  });
}

export async function disconnectWorkspaceAsaasConnection() {
  if (isLocalDataMode()) {
    const data = await readDemoWorkspaceData();
    data.company.asaasApiKey = "";
    data.company.asaasAccountId = "";
    data.company.asaasWalletId = "";
    data.company.asaasUseOwnAccount = false;
    data.company.asaasSplitEnabled = false;
    await writeDemoWorkspaceData(data);
    return;
  }

  const { workspaceId } = await getCurrentWorkspaceContext();
  await prisma.company.updateMany({
    where: { workspaceId },
    data: {
      asaasApiKey: null,
      asaasAccountId: null,
      asaasWalletId: null,
      asaasUseOwnAccount: false,
      asaasSplitEnabled: false,
    },
  });
}
