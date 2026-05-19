import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/auth-session";
import { recordAuditEvent } from "@/lib/audit-repository";
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

    const changedFields = [
      workspace.name !== input.name ? "nome do workspace" : null,
      workspace.slug !== input.slug ? "slug" : null,
      (company?.legalName || "") !== input.legalName ? "razao social" : null,
      (company?.tradeName || workspace.name) !== input.tradeName ? "nome fantasia" : null,
      (company?.document || "") !== input.document ? "documento" : null,
      (company?.city || "") !== input.city ? "cidade" : null,
      (company?.state || "") !== input.state ? "UF" : null,
      (company?.serviceDescription || "") !== (input.serviceDescription || input.niche)
        ? "descricao de servicos"
        : null,
      (company?.defaultPixKey || "") !== input.defaultPixKey ? "chave Pix" : null,
      (company?.defaultPaymentMessage || "") !== input.defaultPaymentMessage
        ? "mensagem de cobranca"
        : null,
    ].filter(Boolean);

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
          serviceDescription: input.serviceDescription || input.niche,
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
          serviceDescription: input.serviceDescription || input.niche,
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
            },
          },
        },
        tx,
      );
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
