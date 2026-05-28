import { Prisma } from "@prisma/client";
import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/auth-session";
import { recordAuditEvent } from "@/lib/audit-repository";
import { createAsaasSubaccount, inspectAsaasAccount } from "@/lib/asaas";
import { isLocalDataMode } from "@/lib/data-mode";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { resolveIbgeMunicipalityCode } from "@/lib/ibge";
import { prisma } from "@/lib/prisma";
import { readDemoWorkspaceData, writeDemoWorkspaceData } from "@/lib/demo-store";
import { encryptWorkspaceSecret } from "@/lib/secret-crypto";
import type { SetupInput } from "@/lib/types";

export async function getWorkspaceSetup() {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const { workspaceId } = await getCurrentWorkspaceContext();
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    const company = await prisma.company.findUnique({
      where: { workspaceId },
    });

    const resolvedMunicipality = !company?.municipalCode && company?.city && company?.state
      ? await resolveIbgeMunicipalityCode(company.city, company.state)
      : null;

    return {
      name: workspace.name,
      slug: workspace.slug,
      niche: company?.serviceDescription || "Servicos locais e operacao comercial enxuta",
      legalName: company?.legalName || workspace.name,
      tradeName: company?.tradeName || workspace.name,
      document: company?.document || "",
      city: company?.city || "",
      state: company?.state || "",
      municipalCode: company?.municipalCode || resolvedMunicipality?.municipalCode || "",
      evolutionInstanceName: company?.evolutionInstanceName || "",
      serviceDescription: company?.serviceDescription || "",
      defaultFiscalServiceCode: company?.defaultFiscalServiceCode || "",
      defaultPixKey: company?.defaultPixKey || "",
      defaultPaymentMessage: company?.defaultPaymentMessage || "",
      asaasAccountId: company?.asaasAccountId || "",
      asaasWalletId: company?.asaasWalletId || "",
      asaasUseOwnAccount: company?.asaasUseOwnAccount || false,
      asaasSplitEnabled: company?.asaasSplitEnabled || false,
    };
  }

  const data = await readDemoWorkspaceData();
  const resolvedMunicipality = !data.company.municipalCode && data.company.city && data.company.state
    ? await resolveIbgeMunicipalityCode(data.company.city, data.company.state)
    : null;

  return {
    ...data.workspace,
    ...data.company,
    municipalCode: data.company.municipalCode || resolvedMunicipality?.municipalCode || "",
  };
}

export async function getWorkspaceEvolutionInstanceName() {
  const setup = await getWorkspaceSetup();
  return setup.evolutionInstanceName?.trim() || "";
}

export async function getWorkspaceEvolutionInstanceNameByWorkspaceId(workspaceId: string) {
  if (!workspaceId || isLocalDataMode()) {
    return "";
  }

  const company = await prisma.company.findUnique({
    where: { workspaceId },
    select: { evolutionInstanceName: true },
  });

  return company?.evolutionInstanceName?.trim() || "";
}

export async function ensureWorkspaceEvolutionInstanceAvailable(instanceName: string, workspaceId?: string) {
  const normalizedInstanceName = instanceName.trim();

  if (!normalizedInstanceName || isLocalDataMode()) {
    return;
  }

  await ensureDemoCommerceSeeded();

  const company = await prisma.company.findFirst({
    where: {
      evolutionInstanceName: normalizedInstanceName,
    },
    select: {
      workspaceId: true,
    },
  });

  if (company && workspaceId && company.workspaceId === workspaceId) {
    return;
  }

  if (company) {
    throw new Error("Essa instancia principal do WhatsApp ja esta vinculada a outra empresa.");
  }
}

export async function bindWorkspaceEvolutionInstanceName(instanceName: string) {
  const normalizedInstanceName = instanceName.trim();

  if (!normalizedInstanceName) {
    throw new Error("Informe uma instancia valida para vincular ao workspace.");
  }

  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const context = await getCurrentWorkspaceContext();

    if (!canManageWorkspace(context.workspaceRole)) {
      throw new Error("Apenas owner ou admin podem definir a instancia principal do WhatsApp.");
    }

    await ensureWorkspaceEvolutionInstanceAvailable(normalizedInstanceName, context.workspaceId);

    await prisma.company.upsert({
      where: { workspaceId: context.workspaceId },
      update: {
        evolutionInstanceName: normalizedInstanceName,
      },
      create: {
        workspaceId: context.workspaceId,
        legalName: "Empresa sem razao social definida",
        tradeName: "Workspace sem setup completo",
        document: `workspace-${context.workspaceId}`,
        evolutionInstanceName: normalizedInstanceName,
      },
    });

    await recordAuditEvent({
      action: "workspace.evolution.instance_bound",
      entityType: "workspace",
      entityId: context.workspaceId,
      context,
      payload: {
        summary: `Instancia principal do WhatsApp vinculada ao workspace: ${normalizedInstanceName}.`,
        metadata: {
          instanceName: normalizedInstanceName,
        },
      },
    });

    return normalizedInstanceName;
  }

  const data = await readDemoWorkspaceData();
  data.company.evolutionInstanceName = normalizedInstanceName;
  await writeDemoWorkspaceData(data);
  return normalizedInstanceName;
}

export async function unbindWorkspaceEvolutionInstanceName(instanceName?: string) {
  const normalizedInstanceName = instanceName?.trim() || "";

  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const context = await getCurrentWorkspaceContext();

    if (!canManageWorkspace(context.workspaceRole)) {
      throw new Error("Apenas owner ou admin podem desvincular a instancia principal do WhatsApp.");
    }

    const company = await prisma.company.findUnique({
      where: { workspaceId: context.workspaceId },
      select: { evolutionInstanceName: true },
    });

    const currentInstanceName = company?.evolutionInstanceName?.trim() || "";

    if (!currentInstanceName) {
      return "";
    }

    if (normalizedInstanceName && normalizedInstanceName !== currentInstanceName) {
      return currentInstanceName;
    }

    await prisma.company.updateMany({
      where: { workspaceId: context.workspaceId },
      data: {
        evolutionInstanceName: null,
      },
    });

    await recordAuditEvent({
      action: "workspace.evolution.instance_unbound",
      entityType: "workspace",
      entityId: context.workspaceId,
      context,
      payload: {
        summary: `Instancia principal do WhatsApp desvinculada do workspace: ${currentInstanceName}.`,
        metadata: {
          instanceName: currentInstanceName,
        },
      },
    });

    return currentInstanceName;
  }

  const data = await readDemoWorkspaceData();
  const currentInstanceName = data.company.evolutionInstanceName?.trim() || "";

  if (!currentInstanceName) {
    return "";
  }

  if (normalizedInstanceName && normalizedInstanceName !== currentInstanceName) {
    return currentInstanceName;
  }

  data.company.evolutionInstanceName = "";
  await writeDemoWorkspaceData(data);
  return currentInstanceName;
}

export async function updateWorkspaceSetup(input: SetupInput) {
  const resolvedMunicipality = input.city && input.state
    ? await resolveIbgeMunicipalityCode(input.city, input.state)
    : null;

  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const context = await getCurrentWorkspaceContext();

    if (!canManageWorkspace(context.workspaceRole)) {
      throw new Error("Apenas owner ou admin podem atualizar o setup do workspace.");
    }

    const [workspace, company] = await Promise.all([
      prisma.workspace.findUniqueOrThrow({
        where: { id: context.workspaceId },
      }),
      prisma.company.findUnique({
        where: { workspaceId: context.workspaceId },
      }),
    ]);
    const nextEvolutionInstanceName =
      input.evolutionInstanceName === undefined
        ? company?.evolutionInstanceName || null
        : input.evolutionInstanceName || null;

    const changedFields = [
      workspace.name !== input.name ? "nome do workspace" : null,
      workspace.slug !== input.slug ? "slug" : null,
      (company?.legalName || "") !== input.legalName ? "razao social" : null,
      (company?.tradeName || workspace.name) !== input.tradeName ? "nome fantasia" : null,
      (company?.document || "") !== input.document ? "documento" : null,
      (company?.city || "") !== input.city ? "cidade" : null,
      (company?.state || "") !== input.state ? "UF" : null,
      (company?.municipalCode || "") !== (resolvedMunicipality?.municipalCode || "") ? "codigo IBGE" : null,
      (company?.evolutionInstanceName || "") !== (nextEvolutionInstanceName || "") ? "instancia principal do WhatsApp" : null,
      (company?.serviceDescription || "") !== (input.serviceDescription || input.niche)
        ? "descricao de servicos"
        : null,
      (company?.defaultFiscalServiceCode || "") !== (input.defaultFiscalServiceCode || "") ? "codigo padrao de servico" : null,
      (company?.defaultPixKey || "") !== input.defaultPixKey ? "chave Pix" : null,
      (company?.defaultPaymentMessage || "") !== input.defaultPaymentMessage
        ? "mensagem de cobranca"
        : null,
    ].filter(Boolean);

    try {
      await prisma.$transaction(async (tx) => {
        await tx.workspace.update({
          where: { id: context.workspaceId },
          data: {
            name: input.name,
            slug: input.slug,
          },
        });

        await tx.company.upsert({
          where: { workspaceId: context.workspaceId },
          update: {
            legalName: input.legalName,
            tradeName: input.tradeName,
            document: input.document,
            city: input.city,
            state: input.state,
            municipalCode: resolvedMunicipality?.municipalCode || null,
            evolutionInstanceName: nextEvolutionInstanceName,
            serviceDescription: input.serviceDescription || input.niche,
            defaultFiscalServiceCode: input.defaultFiscalServiceCode || null,
            defaultPixKey: input.defaultPixKey,
            defaultPaymentMessage: input.defaultPaymentMessage,
          },
          create: {
            workspaceId: context.workspaceId,
            legalName: input.legalName,
            tradeName: input.tradeName,
            document: input.document,
            city: input.city,
            state: input.state,
            municipalCode: resolvedMunicipality?.municipalCode || null,
            evolutionInstanceName: nextEvolutionInstanceName,
            serviceDescription: input.serviceDescription || input.niche,
            defaultFiscalServiceCode: input.defaultFiscalServiceCode || null,
            defaultPixKey: input.defaultPixKey,
            defaultPaymentMessage: input.defaultPaymentMessage,
          },
        });

        await recordAuditEvent(
          {
            action: "workspace.setup.updated",
            entityType: "workspace",
            entityId: context.workspaceId,
            context,
            payload: {
              summary: changedFields.length
                ? `Setup atualizado: ${changedFields.join(", ")}.`
                : "Setup salvo sem alteracoes materiais.",
              metadata: {
                changedFieldCount: changedFields.length,
                tradeName: input.tradeName,
                city: input.city || null,
                state: input.state || null,
                municipalCode: resolvedMunicipality?.municipalCode || null,
                evolutionInstanceName: nextEvolutionInstanceName,
              },
            },
          },
          tx,
        );
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : String(error.meta?.target || "");

        if (target.includes("slug")) {
          throw new Error("Esse identificador interno ja esta em uso por outra empresa.");
        }

        if (target.includes("document")) {
          throw new Error("Esse documento ja esta vinculado a outra empresa.");
        }

        if (target.includes("evolutionInstanceName")) {
          throw new Error("Essa instancia principal do WhatsApp ja esta vinculada a outra empresa.");
        }
      }

      throw error;
    }

    return {
      workspace: {
        name: input.name,
        slug: input.slug,
        niche: input.niche,
      },
      company: {
        legalName: input.legalName,
        tradeName: input.tradeName,
        document: input.document,
        city: input.city,
        state: input.state,
        municipalCode: resolvedMunicipality?.municipalCode || "",
        evolutionInstanceName:
          input.evolutionInstanceName === undefined
            ? company?.evolutionInstanceName || ""
            : input.evolutionInstanceName || "",
        serviceDescription: input.serviceDescription,
        defaultFiscalServiceCode: input.defaultFiscalServiceCode || "",
        defaultPixKey: input.defaultPixKey,
        defaultPaymentMessage: input.defaultPaymentMessage,
      },
    };
  }

  const data = await readDemoWorkspaceData();

  data.workspace = {
    name: input.name,
    slug: input.slug,
    niche: input.niche,
  };

  data.company = {
    legalName: input.legalName,
    tradeName: input.tradeName,
    document: input.document,
    city: input.city,
    state: input.state,
    municipalCode: resolvedMunicipality?.municipalCode || "",
    evolutionInstanceName:
      input.evolutionInstanceName === undefined
        ? data.company.evolutionInstanceName || ""
        : input.evolutionInstanceName || "",
    serviceDescription: input.serviceDescription,
    defaultFiscalServiceCode: input.defaultFiscalServiceCode || "",
    defaultPixKey: input.defaultPixKey,
    defaultPaymentMessage: input.defaultPaymentMessage,
    asaasAccountId: data.company.asaasAccountId || "",
    asaasWalletId: data.company.asaasWalletId || "",
    asaasUseOwnAccount: data.company.asaasUseOwnAccount || false,
    asaasSplitEnabled: data.company.asaasSplitEnabled || false,
  };

  await writeDemoWorkspaceData(data);
  return data;
}

export async function connectWorkspaceAsaasAccount(input: {
  apiKey: string;
  accountId?: string;
  splitEnabled: boolean;
}) {
  const inspection = await inspectAsaasAccount(input.apiKey);
  const walletId = inspection.walletId;

  if (!walletId) {
    throw new Error("Nao foi possivel recuperar o walletId da conta Asaas informada.");
  }

  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const context = await getCurrentWorkspaceContext();

    if (!canManageWorkspace(context.workspaceRole)) {
      throw new Error("Apenas owner ou admin podem conectar a conta Asaas do workspace.");
    }

    await prisma.company.upsert({
      where: { workspaceId: context.workspaceId },
      update: {
        asaasApiKey: encryptWorkspaceSecret(input.apiKey),
        asaasAccountId: input.accountId || null,
        asaasWalletId: walletId,
        asaasUseOwnAccount: true,
        asaasSplitEnabled: input.splitEnabled,
      },
      create: {
        workspaceId: context.workspaceId,
        legalName: "Empresa sem razão social definida",
        tradeName: "Workspace sem setup completo",
        document: `workspace-${context.workspaceId}`,
        asaasApiKey: encryptWorkspaceSecret(input.apiKey),
        asaasAccountId: input.accountId || null,
        asaasWalletId: walletId,
        asaasUseOwnAccount: true,
        asaasSplitEnabled: input.splitEnabled,
      },
    });

    await recordAuditEvent({
      action: "workspace.asaas.connected",
      entityType: "workspace",
      entityId: context.workspaceId,
      context,
      payload: {
        summary: "Conta Asaas propria conectada ao workspace.",
        metadata: {
          walletId,
          accountId: input.accountId || null,
          splitEnabled: input.splitEnabled,
        },
      },
    });

    return { walletId };
  }

  const data = await readDemoWorkspaceData();
  data.company.asaasApiKey = encryptWorkspaceSecret(input.apiKey);
  data.company.asaasAccountId = input.accountId || "";
  data.company.asaasWalletId = walletId;
  data.company.asaasUseOwnAccount = true;
  data.company.asaasSplitEnabled = input.splitEnabled;
  await writeDemoWorkspaceData(data);
  return { walletId };
}

export async function disconnectWorkspaceAsaasAccount() {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const context = await getCurrentWorkspaceContext();

    if (!canManageWorkspace(context.workspaceRole)) {
      throw new Error("Apenas owner ou admin podem desconectar a conta Asaas do workspace.");
    }

    await prisma.company.updateMany({
      where: { workspaceId: context.workspaceId },
      data: {
        asaasApiKey: null,
        asaasAccountId: null,
        asaasWalletId: null,
        asaasUseOwnAccount: false,
        asaasSplitEnabled: false,
      },
    });

    await recordAuditEvent({
      action: "workspace.asaas.disconnected",
      entityType: "workspace",
      entityId: context.workspaceId,
      context,
      payload: {
        summary: "Conta Asaas propria desconectada do workspace.",
        metadata: {},
      },
    });

    return;
  }

  const data = await readDemoWorkspaceData();
  data.company.asaasApiKey = "";
  data.company.asaasAccountId = "";
  data.company.asaasWalletId = "";
  data.company.asaasUseOwnAccount = false;
  data.company.asaasSplitEnabled = false;
  await writeDemoWorkspaceData(data);
}

export async function createWorkspaceAsaasSubaccount(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  companyType?: string;
  birthDate?: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
  postalCode: string;
}) {
  const created = await createAsaasSubaccount(input);

  if (!created.apiKey || !created.walletId) {
    throw new Error("A subconta foi criada, mas o Asaas nao retornou apiKey e walletId suficientes para operar o workspace.");
  }

  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const context = await getCurrentWorkspaceContext();

    if (!canManageWorkspace(context.workspaceRole)) {
      throw new Error("Apenas owner ou admin podem criar a conta Asaas do workspace.");
    }

    await prisma.company.upsert({
      where: { workspaceId: context.workspaceId },
      update: {
        asaasApiKey: encryptWorkspaceSecret(created.apiKey),
        asaasAccountId: created.accountId || null,
        asaasWalletId: created.walletId,
        asaasUseOwnAccount: true,
        asaasSplitEnabled: false,
      },
      create: {
        workspaceId: context.workspaceId,
        legalName: input.name,
        tradeName: input.name,
        document: input.cpfCnpj,
        asaasApiKey: encryptWorkspaceSecret(created.apiKey),
        asaasAccountId: created.accountId || null,
        asaasWalletId: created.walletId,
        asaasUseOwnAccount: true,
        asaasSplitEnabled: false,
      },
    });

    await recordAuditEvent({
      action: "workspace.asaas.subaccount_created",
      entityType: "workspace",
      entityId: context.workspaceId,
      context,
      payload: {
        summary: "Subconta Asaas criada e vinculada ao workspace.",
        metadata: {
          accountId: created.accountId || null,
          walletId: created.walletId,
          email: input.email,
        },
      },
    });

    return created;
  }

  const data = await readDemoWorkspaceData();
  data.company.asaasApiKey = encryptWorkspaceSecret(created.apiKey);
  data.company.asaasAccountId = created.accountId || "";
  data.company.asaasWalletId = created.walletId;
  data.company.asaasUseOwnAccount = true;
  data.company.asaasSplitEnabled = false;
  await writeDemoWorkspaceData(data);
  return created;
}
