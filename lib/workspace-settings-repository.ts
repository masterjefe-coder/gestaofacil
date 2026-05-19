import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/auth-session";
import { isLocalDataMode } from "@/lib/data-mode";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { prisma } from "@/lib/prisma";
import { readDemoWorkspaceData, writeDemoWorkspaceData } from "@/lib/demo-store";
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

    return {
      name: workspace.name,
      slug: workspace.slug,
      niche: company?.serviceDescription || "Servicos locais e operacao comercial enxuta",
      legalName: company?.legalName || workspace.name,
      tradeName: company?.tradeName || workspace.name,
      document: company?.document || "",
      city: company?.city || "",
      state: company?.state || "",
      serviceDescription: company?.serviceDescription || "",
      defaultPixKey: company?.defaultPixKey || "",
      defaultPaymentMessage: company?.defaultPaymentMessage || "",
    };
  }

  const data = await readDemoWorkspaceData();
  return {
    ...data.workspace,
    ...data.company,
  };
}

export async function updateWorkspaceSetup(input: SetupInput) {
  if (!isLocalDataMode()) {
    await ensureDemoCommerceSeeded();
    const { workspaceId, workspaceRole } = await getCurrentWorkspaceContext();

    if (!canManageWorkspace(workspaceRole)) {
      throw new Error("Apenas owner ou admin podem atualizar o setup do workspace.");
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: input.name,
        slug: input.slug,
      },
    });

    await prisma.company.upsert({
      where: { workspaceId },
      update: {
        legalName: input.legalName,
        tradeName: input.tradeName,
        document: input.document,
        city: input.city,
        state: input.state,
        serviceDescription: input.serviceDescription || input.niche,
        defaultPixKey: input.defaultPixKey,
        defaultPaymentMessage: input.defaultPaymentMessage,
      },
      create: {
        workspaceId,
        legalName: input.legalName,
        tradeName: input.tradeName,
        document: input.document,
        city: input.city,
        state: input.state,
        serviceDescription: input.serviceDescription || input.niche,
        defaultPixKey: input.defaultPixKey,
        defaultPaymentMessage: input.defaultPaymentMessage,
      },
    });

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
        serviceDescription: input.serviceDescription,
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
    serviceDescription: input.serviceDescription,
    defaultPixKey: input.defaultPixKey,
    defaultPaymentMessage: input.defaultPaymentMessage,
  };

  await writeDemoWorkspaceData(data);
  return data;
}
