import { getCurrentWorkspaceContext } from "@/lib/auth-session";
import { getAsaasAccountStatus, listAsaasPendingDocuments } from "@/lib/asaas";
import { isLocalDataMode } from "@/lib/data-mode";
import { readDemoWorkspaceData, writeDemoWorkspaceData } from "@/lib/demo-store";
import { prisma } from "@/lib/prisma";
import { decryptWorkspaceSecret, encryptWorkspaceSecret } from "@/lib/secret-crypto";

export type WorkspaceAsaasConnection = {
  mode: "workspace" | "root_fallback" | "disabled";
  environment: "sandbox" | "production";
  apiKey: string | null;
  accountId?: string;
  walletId?: string;
  apiKeyConfigured: boolean;
  splitEnabled: boolean;
};

export type WorkspaceAsaasOnboardingSnapshot = {
  accountId?: string;
  walletId?: string;
  generalApproval?: string;
  commercialStatus?: string;
  documentationStatus?: string;
  bankAccountStatus?: string;
  pendingDocuments: Array<{
    type: string;
    status?: string;
    action?: string;
    sent: boolean;
    pending: boolean;
    url?: string;
  }>;
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
    const ownApiKey = data.company.asaasUseOwnAccount && data.company.asaasApiKey
      ? decryptWorkspaceSecret(data.company.asaasApiKey)
      : null;

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
      apiKey: decryptWorkspaceSecret(company.asaasApiKey),
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

    data.company.asaasApiKey = encryptWorkspaceSecret(input.apiKey);
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
      asaasApiKey: encryptWorkspaceSecret(input.apiKey),
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
      asaasApiKey: encryptWorkspaceSecret(input.apiKey),
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

export async function getWorkspaceAsaasOnboardingSnapshot(): Promise<WorkspaceAsaasOnboardingSnapshot | null> {
  const connection = await getWorkspaceAsaasConnection();

  if (connection.mode !== "workspace" || !connection.apiKeyConfigured || !connection.apiKey) {
    return null;
  }

  try {
    const [status, documents] = await Promise.all([
      getAsaasAccountStatus(connection.apiKey),
      listAsaasPendingDocuments(connection.apiKey).catch(() => []),
    ]);

    return {
      accountId: status.accountId || connection.accountId,
      walletId: connection.walletId,
      generalApproval: status.generalApproval,
      commercialStatus: status.commercialStatus,
      documentationStatus: status.documentationStatus,
      bankAccountStatus: status.bankAccountStatus,
      pendingDocuments: documents,
    };
  } catch {
    return {
      accountId: connection.accountId,
      walletId: connection.walletId,
      pendingDocuments: [],
    };
  }
}
